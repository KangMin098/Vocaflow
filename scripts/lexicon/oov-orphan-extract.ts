// scripts/lexicon/oov-orphan-extract.ts
//
// Phase 3 OOV/orphan enrichment — target 추출.
//
// 대상:
//   1. kice-orphan 66 row in shared_dictionary
//      → ipa / cefr_level / example_en 필드 채움 (UPDATE)
//      → meaning_ko / pos / primary_pos 는 이미 존재 (보존)
//   2. OOV words (lemma IS NULL in shared_words/vocabularies, sd 미존재)
//      → 전체 필드 신규 생성 (INSERT) — source='ai-generated'
//
// 출력: data/lexicon/p3-oov-orphan/targets.jsonl
//
// 각 라인 schema:
//   { action: "update"|"insert",
//     source_group: "kice-orphan"|"oov",
//     word: "...",
//     // update 의 경우:
//     existing_pos, existing_primary_pos, existing_meaning_ko (참고용),
//     // 공통:
//     fields_to_fill: [...] }
//
// CLI: tsx scripts/lexicon/oov-orphan-extract.ts

import fs from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
loadDotenv({ path: resolve(__dirname, '../../.env.local') })

const OUTPUT_DIR = resolve(__dirname, '../../data/lexicon/p3-oov-orphan')
const OUTPUT_FILE = resolve(OUTPUT_DIR, 'targets.jsonl')

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('SUPABASE env required (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)')
    process.exit(1)
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ── (1) kice-orphan UPDATE 대상 ──
  const { data: orphan, error: orphanErr } = await sb
    .from('shared_dictionary')
    .select('word,pos,primary_pos,meaning_ko')
    .eq('source', 'kice-orphan')
    .order('word')
  if (orphanErr) throw orphanErr

  // ── (2) OOV INSERT 대상 — shared_words + vocabularies 의 lemma NULL word, sd 미존재 ──
  const { data: swOov, error: swErr } = await sb
    .from('shared_words')
    .select('word')
    .is('lemma', null)
    .not('word', 'is', null)
  if (swErr) throw swErr

  const { data: vocabOov, error: vocabErr } = await sb
    .from('vocabularies')
    .select('word')
    .is('lemma', null)
    .not('word', 'is', null)
  if (vocabErr) throw vocabErr

  const oovSet = new Set<string>()
  for (const r of swOov ?? []) oovSet.add(String(r.word).toLowerCase().trim())
  for (const r of vocabOov ?? []) oovSet.add(String(r.word).toLowerCase().trim())
  const oovArr = [...oovSet].sort()

  // sd 에 이미 존재하는 단어 필터 (방어적)
  const existingSet = new Set<string>()
  if (oovArr.length > 0) {
    const { data: existing } = await sb.from('shared_dictionary').select('word').in('word', oovArr)
    for (const r of existing ?? []) existingSet.add(String(r.word))
  }
  const oovTargets = oovArr.filter((w) => !existingSet.has(w))

  // ── 출력 ──
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const lines: string[] = []

  for (const row of orphan ?? []) {
    lines.push(
      JSON.stringify({
        action: 'update',
        source_group: 'kice-orphan',
        word: row.word,
        existing_pos: row.pos,
        existing_primary_pos: row.primary_pos,
        existing_meaning_ko: row.meaning_ko,
        fields_to_fill: ['ipa', 'cefr_level', 'example_en'],
      }),
    )
  }
  for (const word of oovTargets) {
    lines.push(
      JSON.stringify({
        action: 'insert',
        source_group: 'oov',
        word,
        fields_to_fill: [
          'pos',
          'primary_pos',
          'meaning_ko',
          'meanings_ko',
          'ipa',
          'cefr_level',
          'example_en',
        ],
      }),
    )
  }

  fs.writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n')
  console.log(`Wrote ${lines.length} target rows to ${OUTPUT_FILE}`)
  console.log(`  kice-orphan UPDATE: ${(orphan ?? []).length}`)
  console.log(`  OOV INSERT:         ${oovTargets.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
