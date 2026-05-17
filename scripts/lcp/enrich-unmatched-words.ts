// scripts/lcp/enrich-unmatched-words.ts
//
// Phase 14.8 — Claude Opus 4.7 LLM Batch Enrichment for lbv-unmatched words.
//
// Strategy:
//   1. Load target words from CSV (scripts/lcp/data/phase14_8_target_words.csv)
//   2. Batch 50 per API call → claude-opus-4-7 with JSON prefill
//   3. Skip is_proper_noun=true (alice/jones/...)
//   4. INSERT into shared_dictionary (source='ai-generated', verified=false)
//
// Usage:
//   pnpm tsx scripts/lcp/enrich-unmatched-words.ts                    LIVE (full run)
//   pnpm tsx scripts/lcp/enrich-unmatched-words.ts --limit 50         첫 50 단어 (dry-run 시범)
//   pnpm tsx scripts/lcp/enrich-unmatched-words.ts --dry-run          API 호출 / DB 쓰기 모두 SKIP (preflight)

import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── Config ─────────────────────────────────────────────────────────
const MODEL = 'claude-opus-4-7'
const BATCH_SIZE = 50
const MAX_TOKENS = 8000
const SLEEP_MS = 1000
const MAX_RETRIES = 3

const CSV_PATH = 'scripts/lcp/data/phase14_8_target_words.csv'

const VALID_POS = new Set([
  'verb', 'noun', 'adjective', 'adverb', 'preposition', 'pronoun',
  'conjunction', 'interjection', 'determiner', 'auxiliary verb',
  'abbreviation', 'phrasal verb', 'idiom',
])
const VALID_CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

// ─── CLI ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const isDryRun = argv.includes('--dry-run')
const limitArg = argv.find((a) => a.startsWith('--limit'))
const LIMIT = limitArg
  ? parseInt(limitArg.includes('=') ? limitArg.split('=')[1]! : argv[argv.indexOf(limitArg) + 1]!, 10)
  : undefined

// ─── Types ──────────────────────────────────────────────────────────
interface TargetWord {
  word: string
  total_occ: number
  book_count: number
  sample_sentence: string
}

interface LlmResult {
  word: string
  is_proper_noun: boolean
  meaning_ko: string
  meanings_ko: Array<{ pos: string; meaning: string }>
  pos: string
  cefr_level: string
}

// ─── Tiny CSV parser (RFC 4180 quoted-field aware) ──────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n' || c === '\r') {
        if (field || row.length) { row.push(field); rows.push(row); row = []; field = '' }
        if (c === '\r' && text[i + 1] === '\n') i++
      } else field += c
    }
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

function loadCsv(path: string): TargetWord[] {
  const text = readFileSync(resolve(process.cwd(), path), 'utf-8').replace(/^﻿/, '')
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim()))
  if (rows.length < 2) throw new Error(`CSV empty: ${path}`)
  const header = rows[0]!.map((h) => h.trim())
  const idx = {
    word: header.indexOf('word'),
    total_occ: header.indexOf('total_occ'),
    book_count: header.indexOf('book_count'),
    sample_sentence: header.indexOf('sample_sentence'),
  }
  if (idx.word < 0) throw new Error('CSV missing "word" column')
  const out: TargetWord[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!
    out.push({
      word: (r[idx.word] ?? '').trim(),
      total_occ: parseInt(r[idx.total_occ] ?? '0', 10) || 0,
      book_count: parseInt(r[idx.book_count] ?? '0', 10) || 0,
      sample_sentence: (r[idx.sample_sentence] ?? '').trim(),
    })
  }
  return out
}

// ─── Prompt ─────────────────────────────────────────────────────────
function buildPrompt(words: TargetWord[]): string {
  const list = words
    .map(
      (w, i) =>
        `${i + 1}. "${w.word}" (occ:${w.total_occ}, books:${w.book_count})\n` +
        `   ctx: "${w.sample_sentence.slice(0, 150).replace(/"/g, "'")}"`,
    )
    .join('\n')

  return `You are a Korean-language English dictionary enrichment expert for a learning app called Vocaflow.

For each English word below, provide accurate Korean meanings, part of speech, and CEFR level based on the sample sentence context.

CRITICAL RULES:
1. is_proper_noun: true ONLY for proper nouns (person/place/brand names like alice, jones, mary, watson, scotland, london, paris, kent). Common nouns like gentleman, footman, governess are NOT proper nouns.
2. meaning_ko: Concise natural Korean (2~6 words). Avoid stiff dictionary phrasing.
3. meanings_ko: Array of {pos, meaning} for each distinct sense (1~3 entries usually).
4. pos: EXACTLY ONE of [verb, noun, adjective, adverb, preposition, pronoun, conjunction, interjection, determiner, auxiliary verb, abbreviation, phrasal verb, idiom].
5. cefr_level: EXACTLY ONE of [A1, A2, B1, B2, C1, C2] (learning difficulty).
6. Use the sample sentence context to disambiguate.

WORDS:
${list}

Respond with JSON ONLY (no markdown, no preamble). Continue the JSON I started.`
}

// ─── Anthropic call with prefill ─────────────────────────────────────
async function enrichBatch(anthropic: Anthropic, words: TargetWord[]): Promise<LlmResult[]> {
  const PREFILL = '{\n  "results": [\n'

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'user', content: buildPrompt(words) },
          { role: 'assistant', content: PREFILL },
        ],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') throw new Error('No text in response')

      const full = PREFILL + textBlock.text
      // 응답이 } 로 끝나지 않으면 닫기 시도
      const closed = /\}\s*$/.test(full.trim()) ? full : full + '\n  ]\n}'
      const parsed = JSON.parse(closed) as { results?: LlmResult[] }
      if (!Array.isArray(parsed.results)) throw new Error('Missing results[]')
      return parsed.results
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`   ⚠ attempt ${attempt}/${MAX_RETRIES}: ${msg}`)
      if (attempt === MAX_RETRIES) throw err
      await new Promise((r) => setTimeout(r, attempt * 5000))
    }
  }
  return []
}

// ─── Normalize + validate ───────────────────────────────────────────
function normalize(r: LlmResult): LlmResult | null {
  if (!r?.word || r.is_proper_noun === true) return null
  return {
    word: r.word.toLowerCase().trim(),
    is_proper_noun: false,
    meaning_ko: (r.meaning_ko ?? '').slice(0, 500) || '(의미 미상)',
    meanings_ko: Array.isArray(r.meanings_ko) ? r.meanings_ko : [],
    pos: VALID_POS.has(r.pos) ? r.pos : 'noun',
    cefr_level: VALID_CEFR.has(r.cefr_level) ? r.cefr_level : 'B1',
  }
}

// ─── DB insert ───────────────────────────────────────────────────────
async function insertBatch(
  supabase: SupabaseClient,
  rows: LlmResult[],
): Promise<{ inserted: number; failed: number }> {
  if (rows.length === 0) return { inserted: 0, failed: 0 }
  const payload = rows.map((r) => ({
    word: r.word,
    meaning_ko: r.meaning_ko,
    meanings_ko: r.meanings_ko,
    pos: r.pos,
    pos_all: null,
    cefr_level: r.cefr_level,
    frequency_rank: null,
    list_tags: [],
    source: 'ai-generated',
    verified: false,
  }))
  const { error, count } = await supabase
    .from('shared_dictionary')
    .upsert(payload, { onConflict: 'word', ignoreDuplicates: true, count: 'exact' })
  if (error) {
    console.error(`   ❌ upsert error: ${error.message}`)
    return { inserted: 0, failed: rows.length }
  }
  return { inserted: count ?? rows.length, failed: 0 }
}

// ─── Main ────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(
    `🚀 Phase 14.8 LLM Enrichment — model=${MODEL} batch=${BATCH_SIZE}${isDryRun ? ' DRY-RUN' : ''}${LIMIT ? ` limit=${LIMIT}` : ''}`,
  )

  const all = loadCsv(CSV_PATH)
  const records = LIMIT ? all.slice(0, LIMIT) : all
  console.log(`📊 Loaded ${all.length} words, processing ${records.length}`)

  if (isDryRun) {
    console.log('🧪 DRY-RUN: prompt preview for first batch:')
    console.log('─'.repeat(60))
    console.log(buildPrompt(records.slice(0, 3)))
    console.log('─'.repeat(60))
    console.log('🧪 DRY-RUN: no API/DB calls made. Exit.')
    return
  }

  // Env validation (LIVE only)
  const apiKey = process.env.ANTHROPIC_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing in env')
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase env missing')

  const anthropic = new Anthropic({ apiKey })
  const supabase = createClient(supabaseUrl, supabaseKey)

  let totalInserted = 0
  let totalProper = 0
  let totalFailed = 0

  const batches = Math.ceil(records.length / BATCH_SIZE)
  for (let i = 0; i < batches; i++) {
    const start = i * BATCH_SIZE
    const batch = records.slice(start, start + BATCH_SIZE)
    console.log(`\n🔄 Batch ${i + 1}/${batches} (${batch.length} words)...`)

    try {
      const llm = await enrichBatch(anthropic, batch)
      const proper = llm.filter((r) => r?.is_proper_noun).length
      const usable = llm.map(normalize).filter((r): r is LlmResult => r !== null)
      const { inserted, failed } = await insertBatch(supabase, usable)
      totalInserted += inserted
      totalProper += proper
      totalFailed += failed
      console.log(
        `   ✅ inserted:${inserted} proper:${proper} failed:${failed} (received:${llm.length})`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`   ❌ batch failed: ${msg}`)
      totalFailed += batch.length
    }

    if (i < batches - 1) await new Promise((r) => setTimeout(r, SLEEP_MS))
  }

  console.log('\n📊 SUMMARY')
  console.log(`   inserted:           ${totalInserted}`)
  console.log(`   proper-noun skipped:${totalProper}`)
  console.log(`   failed:             ${totalFailed}`)
  console.log(`   target total:       ${records.length}`)
}

main().catch((err) => {
  console.error('💥 Fatal:', err)
  process.exit(1)
})
