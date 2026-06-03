// scripts/cefrj-import.mjs
//
// CEFR-J Wordlist v1.6 적재 — _staging_cefrj_wordlist 테이블 batch upsert.
// 입력: data/import/cefrj/cefrj_wordlist_v1.6_normalized.jsonl
//
// 사용:
//   node scripts/cefrj-import.mjs
//
// 사후 단계 (별도 SQL):
//   UPDATE shared_dictionary FROM _staging_cefrj_wordlist
//   DROP TABLE _staging_cefrj_wordlist

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeClient } from './dict-common.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const JSONL = resolve(__dirname, '../data/import/cefrj/cefrj_wordlist_v1.6_normalized.jsonl')
const BATCH = 500

const supabase = makeClient()

const rows = readFileSync(JSONL, 'utf-8')
  .trim().split('\n')
  .map((l) => JSON.parse(l))

console.log(`Loaded ${rows.length} rows from JSONL`)

let inserted = 0
let failed = 0
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH).map((r) => ({
    lemma: r.lemma,
    band: r.band,
    domains: r.domains ?? [],
  }))
  const { error, count } = await supabase
    .from('_staging_cefrj_wordlist')
    .upsert(chunk, { onConflict: 'lemma', count: 'exact' })
  if (error) {
    console.error(`  ✗ batch ${i / BATCH + 1}: ${error.message}`)
    failed += chunk.length
  } else {
    inserted += chunk.length
    process.stdout.write(`  ✓ batch ${(i / BATCH + 1).toString().padStart(2)} (${inserted}/${rows.length})\r`)
  }
}
console.log(`\nDone · inserted=${inserted} · failed=${failed}`)
