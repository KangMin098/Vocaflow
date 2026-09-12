// scripts/dict/w0816-exmatch.mjs
// T6 — 예문↔뜻 정합성. `example_en` 이 `meaning_ko` 와 다른 뜻·다른 품사를 보여주는 항목이 다수다
//   (`manifold` 뜻=다양한 / 예문=배기 다기관 · `lent` 뜻=빌려주다 / 예문=사순절 · `sty` 뜻=돼지우리 / 예문=눈 다래끼).
//   카드 앞뒤가 서로 모순된다. 진단: docs/AI_CONTEXT/diagnostics/dict_field_consistency_20260815.md §②③
//
// 수정 방향 — **예문만 고친다. 뜻은 건드리지 않는다.**
//   뜻이 틀려 보이는 항목은 `meaning_issue` 로 보고만 받고 REPORT.md 로 빼둔다(사람 판단 대상).
//   뜻을 자동 수정하면 맞는 뜻을 덮어쓸 위험이 삭제 위험보다 크다.
//
// 게이트: 새 예문은 표제어(또는 굴절형)를 포함 · 15~160자 · 아포스트로피 회피 · 기존 예문과 달라야 함.
// 실행: node scripts/dict/w0816-exmatch.mjs chunk [--dir D] [--size 120]
//       node scripts/dict/w0816-exmatch.mjs apply [--dir D] [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { db, publishedVocab, dictRows, writeChunks, readOuts } from './w0815-pubvocab.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const MODE = process.argv[2]
const DIR = arg('--dir', 'scripts/dict/w0816-exmatch')
const SIZE = parseInt(arg('--size', '120'), 10)
const COMMIT = process.argv.includes('--commit')

/** 표제어가 예문에 등장하는가 — 단순 굴절(-s/-es/-ed/-ing/-d/-ly) 허용. */
function containsWord(ex, word) {
  const stem = word.length > 4 ? word.slice(0, Math.max(4, word.length - 2)) : word
  return new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(ex)
}

if (MODE === 'chunk') {
  const agg = await publishedVocab()
  const lemmas = [...agg.keys()].filter((w) => /^[a-z][a-z'-]{1,}$/.test(w))
  const rows = await dictRows(lemmas, 'word, pos, meaning_ko, meanings_ko, example_en, cefr_level, v_level')
  const targets = []
  for (const [w, r] of rows) {
    if (!r.example_en || !r.meaning_ko) continue
    const e = agg.get(w)
    targets.push({
      word: w, pos: r.pos, meaning_ko: r.meaning_ko,
      all_meanings: Array.isArray(r.meanings_ko) ? r.meanings_ko.map((m) => `${m.pos}:${m.meaning}`) : [],
      example_en: r.example_en, cefr: r.cefr_level, v: r.v_level,
      books: e ? [...e.books].length : 0, freq: e ? e.freq : 0,
    })
  }
  targets.sort((a, b) => b.books - a.books || b.freq - a.freq)
  const n = writeChunks(DIR, targets, SIZE)
  console.log(`exmatch targets: ${targets.length} · chunks: ${n} → ${DIR}/chunk-NN.json`)
  process.exit(0)
}

if (MODE === 'apply') {
  const cur = new Map()
  for (const f of fs.readdirSync(DIR)) {
    if (!/^chunk-\d+\.json$/.test(f)) continue
    for (const e of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
      cur.set(e.word.toLowerCase(), { ex: e.example_en, meaning: e.meaning_ko })
    }
  }

  const { files, rows } = readOuts(DIR)
  const fixes = new Map()
  const meaningIssues = []
  let ok = 0, bad = 0, gateFail = 0
  for (const e of rows) {
    if (!e || typeof e.word !== 'string') { bad++; continue }
    const w = e.word.toLowerCase().trim()
    const c = cur.get(w)
    if (!c) { bad++; continue }
    if (e.meaning_issue && String(e.meaning_issue).trim()) {
      meaningIssues.push({ word: w, meaning_ko: c.meaning, issue: String(e.meaning_issue).trim() })
    }
    if (e.verdict === 'ok' || !e.example_en) { ok++; continue }
    const ex = String(e.example_en).trim()
    if (ex.length < 15 || ex.length > 160 || ex === c.ex || !containsWord(ex, w) || ex.includes("'")) { gateFail++; continue }
    fixes.set(w, ex)
  }
  console.log(`files: ${files} · 정합 판정(ok): ${ok} · 예문 교체 대상: ${fixes.size} · 게이트 탈락: ${gateFail} · malformed: ${bad}`)
  console.log(`뜻 이상 보고(자동수정 안 함): ${meaningIssues.length}`)

  fs.writeFileSync(path.join(DIR, 'MEANING_ISSUES.json'), JSON.stringify(meaningIssues, null, 1))

  if (!COMMIT) {
    console.log('DRY-RUN (--commit 로 적용). 샘플:')
    let n = 0
    for (const [w, ex] of fixes) { if (n++ >= 10) break; console.log(` ${w} (${cur.get(w).meaning})\n   before: ${cur.get(w).ex}\n   after : ${ex}`) }
    process.exit(0)
  }

  let done = 0, failed = 0
  for (const [w, ex] of fixes) {
    const { error } = await db.from('shared_dictionary').update({ example_en: ex }).eq('word', w)
    if (error) { failed++; if (failed < 5) console.warn(w, error.message) } else done++
    if (done % 500 === 0 && done) console.log(`  … ${done}`)
  }
  console.log(`updated: ${done} · failed: ${failed} · 뜻 이상 목록 → ${DIR}/MEANING_ISSUES.json`)
  process.exit(0)
}

console.error('usage: node scripts/dict/w0816-exmatch.mjs chunk|apply [--dir D] [--size N] [--commit]')
process.exit(1)
