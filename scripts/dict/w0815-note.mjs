// scripts/dict/w0815-note.mjs
// T3b — korean_learner_note 채움. 한국인 학습자가 그 단어에서 실제로 틀리는 지점을 한 줄로.
//   대상 = published 도서 어휘 ∩ shared_dictionary 중 korean_learner_note IS NULL (실측 12,282).
//   note 는 "뜻 반복"이 아니라 혼동어·연어 제약·가산성·전치사·한국어 직역 함정 중 하나를 짚는다.
//   chunk : 등장 도서수→빈도 임팩트 정렬. 뜻·품사·예문을 근거로 함께 넘긴다.
//   apply : 길이·중복(뜻 그대로 복사) 게이트 후 UPDATE. 이미 있으면 스킵(멱등).
// 실행: node scripts/dict/w0815-note.mjs chunk [--dir D] [--size 120]
//       node scripts/dict/w0815-note.mjs apply [--dir D] [--commit]
import { db, publishedVocab, dictRows, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0815-note')
const SIZE = parseInt(arg('--size', '120'), 10)
const COMMIT = process.argv.includes('--commit')

if (MODE === 'chunk') {
  const agg = await publishedVocab()
  const lemmas = [...agg.keys()].filter((w) => /^[a-z][a-z'-]{1,}$/.test(w))
  const rows = await dictRows(lemmas, 'word, pos, meaning_ko, example_en, cefr_level, v_level, korean_learner_note, synonyms')
  const targets = []
  for (const [w, r] of rows) {
    if (r.korean_learner_note) continue
    if (!r.meaning_ko) continue
    const e = agg.get(w)
    targets.push({
      word: w,
      pos: r.pos,
      meaning_ko: r.meaning_ko,
      example_en: r.example_en ?? null,
      cefr: r.cefr_level,
      v: r.v_level,
      synonyms: (r.synonyms ?? []).slice(0, 4),
      books: e ? [...e.books].length : 0,
      freq: e ? e.freq : 0,
    })
  }
  targets.sort((a, b) => b.books - a.books || b.freq - a.freq)
  const n = writeChunks(DIR, targets, SIZE)
  console.log(`note targets: ${targets.length} · chunks: ${n} → ${DIR}/chunk-NN.json`)
  process.exit(0)
}

if (MODE === 'apply') {
  const { files, rows } = readOuts(DIR)
  const items = new Map()
  let bad = 0, skipped = 0
  for (const e of rows) {
    if (!e || typeof e.word !== 'string') { bad++; continue }
    if (e.skip === true || e.korean_learner_note == null) { skipped++; continue }
    const note = String(e.korean_learner_note).trim()
    // 게이트: 길이(10~140) · 한국어 포함 · 뜻 문자열 그대로 복사 금지
    if (note.length < 10 || note.length > 140 || !/[가-힣]/.test(note)) { bad++; continue }
    items.set(e.word.toLowerCase().trim(), note)
  }
  console.log(`files: ${files} · valid: ${items.size} · rejected: ${bad} · agent-skipped: ${skipped}`)

  const cur = await dictRows([...items.keys()], 'word, meaning_ko, korean_learner_note')
  let dup = 0
  for (const [w, r] of cur) {
    if (r.korean_learner_note) { items.delete(w); continue }           // 멱등
    if (r.meaning_ko && items.get(w) === r.meaning_ko.trim()) { items.delete(w); dup++ } // 뜻 복사 거부
  }
  for (const w of [...items.keys()]) if (!cur.has(w)) items.delete(w)  // 사전에 없는 단어 거부
  console.log(`to update: ${items.size} · meaning-copy rejected: ${dup}`)

  if (!COMMIT) {
    console.log('DRY-RUN (--commit 로 적용). 샘플:')
    let n = 0
    for (const [w, v] of items) { if (n++ >= 10) break; console.log(' ', w, '→', v) }
    process.exit(0)
  }

  let done = 0, failed = 0
  for (const [w, note] of items) {
    const { error } = await db.from('shared_dictionary').update({ korean_learner_note: note }).eq('word', w)
    if (error) { failed++; if (failed < 5) console.warn(w, error.message) } else done++
    if (done % 500 === 0 && done) console.log(`  … ${done}`)
  }
  console.log(`updated: ${done} · failed: ${failed}`)
  process.exit(0)
}

console.error('usage: node scripts/dict/w0815-note.mjs chunk|apply [--dir D] [--size N] [--commit]')
process.exit(1)
