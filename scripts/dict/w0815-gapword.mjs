// scripts/dict/w0815-gapword.mjs
// T3a — 발행 도서 어휘 사전 갭 채움. 학습자가 리더에서 탭했는데 아무것도 안 뜨는 단어를 사전에 편입.
//   대상 = published 도서 lemma 중 shared_dictionary 미등재(실측 2,067 · 등장 3,238회).
//   chunk : 등장 도서수→빈도 순 정렬(임팩트 정렬)으로 청크 분할. 근거로 원문 문장을 함께 넘긴다.
//   apply : 서브에이전트 산출(*.out.json)을 검증 후 INSERT. 이미 있으면 스킵(멱등).
// 실행: node scripts/dict/w0815-gapword.mjs chunk [--dir D] [--size 90]
//       node scripts/dict/w0815-gapword.mjs apply [--dir D] [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { db, publishedVocab, dictRows, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0815-gapword')
const SIZE = parseInt(arg('--size', '90'), 10)
const COMMIT = process.argv.includes('--commit')

const POS_OK = new Set(['noun', 'verb', 'adjective', 'adverb', 'interjection', 'preposition', 'conjunction', 'pronoun', 'determiner'])
const CEFR_OK = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
const REG_OK = new Set(['standard', 'modern_advanced', 'period_cultural', 'archaic_literary', 'phrase_unit', 'brand', 'abbreviation', 'proper_noun'])

if (MODE === 'chunk') {
  const agg = await publishedVocab()
  const lemmas = [...agg.keys()].filter((w) => /^[a-z][a-z'-]{1,}$/.test(w))
  const known = await dictRows(lemmas, 'word')
  const targets = lemmas
    .filter((w) => !known.has(w))
    .map((w) => {
      const e = agg.get(w)
      return { word: w, freq: e.freq, books: [...e.books].slice(0, 3), sentence: (e.sentence || '').slice(0, 240) }
    })
    .sort((a, b) => b.books.length - a.books.length || b.freq - a.freq)
  const n = writeChunks(DIR, targets, SIZE)
  console.log(`gapword targets: ${targets.length} · chunks: ${n} → ${DIR}/chunk-NN.json`)
  process.exit(0)
}

if (MODE === 'apply') {
  const { files, rows } = readOuts(DIR)
  const items = new Map()
  let bad = 0, skipped = 0
  for (const e of rows) {
    if (!e || typeof e.word !== 'string') { bad++; continue }
    if (e.skip === true) { skipped++; continue }
    const w = e.word.toLowerCase().trim()
    const ok =
      POS_OK.has(e.pos) &&
      typeof e.meaning_ko === 'string' && e.meaning_ko.trim() &&
      typeof e.example_en === 'string' && e.example_en.trim().length >= 10 &&
      CEFR_OK.has(e.cefr_level) &&
      Number.isInteger(e.v_level) && e.v_level >= 0 && e.v_level <= 11 &&
      (e.word_register == null || REG_OK.has(e.word_register))
    if (!ok) { bad++; continue }
    items.set(w, {
      word: w,
      pos: e.pos,
      meaning_ko: e.meaning_ko.trim(),
      meanings_ko: Array.isArray(e.meanings_ko) && e.meanings_ko.length
        ? e.meanings_ko.filter((m) => m && POS_OK.has(m.pos) && typeof m.meaning === 'string' && m.meaning.trim())
          .map((m) => ({ pos: m.pos, meaning: m.meaning.trim(), v_level: e.v_level }))
        : [{ pos: e.pos, meaning: e.meaning_ko.trim(), v_level: e.v_level }],
      example_en: e.example_en.trim(),
      cefr_level: e.cefr_level,
      v_level: e.v_level,
      primary_pos: e.pos,
      pos_set: [e.pos],
      word_register: e.word_register ?? 'standard',
      source: 'ai-generated',
      classified_by: 'claude_code_opus_5',
      claude_classified_at: new Date().toISOString(),
      verified: false,
      field_provenance: { batch: 'w0815-gapword', basis: 'published_book_context' },
    })
  }
  console.log(`files: ${files} · valid: ${items.size} · rejected: ${bad} · agent-skipped: ${skipped}`)

  // 멱등 — 이미 사전에 있는 단어는 제외
  const existing = await dictRows([...items.keys()], 'word')
  for (const w of existing.keys()) items.delete(w)
  console.log(`already in dict (skip): ${existing.size} · to insert: ${items.size}`)

  if (!COMMIT) {
    console.log('DRY-RUN (--commit 로 적용). 샘플:')
    let n = 0
    for (const v of items.values()) { if (n++ >= 10) break; console.log(' ', v.word, `[${v.pos}/${v.cefr_level}/V${v.v_level}]`, v.meaning_ko, '·', v.example_en.slice(0, 60)) }
    process.exit(0)
  }

  const all = [...items.values()]
  let done = 0, failed = 0
  for (let i = 0; i < all.length; i += 100) {
    const batch = all.slice(i, i + 100)
    const { error } = await db.from('shared_dictionary').insert(batch)
    if (error) { console.warn('batch fail', i, error.message); failed += batch.length } else done += batch.length
  }
  console.log(`inserted: ${done} · failed: ${failed}`)
  process.exit(0)
}

console.error('usage: node scripts/dict/w0815-gapword.mjs chunk|apply [--dir D] [--size N] [--commit]')
process.exit(1)
