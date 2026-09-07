// scripts/dict/w0815-synant.mjs
// T3c — antonyms · collocations 채움. 반대말 세트의 "짝 없음"과 카드 정답면의 연어 공백을 함께 해소.
//   대상 = published 도서 어휘 ∩ shared_dictionary 중 antonyms 또는 collocations 결측 (실측 7,458 / 6,219).
//   antonyms 는 억지 생성 금지 — 진짜 대립쌍이 없는 단어(구체명사 등)는 빈 배열로 두는 것이 정답.
//   collocations 는 실제로 쓰이는 2~3어 결합만(문장 아님).
//   apply : 자기 자신·중복·과다 개수 컷 + 반대말은 사전 실재어만 채택(짝 없는 세트 재발 차단).
// 실행: node scripts/dict/w0815-synant.mjs chunk [--dir D] [--size 120]
//       node scripts/dict/w0815-synant.mjs apply [--dir D] [--commit]
import { db, publishedVocab, dictRows, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0815-synant')
const SIZE = parseInt(arg('--size', '120'), 10)
const COMMIT = process.argv.includes('--commit')
const clean = (a) => [...new Set((Array.isArray(a) ? a : []).map((s) => String(s ?? '').trim()).filter(Boolean))]

if (MODE === 'chunk') {
  const agg = await publishedVocab()
  const lemmas = [...agg.keys()].filter((w) => /^[a-z][a-z'-]{1,}$/.test(w))
  const rows = await dictRows(lemmas, 'word, pos, meaning_ko, example_en, cefr_level, v_level, antonyms, collocations, synonyms')
  const targets = []
  for (const [w, r] of rows) {
    const needAnt = !(r.antonyms && r.antonyms.length)
    const needCol = !(r.collocations && r.collocations.length)
    if (!needAnt && !needCol) continue
    if (!r.meaning_ko) continue
    const e = agg.get(w)
    targets.push({
      word: w, pos: r.pos, meaning_ko: r.meaning_ko, example_en: r.example_en ?? null,
      cefr: r.cefr_level, v: r.v_level, synonyms: (r.synonyms ?? []).slice(0, 4),
      need: [needAnt ? 'antonyms' : null, needCol ? 'collocations' : null].filter(Boolean),
      books: e ? [...e.books].length : 0, freq: e ? e.freq : 0,
    })
  }
  targets.sort((a, b) => b.books - a.books || b.freq - a.freq)
  const n = writeChunks(DIR, targets, SIZE)
  const na = targets.filter((t) => t.need.includes('antonyms')).length
  const nc = targets.filter((t) => t.need.includes('collocations')).length
  console.log(`synant targets: ${targets.length} (ant ${na} · col ${nc}) · chunks: ${n} → ${DIR}/chunk-NN.json`)
  process.exit(0)
}

if (MODE === 'apply') {
  const { files, rows } = readOuts(DIR)
  const items = new Map()
  let bad = 0
  for (const e of rows) {
    if (!e || typeof e.word !== 'string') { bad++; continue }
    const w = e.word.toLowerCase().trim()
    const ant = clean(e.antonyms).filter((x) => x.toLowerCase() !== w && /^[a-zA-Z][a-zA-Z '-]*$/.test(x)).slice(0, 4)
    const col = clean(e.collocations).filter((x) => x.split(/\s+/).length >= 2 && x.split(/\s+/).length <= 4).slice(0, 5)
    if (!ant.length && !col.length) continue
    items.set(w, { ant, col })
  }
  console.log(`files: ${files} · words with payload: ${items.size} · malformed: ${bad}`)

  // 현재 값 확인(멱등) + 반대말 실재어 검증
  const cur = await dictRows([...items.keys()], 'word, antonyms, collocations')
  const antPool = [...new Set([...items.values()].flatMap((v) => v.ant.map((x) => x.toLowerCase())))]
  const antReal = await dictRows(antPool, 'word')
  let droppedAnt = 0
  const updates = []
  for (const [w, v] of items) {
    const c = cur.get(w)
    if (!c) continue
    const patch = {}
    if (!(c.antonyms && c.antonyms.length) && v.ant.length) {
      const real = v.ant.filter((x) => antReal.has(x.toLowerCase()))
      droppedAnt += v.ant.length - real.length
      if (real.length) patch.antonyms = real
    }
    if (!(c.collocations && c.collocations.length) && v.col.length) patch.collocations = v.col
    if (Object.keys(patch).length) updates.push([w, patch])
  }
  console.log(`to update: ${updates.length} · antonyms dropped (사전 미등재어): ${droppedAnt}`)

  if (!COMMIT) {
    console.log('DRY-RUN (--commit 로 적용). 샘플:')
    for (const [w, p] of updates.slice(0, 10)) console.log(' ', w, JSON.stringify(p))
    process.exit(0)
  }

  let done = 0, failed = 0
  for (const [w, patch] of updates) {
    const { error } = await db.from('shared_dictionary').update(patch).eq('word', w)
    if (error) { failed++; if (failed < 5) console.warn(w, error.message) } else done++
    if (done % 500 === 0 && done) console.log(`  … ${done}`)
  }
  console.log(`updated: ${done} · failed: ${failed}`)
  process.exit(0)
}

console.error('usage: node scripts/dict/w0815-synant.mjs chunk|apply [--dir D] [--size N] [--commit]')
process.exit(1)
