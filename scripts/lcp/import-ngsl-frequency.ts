// scripts/lcp/import-ngsl-frequency.ts
//
// Phase 14.1 — NGSL frequency_rank import to shared_dictionary
// Source: NGSL 1.2 (Browne, Culligan, Phillips 2013) CC BY-SA 4.0
//
// Usage:
//   pnpm tsx scripts/lcp/import-ngsl-frequency.ts --dry-run
//   pnpm tsx scripts/lcp/import-ngsl-frequency.ts
//   pnpm tsx scripts/lcp/import-ngsl-frequency.ts --core-only

import { config as dotenvConfig } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

dotenvConfig({ path: resolve(process.cwd(), '.env.local') })
dotenvConfig({ path: resolve(process.cwd(), '.env') })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '../../packages/library-pipeline/data/ngsl')
const STATS_CSV = resolve(DATA_DIR, 'NGSL_1.2_stats.csv')
const LEMMA_CSV = resolve(DATA_DIR, 'NGSL_1.2_lemmatized_for_research.csv')
const EXTENDED_XLSX = resolve(DATA_DIR, 'NGSL+with+SFI+(31K).xlsx')

const BATCH_SIZE = 500
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const coreOnly = args.includes('--core-only')

interface NgslWord {
  word: string
  rank: number
  sfi: number | null
}

interface LemmaFamily {
  headword: string
  lemmas: string[]
}

// RFC 4180 CSV parser (handles quoted fields)
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++ }
      else if (c === '"') inQuotes = false
      else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && next === '\n') i++
        row.push(field); field = ''
        if (row.some((f) => f.trim())) rows.push(row)
        row = []
      } else field += c
    }
  }
  if (field || row.length) {
    row.push(field)
    if (row.some((f) => f.trim())) rows.push(row)
  }
  return rows
}

function loadCoreStats(): Map<string, NgslWord> {
  const text = readFileSync(STATS_CSV, 'utf-8').replace(/^﻿/, '')
  const rows = parseCsv(text)
  const header = rows[0].map((h) => h.toLowerCase().trim())
  const wordIdx = header.findIndex((h) => ['word', 'lemma', 'headword'].includes(h))
  const rankIdx = header.findIndex((h) => h.includes('rank'))
  // Prefer exact `sfi` match — avoid catching `sfi rank` which is the rank column
  let sfiIdx = header.findIndex((h) => h === 'sfi')
  if (sfiIdx < 0) sfiIdx = header.findIndex((h, i) => i !== rankIdx && h.includes('sfi'))

  if (wordIdx < 0 || rankIdx < 0) {
    throw new Error(`Stats CSV unexpected header: ${header.join(' | ')}`)
  }

  const map = new Map<string, NgslWord>()
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const word = r[wordIdx]?.trim().toLowerCase()
    const rank = parseInt(r[rankIdx], 10)
    const sfiRaw = sfiIdx >= 0 ? parseFloat(r[sfiIdx]) : NaN
    if (!word || isNaN(rank)) continue
    map.set(word, { word, rank, sfi: isNaN(sfiRaw) ? null : sfiRaw })
  }
  console.log(`📊 Core stats: ${map.size} headwords`)
  return map
}

function loadLemmaFamilies(): LemmaFamily[] {
  // Format: ## comment lines, then blank, then `headword,form1,form2,...` per row (NO header)
  const text = readFileSync(LEMMA_CSV, 'utf-8').replace(/^﻿/, '')
  const dataLines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('##'))
  const families: LemmaFamily[] = []
  for (const line of dataLines) {
    const parts = parseCsv(line)[0] ?? []
    const cells = parts.map((p) => p.trim().toLowerCase()).filter(Boolean)
    if (cells.length === 0) continue
    const hw = cells[0]
    const lemmas = Array.from(new Set(cells))
    families.push({ headword: hw, lemmas })
  }
  console.log(`📊 Lemma families: ${families.length}`)
  return families
}

function loadExtended31K(): Map<string, NgslWord> {
  const wb = XLSX.readFile(EXTENDED_XLSX)
  const sheetName = wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
  if (rows.length === 0) {
    console.warn('⚠️  Extended XLSX empty')
    return new Map()
  }

  const keys = Object.keys(rows[0])
  const wordKey = keys.find((k) => /^(word|lemma|headword)$/i.test(k.trim()))
  // Prefer RawFreq_Rank (fills all 31K) over WL_SFI_Rank (only fills 2,809 NGSL)
  const rankKey =
    keys.find((k) => /^rawfreq_rank$/i.test(k.trim())) ??
    keys.find((k) => /^raw.*rank/i.test(k.trim())) ??
    keys.find((k) => /rank/i.test(k) && !/sfi/i.test(k))
  // SFI is its own column (Standard Frequency Index)
  const sfiKey = keys.find((k) => /^sfi$/i.test(k.trim())) ?? keys.find((k) => /^sfi/i.test(k))

  if (!wordKey || !rankKey) {
    throw new Error(`Extended XLSX unexpected columns: ${keys.join(' | ')}`)
  }
  console.log(`   xlsx columns detected — word: "${wordKey}" rank: "${rankKey}" sfi: "${sfiKey ?? '(none)'}"`)

  const map = new Map<string, NgslWord>()
  for (const r of rows) {
    const word = String(r[wordKey] ?? '').trim().toLowerCase()
    const rank = parseInt(String(r[rankKey] ?? ''), 10)
    const sfi = sfiKey ? parseFloat(String(r[sfiKey] ?? '')) : NaN
    if (!word || isNaN(rank)) continue
    map.set(word, { word, rank, sfi: isNaN(sfi) ? null : sfi })
  }
  console.log(`📊 Extended 31K: ${map.size} words`)
  return map
}

function buildUpdateMap(
  core: Map<string, NgslWord>,
  families: LemmaFamily[],
  extended: Map<string, NgslWord>,
): Map<string, NgslWord> {
  const merged = new Map<string, NgslWord>()
  for (const [w, d] of core) merged.set(w, d)

  for (const family of families) {
    const head = merged.get(family.headword)
    if (!head) continue
    for (const lemma of family.lemmas) {
      if (!merged.has(lemma)) merged.set(lemma, { ...head, word: lemma })
    }
  }

  for (const [w, d] of extended) {
    if (!merged.has(w)) merged.set(w, d)
  }
  console.log(`📊 Merged unique: ${merged.size}\n`)
  return merged
}

async function applyToDatabase(client: SupabaseClient, updates: Map<string, NgslWord>): Promise<void> {
  const records = Array.from(updates.values())
  let matched = 0
  let missing = 0
  let errors = 0

  console.log(`🔄 Applying ${records.length} updates in batches of ${BATCH_SIZE}...\n`)

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const words = batch.map((b) => b.word)

    const { data: existing, error: fetchErr } = await client
      .from('shared_dictionary')
      .select('word')
      .in('word', words)

    if (fetchErr) {
      console.error(`  ❌ Batch ${i} fetch error: ${fetchErr.message}`)
      errors += batch.length
      continue
    }

    const existingSet = new Set((existing ?? []).map((e) => (e as { word: string }).word))
    const toUpdate = batch.filter((b) => existingSet.has(b.word))
    missing += batch.length - toUpdate.length

    for (const rec of toUpdate) {
      const { error: updErr } = await client
        .from('shared_dictionary')
        .update({
          // source intentionally untouched — preserves prior 'imported' provenance.
          // NGSL coverage is tracked by ngsl_sfi IS NOT NULL + verified=true.
          frequency_rank: rec.rank,
          ngsl_sfi: rec.sfi,
          verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('word', rec.word)
      if (updErr) {
        console.error(`  ❌ ${rec.word}: ${updErr.message}`)
        errors++
      } else matched++
    }

    if (((i / BATCH_SIZE) | 0) % 5 === 0) {
      console.log(`  ${i + batch.length}/${records.length} — matched:${matched} missing:${missing} errors:${errors}`)
    }
  }

  console.log(`\n✅ Done — matched:${matched} missing:${missing} errors:${errors}`)
}

async function main(): Promise<void> {
  console.log(`🌱 NGSL frequency_rank import — ${dryRun ? 'DRY RUN' : 'LIVE'}${coreOnly ? ' (core-only)' : ''}\n`)

  const core = loadCoreStats()
  const families = loadLemmaFamilies()
  const extended = coreOnly ? new Map<string, NgslWord>() : loadExtended31K()
  const merged = buildUpdateMap(core, families, extended)

  // distribution preview
  const buckets = { '1-1k': 0, '1k-5k': 0, '5k-10k': 0, '10k-31k': 0, 'sfi=null': 0 }
  for (const d of merged.values()) {
    if (d.sfi === null) buckets['sfi=null']++
    if (d.rank <= 1000) buckets['1-1k']++
    else if (d.rank <= 5000) buckets['1k-5k']++
    else if (d.rank <= 10000) buckets['5k-10k']++
    else buckets['10k-31k']++
  }
  console.log('📈 Rank distribution:')
  for (const [k, v] of Object.entries(buckets)) console.log(`   ${k.padEnd(12)} ${v}`)
  console.log()

  if (dryRun) {
    console.log('📋 Sample (first 15):')
    let n = 0
    for (const [w, d] of merged) {
      if (n++ >= 15) break
      console.log(`   ${w.padEnd(20)} rank=${String(d.rank).padStart(5)} sfi=${d.sfi ?? 'null'}`)
    }
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

  const client = createClient(url, key)
  await applyToDatabase(client, merged)

  const { count } = await client
    .from('shared_dictionary')
    .select('*', { count: 'exact', head: true })
    .not('frequency_rank', 'is', null)
  console.log(`\n📈 shared_dictionary.frequency_rank now filled: ${count} rows`)
}

main().catch((err) => {
  console.error('💥 Failed:', err)
  process.exit(1)
})
