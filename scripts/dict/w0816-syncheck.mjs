// scripts/dict/w0816-syncheck.mjs
// T5 — synonyms 오염 제거. WordNet 자동 수입 잔재로 동음이의·속어·고유명사·반대 개념이 섞여 있다
//   (`trash` → 메스암페타민 은어 전량 · `lettuce` → boodle · `falsifiable` → confirmable).
//   진단: docs/AI_CONTEXT/diagnostics/dict_field_consistency_20260815.md §④
//
// ⚠️ 핵심 게이트 — **에이전트는 삭제만 할 수 있고 추가할 수 없다.**
//   keep 배열이 원본 synonyms 의 부분집합이 아니면 그 항목 전체를 거부한다.
//   이 제약이 없으면 "정제" 배치가 새 환각 유의어를 심는 경로가 된다.
//   추가 게이트: 남긴 유의어는 사전 또는 lexicon_clean 에 실재해야 한다(비표제어 잔류 차단).
//
// 실행: node scripts/dict/w0816-syncheck.mjs chunk [--dir D] [--size 120]
//       node scripts/dict/w0816-syncheck.mjs apply [--dir D] [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { db, publishedVocab, dictRows, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0816-syncheck')
const SIZE = parseInt(arg('--size', '120'), 10)
const COMMIT = process.argv.includes('--commit')

if (MODE === 'chunk') {
  const agg = await publishedVocab()
  const lemmas = [...agg.keys()].filter((w) => /^[a-z][a-z'-]{1,}$/.test(w))
  const rows = await dictRows(lemmas, 'word, pos, meaning_ko, example_en, synonyms, cefr_level, v_level')
  const targets = []
  for (const [w, r] of rows) {
    if (!r.synonyms || !r.synonyms.length) continue
    if (!r.meaning_ko) continue
    const e = agg.get(w)
    targets.push({
      word: w, pos: r.pos, meaning_ko: r.meaning_ko, example_en: r.example_en ?? null,
      synonyms: r.synonyms, cefr: r.cefr_level, v: r.v_level,
      books: e ? [...e.books].length : 0, freq: e ? e.freq : 0,
    })
  }
  targets.sort((a, b) => b.books - a.books || b.freq - a.freq)
  const n = writeChunks(DIR, targets, SIZE)
  console.log(`syncheck targets: ${targets.length} · chunks: ${n} → ${DIR}/chunk-NN.json`)
  process.exit(0)
}

if (MODE === 'apply') {
  // 원본 synonyms 재구성 (부분집합 검증용)
  const orig = new Map()
  for (const f of fs.readdirSync(DIR)) {
    if (!/^chunk-\d+\.json$/.test(f)) continue
    for (const e of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
      orig.set(e.word.toLowerCase(), new Set((e.synonyms ?? []).map((s) => String(s).toLowerCase())))
    }
  }

  const { files, rows } = readOuts(DIR)
  const items = new Map()
  let bad = 0, notSubset = 0, unchanged = 0
  for (const e of rows) {
    if (!e || typeof e.word !== 'string' || !Array.isArray(e.keep)) { bad++; continue }
    const w = e.word.toLowerCase().trim()
    const src = orig.get(w)
    if (!src) { bad++; continue }
    const keep = [...new Set(e.keep.map((s) => String(s ?? '').trim()).filter(Boolean))]
    // ⚠️ 부분집합 게이트 — 원본에 없던 유의어를 하나라도 넣으면 항목 전체 거부
    if (keep.some((k) => !src.has(k.toLowerCase()))) { notSubset++; continue }
    if (keep.length === src.size) { unchanged++; continue } // 삭제 대상 없음
    items.set(w, keep)
  }
  console.log(`files: ${files} · 정제 대상: ${items.size} · 변화없음: ${unchanged} · 부분집합 위반(거부): ${notSubset} · malformed: ${bad}`)

  // 남긴 유의어 실재 검증 — 사전에도 lexicon_clean 에도 없으면 그 항목만 추가 제거
  const pool = [...new Set([...items.values()].flat().map((s) => s.toLowerCase()))]
  const inDict = await dictRows(pool, 'word')
  const inLex = new Set()
  for (let i = 0; i < pool.length; i += 200) {
    const { data } = await db.from('lexicon_clean').select('word').in('word', pool.slice(i, i + 200))
    for (const r of data ?? []) inLex.add(r.word.toLowerCase())
  }
  let ghosts = 0
  for (const [w, keep] of items) {
    const real = keep.filter((k) => inDict.has(k.toLowerCase()) || inLex.has(k.toLowerCase()))
    ghosts += keep.length - real.length
    items.set(w, real)
  }
  console.log(`남긴 유의어 중 비표제어 추가 제거: ${ghosts}`)

  if (!COMMIT) {
    console.log('DRY-RUN (--commit 로 적용). 샘플:')
    let n = 0
    for (const [w, keep] of items) {
      if (n++ >= 12) break
      const dropped = [...orig.get(w)].filter((s) => !keep.map((k) => k.toLowerCase()).includes(s))
      console.log(` ${w}: 남김[${keep.join(', ')}] ← 제거[${dropped.join(', ')}]`)
    }
    process.exit(0)
  }

  let done = 0, failed = 0
  for (const [w, keep] of items) {
    const { error } = await db.from('shared_dictionary')
      .update({ synonyms: keep.length ? keep : null }).eq('word', w)
    if (error) { failed++; if (failed < 5) console.warn(w, error.message) } else done++
    if (done % 500 === 0 && done) console.log(`  … ${done}`)
  }
  console.log(`updated: ${done} · failed: ${failed}`)
  process.exit(0)
}

console.error('usage: node scripts/dict/w0816-syncheck.mjs chunk|apply [--dir D] [--size N] [--commit]')
process.exit(1)
