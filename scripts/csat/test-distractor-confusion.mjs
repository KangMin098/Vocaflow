// scripts/csat/test-distractor-confusion.mjs
//
// **난도가 문항의 어디서 오는가 — 오답 매력도를 선택률 없이 잰다.**
//
// 이 저장소는 처음부터 *"오답 매력도는 선택률 자료가 있어야 관측된다"* 로 남겨 두었다
// (CSAT_BLUEPRINT §6-1). 문헌은 **선택률 없이 재는 두 측도**를 쓴다:
//
//   **혼동도(confusion)**   = 정답 ↔ 오답 유사도.  오답이 정답과 닮을수록 고르기 어렵다
//   **접근성(accessibility)** = 지문 ↔ 정답 유사도.  정답이 지문과 닮을수록 찾기 쉽다
//
// 근거: 선택지 사이 의미 유사도가 문항 난도에 **가장 큰 영향**을 준다는 보고
//   · Ludewig, Schwerter & McElvany (2023), *J. Psychoeducational Assessment*
//   · 옵션 타당도 기반 난도 분해 (AI 2026, 7(7):249)
//
// 이 검정이 §6.10.6 의 빈칸을 겨눈다 — 문헌과 이 저장소가 함께 "난도는 지문이 아니라
// 문항에 있다" 까지 왔는데, **문항의 무엇인지**는 아직 아무도 여기서 안 쟀다.
//
// ⚠️ 어휘 유사도는 정답↔지문에서는 약하다(선지의 32%가 지문과 0겹침).
//    그러나 **선지끼리는** 같은 소재·같은 문법 틀로 쓰이므로 어휘가 겹친다 — 도구가 통한다.
//
// 실행: pnpm dlx tsx scripts/csat/test-distractor-confusion.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, choicesOf, answerOf, allRows } from './lib-passage.mjs'
import { report } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')

// 영어 선지 유형만 — 한글·기호 선지는 선지끼리 어휘 비교가 안 되거나 무의미하다
const TYPES = ['R-BLANK', 'R-TOPIC', 'R-TITLE', 'R-IMPLY', 'R-SUMMARY', 'R-MOOD']

const STOP = new Set(('a an the of to in on for and or is are was were be been being it its this that these those with as by at from he she they we you i his her their our your them us him can could may might will would shall should must do does did done have has had having but so than then there here what which who whom whose when where why how all any both each few more most other some such only own same too very just also into over under about after before between out up down off again further once').split(' '))
const stem = (w) => w.replace(/(ing|ions|ion|ers|er|ies|es|ed|ly|s)$/, '')
const toks = (s) => (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem)

const items = []
for (const r of allRows().filter((x) => TYPES.includes(x.type))) {
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const p = passageOf(b), ch = choicesOf(b), a = answerOf(r.exam, r.no)
  if (p.length < 150 || !ch || !ch.every((c) => toks(c).length >= 2) || !a || a.answer < 1 || a.answer > 5) continue
  items.push({ exam: r.exam, no: r.no, type: r.type, points: a.points, passage: p, choices: ch, answer: a.answer })
}

// IDF — 선지 전체에서 (선지끼리 비교하므로 선지 말뭉치가 맞다)
const df = new Map()
for (const it of items) for (const c of it.choices) for (const w of new Set(toks(c))) df.set(w, (df.get(w) ?? 0) + 1)
const N = items.reduce((s, it) => s + it.choices.length, 0)
const idf = (w) => Math.log((N + 1) / ((df.get(w) ?? 0) + 1)) + 1

/** 대칭 IDF 가중 유사도 */
function sim(a, b) {
  const A = new Set(toks(a)), B = new Set(toks(b))
  if (!A.size || !B.size) return 0
  let i = 0, u = 0
  for (const w of new Set([...A, ...B])) { const v = idf(w); u += v; if (A.has(w) && B.has(w)) i += v }
  return u ? i / u : 0
}

for (const it of items) {
  const key = it.choices[it.answer - 1]
  const dis = it.choices.filter((_, i) => i !== it.answer - 1)
  // 혼동도 — 정답과 오답들의 평균 유사도 (높을수록 헷갈린다)
  it.confusion = dis.reduce((s, d) => s + sim(key, d), 0) / dis.length
  // 최대 혼동 — 가장 닮은 오답 하나 (실제로 사람을 잡는 것은 이쪽일 수 있다)
  it.maxConfusion = Math.max(...dis.map((d) => sim(key, d)))
  // 오답들끼리의 유사도 — 통제 변수(선지 세트 전체가 촘촘한가)
  let dd = 0, n = 0
  for (let i = 0; i < dis.length; i += 1) for (let j = i + 1; j < dis.length; j += 1) { dd += sim(dis[i], dis[j]); n += 1 }
  it.distractorCohesion = n ? dd / n : 0
  // 접근성 — 지문과 정답의 유사도
  it.accessibility = sim(it.passage, key)
  // ⭐ 지문 미끼 — 오답이 **지문**과 얼마나 닮았는가.
  //    문헌은 key↔distractor 혼동을 상정하지만, 이 저장소의 앞선 실측은
  //    3점 오답이 **지문 어휘로 두껍게 위장**돼 있다고 했다(26.8% vs 12.2%, P4.3).
  //    그렇다면 미끼는 "정답과 닮은 것" 이 아니라 "지문과 닮은 것" 이다.
  it.distractorPassage = dis.reduce((s, d) => s + sim(it.passage, d), 0) / dis.length
  //    정답보다 지문에 더 붙은 오답이 있는가 (미끼의 직접 형태)
  it.baitGap = it.distractorPassage - it.accessibility
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
function perm(a, b, iters = 20000) {
  const obs = mean(a) - mean(b)
  const pool = [...a, ...b], na = a.length
  let seed = 5150
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  let ge = 0
  for (let k = 0; k < iters; k += 1) {
    const q = [...pool]
    for (let i = q.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1));[q[i], q[j]] = [q[j], q[i]] }
    if (Math.abs(mean(q.slice(0, na)) - mean(q.slice(na))) >= Math.abs(obs)) ge += 1
  }
  return { obs, p: (ge + 1) / (iters + 1) }
}

const p3 = items.filter((x) => x.points === 3), p2 = items.filter((x) => x.points === 2)
console.log('오답 매력도 — 선택률 없이 재는 두 측도')
console.log('='.repeat(76))
console.log(`  문항 ${items.length} (3점 ${p3.length} · 2점 ${p2.length}) · 유형 ${TYPES.join(' · ')}`)
console.log(`  ⚠️ 3점은 출제자의 의도다. 회차 실난도와의 대조는 아래 ②.`)
console.log()
console.log('  ① 3점 vs 2점')
console.log('  ' + '-'.repeat(72))
console.log('  측도                          3점       2점        차     순열 p')
const M = [
  ['혼동도 (정답↔오답 평균)', 'confusion'],
  ['최대 혼동 (가장 닮은 오답)', 'maxConfusion'],
  ['오답끼리 유사도 (통제)', 'distractorCohesion'],
  ['접근성 (지문↔정답)', 'accessibility'],
  ['⭐지문 미끼 (지문↔오답)', 'distractorPassage'],
  ['⭐미끼 격차 (오답−정답)', 'baitGap'],
]
const out = {}
for (const [name, key] of M) {
  const a = p3.map((x) => x[key]), b = p2.map((x) => x[key])
  const r = perm(a, b)
  out[key] = { p3: mean(a), p2: mean(b), ...r }
  console.log(`  ${name.padEnd(27)} ${mean(a).toFixed(4).padStart(7)} ${mean(b).toFixed(4).padStart(9)} ${r.obs.toFixed(4).padStart(9)} ${r.p.toFixed(4).padStart(9)}`)
}
console.log()

// ── ② 회차 실난도와의 상관 ────────────────────────────────────────────
const GRADE1 = {
  2018: 10.03, 2019: 5.30, 2020: 7.43, 2021: 12.66, 2022: 6.25,
  2023: 7.83, 2024: 4.71, 2025: 6.22, 2026: 3.11,
  M2606: 19.10, M2609: 4.50, M2706: 4.13,
}
const byExam = {}
for (const it of items) { if (it.exam in GRADE1) (byExam[it.exam] ??= []).push(it) }
const exams = Object.keys(byExam).sort()
function pearson(x, y) {
  const mx = mean(x), my = mean(y)
  let n = 0, dx = 0, dy = 0
  for (let i = 0; i < x.length; i += 1) { const a = x[i] - mx, b = y[i] - my; n += a * b; dx += a * a; dy += b * b }
  return dx && dy ? n / Math.sqrt(dx * dy) : 0
}
function permR(x, y, iters = 20000) {
  const obs = pearson(x, y)
  let seed = 991, ge = 0
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  for (let k = 0; k < iters; k += 1) {
    const q = [...y]
    for (let i = q.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1));[q[i], q[j]] = [q[j], q[i]] }
    if (Math.abs(pearson(x, q)) >= Math.abs(obs)) ge += 1
  }
  return { r: obs, p: (ge + 1) / (iters + 1) }
}
const g1 = exams.map((e) => GRADE1[e])
console.log(`  ② 회차 실난도(1등급 비율)와의 상관 — n=${exams.length}`)
console.log('  ' + '-'.repeat(72))
console.log('  측도                              r      순열 p')
const out2 = {}
for (const [name, key] of M) {
  const v = exams.map((e) => mean(byExam[e].map((x) => x[key])))
  const r = permR(g1, v)
  out2[key] = r
  console.log(`  ${name.padEnd(29)} ${r.r.toFixed(3).padStart(7)} ${r.p.toFixed(4).padStart(10)}`)
}
console.log()

const sig1 = Object.values(out).filter((x) => x.p < 0.05).length
const sig2 = Object.values(out2).filter((x) => x.p < 0.05).length
console.log('  판정')
console.log('  ' + '-'.repeat(72))
console.log(`    ① 3점/2점을 가르는 측도 ${sig1}/${M.length} · ② 회차 실난도와 상관 있는 측도 ${sig2}/${M.length}`)
console.log()
if (sig1 === 0 && sig2 === 0) {
  console.log('  → **오답 매력도로도 난도가 안 갈린다.** 지문에 이어 선지 어휘도 아니다.')
} else {
  console.log('  → 위 표에서 유의한 측도를 볼 것 — **난도가 문항의 어디서 오는지**의 첫 단서다.')
}
console.log()
console.log('  ⚠️ 이 도구는 **어휘 유사도**다. 의미로만 닮은 오답(같은 뜻 다른 낱말)은 못 잡는다.')
console.log('     선지끼리는 소재·문법 틀이 같아 어휘가 겹치므로 지문↔정답보다는 통하지만, 상한이 있다.')

fs.writeFileSync(path.join(DIR, 'distractor-confusion.json'), JSON.stringify({
  n: items.length, n3: p3.length, n2: p2.length, byPoints: out, byExamCorr: out2,
  // ⚠️ distractorPassage · baitGap 을 빠뜨리면 이 파일을 읽는 검사가 조용히 NaN 을 쓴다
  //    (test-bait-agreement 가 그것 때문에 모든 문항을 'B' 로 찍어 카파 0 을 냈다)
  rows: items.map((x) => ({
    exam: x.exam, no: x.no, type: x.type, points: x.points,
    confusion: x.confusion, maxConfusion: x.maxConfusion, distractorCohesion: x.distractorCohesion,
    accessibility: x.accessibility, distractorPassage: x.distractorPassage, baitGap: x.baitGap,
  })),
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'distractor-confusion.json')}`)
