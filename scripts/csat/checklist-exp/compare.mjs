// scripts/csat/checklist-exp/compare.mjs
//
// **실험 2 채점 — 체크리스트 답 → 규칙 판정을 회차 8·10 전문 판정과 대조한다(읽기 전용 · DB 0).**
//
// 합격선(criteria.md §9): 보관이 95% 이상으로 쏠린 모집단이라 κ 대신 **일치율 90% 이상**, 그리고 비교 기준선으로
// 같은 회차의 **판정자끼리 일치율**(이중 판정)을 함께 낸다 — 사람이 아니라 판정자 둘이 서로 맞는 만큼이 현실적인 천장이다.
// 표본은 판정값별로 층화했으므로(export.mjs) 전체 일치율은 **모집단 비율로 가중**해 되돌린다.
//
// **거름망 지표**(실험 2 v2 이후): 체크리스트가 keep 이라 한 것만 바로 확정하고 나머지는 전문 판정으로 보낸다고 볼 때의
// 바로 확정 비율 · 그 안의 오판율 · 정답 폐기가 보관으로 새는 비율 — 모두 모집단 가중.
//
// 답 파일 고르기:
//   (기본)          chunk-NN.out.json
//   --suffix hA     chunk-NN.hA.out.json (다른 판정자·다른 모델의 답)
//   --both hA,hB    두 벌 모두 keep 일 때만 keep — 둘이 갈리면 keep 이 아닌 쪽의 결정을 쓴다(두 번 일치 확신도)
//
// 실행: node scripts/csat/checklist-exp/compare.mjs [--work <dir>] [--suffix <s> | --both <a,b>] [--json out.json]

import fs from 'node:fs'
import path from 'node:path'

import { decide, missingAnswers } from './decide.mjs'

const argOf = (k) => (process.argv.includes(`--${k}`) ? process.argv[process.argv.indexOf(`--${k}`) + 1] : null)
const WORK = path.resolve(argOf('work') ?? 'scripts/csat/checklist-exp/work')
const key = JSON.parse(fs.readFileSync(path.join(WORK, 'key.json'), 'utf8'))

function loadAnswers(suffix) {
  const re = suffix ? new RegExp(`^chunk-\\d+\\.${suffix}\\.out\\.json$`) : /^chunk-\d+\.out\.json$/
  const m = new Map()
  for (const f of fs.readdirSync(WORK).filter((x) => re.test(x)).sort()) {
    for (const o of JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'))) m.set(o.id, { ...o, chunk: f })
  }
  return m
}

const BOTH = argOf('both')?.split(',')
const answers = BOTH ? loadAnswers(BOTH[0]) : loadAnswers(argOf('suffix'))
const answersB = BOTH ? loadAnswers(BOTH[1]) : null
let splitPairs = 0

const V = ['keep', 'hold', 'discard']
const confusion = Object.fromEntries(V.map((t) => [t, Object.fromEntries(V.map((p) => [p, 0]))]))
const rules = {}
const errors = []
let missing = 0
let malformed = 0
let second = { n: 0, truthVsSecond: 0, checklistVsTruth: 0 }

for (const it of key.items) {
  const a = answers.get(it.id)
  if (!a) { missing++; continue }
  if (missingAnswers(a.answers).length) { malformed++; continue }
  let d = decide(a.answers)
  if (answersB) {
    const b = answersB.get(it.id)
    if (!b) { missing++; continue }
    if (missingAnswers(b.answers).length) { malformed++; continue }
    const db = decide(b.answers)
    if (db.retention !== d.retention) splitPairs++
    if (d.retention === 'keep' && db.retention !== 'keep') d = { ...db, rule: `split:${db.rule}` }
  }
  confusion[it.truth][d.retention]++
  rules[d.rule] = rules[d.rule] ?? { n: 0, agree: 0 }
  rules[d.rule].n++
  if (d.retention === it.truth) rules[d.rule].agree++
  else errors.push({ id: it.id, source: it.source, truth: it.truth, got: d.retention, rule: d.rule, second: it.second, truth_why: it.why, note: a.note, chunk: a.chunk })
  if (it.second) {
    second.n++
    if (it.second === it.truth) second.truthVsSecond++
    if (d.retention === it.truth) second.checklistVsTruth++
  }
}

const rowTotal = (t) => V.reduce((s, p) => s + confusion[t][p], 0)
const recall = Object.fromEntries(V.map((t) => [t, rowTotal(t) ? confusion[t][t] / rowTotal(t) : null]))
const popTotal = V.reduce((s, t) => s + key.population[t], 0)
// 모집단 가중 일치율 = Σ_t (모집단 비율_t × 표본 재현율_t)
const weighted = V.reduce((s, t) => s + (key.population[t] / popTotal) * (recall[t] ?? 0), 0)
const raw = V.reduce((s, t) => s + confusion[t][t], 0) / V.reduce((s, t) => s + rowTotal(t), 0)
// 방향이 다른 두 오류 — 보관할 것을 폐기(되돌리기 어렵다) · 폐기할 것을 보관(판정 한 번 더 든다)
const keepToDiscard = confusion.keep.discard
const discardToKeep = confusion.discard.keep

// 거름망 — 모집단 비율 × 「체크리스트가 keep 이라 한 비율」
const share = Object.fromEntries(V.map((t) => [t, key.population[t] / popTotal]))
const keptRate = Object.fromEntries(V.map((t) => [t, rowTotal(t) ? confusion[t].keep / rowTotal(t) : 0]))
const autoKeep = V.reduce((s, t) => s + share[t] * keptRate[t], 0)
const filter = {
  autoKeep,
  wrongInAutoKeep: autoKeep ? (share.hold * keptRate.hold + share.discard * keptRate.discard) / autoKeep : 0,
  discardLeak: keptRate.discard,
  splitPairs,
}

const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)
console.log(`  표본 ${key.items.length} · 답 ${answers.size} · 빠짐 ${missing} · 형식 오류 ${malformed}`)
console.log('  정답\\규칙      keep   hold  discard   재현율')
for (const t of V) console.log(`  ${t.padEnd(10)} ${V.map((p) => String(confusion[t][p]).padStart(6)).join(' ')}   ${pct(recall[t])}`)
console.log(`  표본 일치율 ${pct(raw)} · 모집단 가중 일치율 ${pct(weighted)} (합격선 90%)`)
console.log(`  keep→discard ${keepToDiscard} · discard→keep ${discardToKeep}`)
console.log(`  거름망: 바로 보관 확정 ${pct(filter.autoKeep)} · 그 안 오판 ${pct(filter.wrongInAutoKeep)} · 폐기 누수 ${pct(filter.discardLeak)}${answersB ? ` · 두 벌이 갈린 편 ${splitPairs}` : ''}`)
if (second.n) console.log(`  이중 판정 ${second.n}편: 판정자끼리 ${pct(second.truthVsSecond / second.n)} · 체크리스트↔정답 ${pct(second.checklistVsTruth / second.n)}`)
console.log('  규칙별 (결정 수 · 정답과 같음)')
for (const [r, v] of Object.entries(rules).sort((x, y) => y[1].n - x[1].n)) console.log(`    ${r.padEnd(24)} ${String(v.n).padStart(4)} · ${v.agree}`)

const out = path.resolve(process.argv[process.argv.indexOf('--json') + 1] ?? '')
if (process.argv.includes('--json')) {
  fs.writeFileSync(out, JSON.stringify({ population: key.population, confusion, recall, raw, weighted, keepToDiscard, discardToKeep, filter, second, rules, errors, missing, malformed }, null, 1) + '\n')
  console.log(`  → ${out}`)
}
