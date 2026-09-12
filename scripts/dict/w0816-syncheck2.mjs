// scripts/dict/w0816-syncheck2.mjs
// T5b — 유의어 오염 제거 **잔여 구간**. T5(w0816-syncheck)는 발행 도서 어휘 12,401개만 대상이었는데,
//   유의어 보유 단어는 23,367개다. WordNet 오염은 전역이므로 **나머지 1만여 단어는 아직 그대로**다.
//   T5 실측 제거율 34~81%, 노출되던 값에 인종·성소수자·장애 멸칭과 마약 은어가 포함돼 콘텐츠 안전 사안이다.
//   진단: docs/AI_CONTEXT/diagnostics/dict_field_consistency_20260815.md §④
//
// T5 와 동일한 게이트: **삭제 전용**(keep ⊆ 원본) + 남긴 유의어 실재 검증.
//   대상만 다르다 — 발행 도서 어휘를 **제외한** 나머지 전체.
// 실행: node scripts/dict/w0816-syncheck2.mjs chunk [--dir D] [--size 120]
//       node scripts/dict/w0816-syncheck2.mjs apply [--dir D] [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { db, publishedVocab, dictRows, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0816-syncheck2')
const SIZE = parseInt(arg('--size', '120'), 10)
const COMMIT = process.argv.includes('--commit')

if (MODE === 'chunk') {
  // 이미 T5 가 처리한 발행 도서 어휘는 제외
  const done = new Set([...(await publishedVocab()).keys()])
  const targets = []
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, pos, meaning_ko, example_en, synonyms, cefr_level, v_level, frequency_rank')
      .not('synonyms', 'is', null).gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      const w = r.word.toLowerCase()
      if (done.has(w)) continue
      if (!r.synonyms || !r.synonyms.length) continue
      if (!r.meaning_ko) continue
      targets.push({
        word: r.word, pos: r.pos, meaning_ko: r.meaning_ko, example_en: r.example_en ?? null,
        synonyms: r.synonyms, cefr: r.cefr_level, v: r.v_level, rank: r.frequency_rank,
      })
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
  // 빈도순(노출 위험 큰 것 먼저) → rank 없는 것은 뒤로
  targets.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))
  const n = writeChunks(DIR, targets, SIZE)
  console.log(`syncheck2 targets: ${targets.length} · chunks: ${n} → ${DIR}/chunk-NN.json`)
  process.exit(0)
}

if (MODE === 'apply') {
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
    if (keep.some((k) => !src.has(k.toLowerCase()))) { notSubset++; continue }   // ⛔ 삭제 전용 게이트
    if (keep.length === src.size) { unchanged++; continue }
    items.set(w, keep)
  }
  console.log(`files: ${files} · 정제 대상: ${items.size} · 변화없음: ${unchanged} · 부분집합 위반(거부): ${notSubset} · malformed: ${bad}`)

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
      if (n++ >= 10) break
      const dropped = [...orig.get(w)].filter((s) => !keep.map((k) => k.toLowerCase()).includes(s))
      console.log(` ${w}: 남김[${keep.join(', ')}] ← 제거[${dropped.slice(0, 8).join(', ')}]`)
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

console.error('usage: node scripts/dict/w0816-syncheck2.mjs chunk|apply [--dir D] [--size N] [--commit]')
process.exit(1)
