// scripts/dict-update-batch.mjs
//
// 한국어 뜻 batch UPDATE.
//
// 입력 (stdin 또는 --file):
//   [
//     {
//       "word": "ability",
//       "meaning_ko": "능력",
//       "meanings_ko": [{ "pos": "n", "meaning": "능력, 재능" }]
//     },
//     ...
//   ]
//
// 멱등성: WHERE meaning_ko IS NULL — 이미 채워진 row 절대 덮어쓰지 X.
//
// CLI:
//   echo '...' | node scripts/dict-update-batch.mjs
//   node scripts/dict-update-batch.mjs --file path/to/json

import { readFileSync } from 'node:fs'
import { argv, exit, stdin } from 'node:process'

import { arg, makeClient } from './dict-common.mjs'

async function readStdin() {
  const chunks = []
  for await (const c of stdin) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

const filePath = arg(argv, '--file', null)
const raw = filePath ? readFileSync(filePath, 'utf8') : await readStdin()

if (!raw.trim()) {
  console.error('  ✗ 입력 비어 있음 — JSON 배열 stdin 또는 --file 필요')
  exit(1)
}

let entries
try {
  entries = JSON.parse(raw)
} catch (e) {
  console.error('  ✗ JSON 파싱 실패:', e.message)
  exit(1)
}

if (!Array.isArray(entries)) {
  console.error('  ✗ 최상위 JSON 은 배열이어야 합니다')
  exit(1)
}

const supabase = makeClient()

let success = 0
let skippedNoMatch = 0
let skippedAlreadyFilled = 0
let invalidPayload = 0
const errors = []

for (const e of entries) {
  if (!e || typeof e.word !== 'string' || !e.word.trim()) {
    invalidPayload++
    continue
  }
  const word = e.word.toLowerCase().trim()
  const meaning = (e.meaning_ko ?? '').toString().trim()
  const meanings = Array.isArray(e.meanings_ko) ? e.meanings_ko : null

  if (!meaning || !meanings || meanings.length === 0) {
    invalidPayload++
    errors.push({ word, reason: 'meaning_ko 또는 meanings_ko 비어 있음' })
    continue
  }
  // meanings_ko 각 항목 형식 가드
  const cleanedMeanings = []
  for (const m of meanings) {
    if (!m || typeof m.pos !== 'string' || typeof m.meaning !== 'string') continue
    const pos = m.pos.toLowerCase().trim()
    const text = m.meaning.trim()
    if (!pos || !text) continue
    cleanedMeanings.push({ pos, meaning: text })
  }
  if (cleanedMeanings.length === 0) {
    invalidPayload++
    errors.push({ word, reason: 'meanings_ko 항목 모두 무효' })
    continue
  }

  const { data, error } = await supabase
    .from('shared_dictionary')
    .update({
      meaning_ko: meaning,
      meanings_ko: cleanedMeanings,
      verified: false,
    })
    .eq('word', word)
    .is('meaning_ko', null)
    .select('word')

  if (error) {
    errors.push({ word, reason: error.message })
    continue
  }
  if (!data || data.length === 0) {
    // 매칭되는 row 없음 — 이미 채워졌거나 단어 자체가 사전에 없음
    // 어느 쪽인지 한번 더 확인
    const { data: probe } = await supabase
      .from('shared_dictionary')
      .select('meaning_ko')
      .eq('word', word)
      .maybeSingle()
    if (probe?.meaning_ko) {
      skippedAlreadyFilled++
    } else {
      skippedNoMatch++
      errors.push({ word, reason: 'shared_dictionary 에 해당 단어 없음' })
    }
    continue
  }
  success++
}

console.log(`✓ ${success}/${entries.length} success`)
if (skippedAlreadyFilled > 0) console.log(`⚠ ${skippedAlreadyFilled} skipped (이미 채워짐 — 멱등 보호)`)
if (skippedNoMatch > 0) console.log(`⚠ ${skippedNoMatch} skipped (사전에 없는 단어)`)
if (invalidPayload > 0) console.log(`⚠ ${invalidPayload} invalid payload`)
if (errors.length > 0) {
  console.log(`\n에러 상세 (최대 10개):`)
  for (const e of errors.slice(0, 10)) {
    console.log(`  - ${e.word}: ${e.reason}`)
  }
  if (errors.length > 10) console.log(`  ... 외 ${errors.length - 10}건`)
}

if (success === 0 && entries.length > 0) exit(1)
