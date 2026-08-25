// scripts/csat/test-p44-p45-distractor.mjs
//
// **P4.4 "오답은 방향 반전" · P4.5 "오답은 주제 아닌 세부사항" 을 전수로 건다.**
//
// 두 명제 다 **문항 안에서 정답과 오답을 같은 자로 재면** 기저 문제가 사라진다.
// 짝지음 설계다 — 문항마다 정답 1 · 오답 4 를 비교하므로 지문 난이도·길이가 자동으로 통제된다.
//
//   P4.4  오답이 정답보다 **부정 표지**를 더 자주 단다
//         (방향 반전을 만드는 가장 흔한 수단이 부정이다)
//
//   P4.5  오답은 **국소적으로만** 지문에 붙어 있다
//         측정: (그 선지와 가장 닮은 한 문장의 유사도) − (지문 전체와의 유사도)
//         이 값이 크면 "한 군데는 닮았는데 글 전체와는 겉돈다" = 세부사항 미끼
//         정답은 글 전체의 재진술이므로 이 격차가 작아야 한다
//
// ⚠️ 부정 표지는 **접두사 통짜 매칭을 하면 안 된다** — information·increase·independent 가
//    전부 걸린다. 명시적 부정어 + 손으로 고른 결여 어휘만 온전한 낱말로 맞춘다.
//    이 도구가 약하다는 것은 결과 해석에 적는다.
//
// 실행: pnpm dlx tsx scripts/csat/test-p44-p45-distractor.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, choicesOf, sentences, answerOf, allRows } from './lib-passage.mjs'
import { fisher, report } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const rows = allRows()   // 수능 14 + 모평 3

// 영어 선지 유형만 (한글 선지는 어휘 비교가 안 된다)
const TYPES = ['R-BLANK', 'R-TOPIC', 'R-TITLE', 'R-IMPLY', 'R-SUMMARY']

const STOP = new Set(('a an the of to in on for and or is are was were be been being it its this that these those with as by at from he she they we you i his her their our your them us him can could may might will would shall should must do does did done have has had having but so than then there here what which who whom whose when where why how all any both each few more most other some such only own same too very just also into over under about after before between out up down off again further once').split(' '))
const stem = (w) => w.replace(/(ing|ions|ion|ers|er|ies|es|ed|ly|s)$/, '')
const toks = (s) => (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem)

// ── 부정 표지 — 온전한 낱말로만 맞춘다 ────────────────────────────────
const NEG_WORDS = new Set([
  'not', 'no', 'never', 'none', 'nor', 'without', 'cannot', 'nothing', 'neither',
  'lack', 'lacks', 'lacking', 'fail', 'fails', 'failing', 'failure', 'absence', 'absent',
  'loss', 'lose', 'losing', 'lost', 'decline', 'declining', 'decrease', 'decreasing',
  'reduce', 'reducing', 'reduced', 'limit', 'limits', 'limited', 'limiting', 'limitation',
  'restrict', 'restricted', 'restricting', 'prevent', 'preventing', 'avoid', 'avoiding',
  'weaken', 'weakening', 'weak', 'less', 'fewer', 'least', 'rarely', 'hardly', 'seldom',
  'ignore', 'ignoring', 'reject', 'rejecting', 'deny', 'denying', 'refuse', 'oppose',
  'inability', 'unable', 'impossible', 'irrelevant', 'inadequate', 'insufficient',
  'unnecessary', 'unlikely', 'unaware', 'undermine', 'undermining', 'disregard',
  'overlook', 'overlooking', 'misunderstand', 'misleading', 'meaningless', 'useless',
])
const negCount = (s) => (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => NEG_WORDS.has(w)).length

const items = []
for (const it of rows.filter((r) => TYPES.includes(r.type))) {
  const b = itemBlocks(it.exam, it.no)[0]
  if (!b) continue
  const p = passageOf(b), ch = choicesOf(b), a = answerOf(it.exam, it.no)
  if (p.length < 150 || !ch || !ch.every((c) => c.length > 3) || !a || a.answer < 1 || a.answer > 5) continue
  items.push({ exam: it.exam, no: it.no, type: it.type, points: a.points, passage: p, choices: ch, answer: a.answer })
}

const df = new Map()
for (const it of items) for (const w of new Set(toks(it.passage))) df.set(w, (df.get(w) ?? 0) + 1)
const N = items.length
const idf = (w) => Math.log((N + 1) / ((df.get(w) ?? 0) + 1)) + 1
function sim(choice, text) {
  const c = [...new Set(toks(choice))]
  if (!c.length) return 0
  const T = new Set(toks(text))
  let hit = 0, tot = 0
  for (const w of c) { const v = idf(w); tot += v; if (T.has(w)) hit += v }
  return tot ? hit / tot : 0
}

for (const it of items) {
  const sents = sentences(it.passage)
  it.per = it.choices.map((c, i) => {
    const maxS = Math.max(0, ...sents.map((s) => sim(c, s)))
    const whole = sim(c, it.passage)
    return { i, isAns: i + 1 === it.answer, neg: negCount(c), maxS, whole, gap: maxS - whole }
  })
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)

console.log('P4.4 · P4.5 — 오답 설계 두 명제 (문항 내 짝지음)')
console.log('='.repeat(74))
console.log(`  대상 ${items.length}문항 · 선지 ${items.length * 5}개`)
console.log(`  유형: ${TYPES.join(' · ')}`)
console.log()

// ── P4.4 ─────────────────────────────────────────────────────────────
const ansNeg = items.filter((it) => it.per.find((x) => x.isAns).neg > 0).length
const disNegTot = items.reduce((s, it) => s + it.per.filter((x) => !x.isAns && x.neg > 0).length, 0)
const disTot = items.length * 4
console.log('  P4.4 — 오답이 부정 표지를 더 다는가')
console.log('  ' + '-'.repeat(70))
console.log(`    정답 중 부정 표지 있음  ${ansNeg}/${items.length} = ${pct(ansNeg, items.length)}%`)
console.log(`    오답 중 부정 표지 있음  ${disNegTot}/${disTot} = ${pct(disNegTot, disTot)}%`)
const p44 = fisher(ansNeg, items.length - ansNeg, disNegTot, disTot - disNegTot)
console.log(`    Fisher p = ${p44.toFixed(4)}`)
console.log()

// ── P4.5 ─────────────────────────────────────────────────────────────
const ansGap = items.map((it) => it.per.find((x) => x.isAns).gap)
const disGap = items.flatMap((it) => it.per.filter((x) => !x.isAns).map((x) => x.gap))
// 문항 내 짝지음 — 각 문항에서 오답 평균 gap 이 정답 gap 보다 큰가
// ⚠️ **동점을 실패로 세면 안 된다.** 선지의 31.9% 는 지문과 내용어를 하나도 안 겹쳐
//    maxSent=0·whole=0 → gap 이 정확히 0 이다. 그런 문항은 이 자로 잴 수 없는 것이지
//    가설에 반하는 것이 아니다. 동점을 뺀 **부호검정**이 맞다.
//    (첫 판은 동점 43건을 실패로 세어 30.7%·p=1.0 이라는 "역방향" 오판을 냈다)
const diffs = items.map((it) => {
  const a = it.per.find((x) => x.isAns).gap
  const d = mean(it.per.filter((x) => !x.isAns).map((x) => x.gap))
  return d - a
})
const EPS = 1e-9
const winners = diffs.filter((x) => x > EPS).length
const losers = diffs.filter((x) => x < -EPS).length
const ties = diffs.filter((x) => Math.abs(x) <= EPS).length
const decided = winners + losers
console.log('  P4.5 — 오답이 국소적으로만 붙어 있는가 (최대문장유사 − 전체유사)')
console.log('  ' + '-'.repeat(70))
console.log(`    정답 평균 격차  ${mean(ansGap).toFixed(4)}`)
console.log(`    오답 평균 격차  ${mean(disGap).toFixed(4)}`)
const { binomUpper } = await import('./claim-gate.mjs')
const zeroChoices = items.reduce((s, it) => s + it.per.filter((x) => x.maxS === 0 && x.whole === 0).length, 0)
console.log(`    문항 내 부호검정 — 오답이 더 국소적 ${winners} · 정답이 더 국소적 ${losers} · 동점 ${ties}`)
console.log(`      동점 제외  ${winners}/${decided} = ${pct(winners, decided)}%  (기저 50%)  이항 p = ${binomUpper(decided, winners, 0.5).toFixed(4)}`)
console.log()
console.log(`    ⚠️ 동점이 ${ties}건이나 되는 이유 — 선지 ${zeroChoices}/${items.length * 5} = ${pct(zeroChoices, items.length * 5)}% 가`)
console.log(`       지문과 내용어를 **하나도 안 겹친다**(maxSent=0·whole=0 → gap=0).`)
console.log(`       이 자로는 그 문항을 잴 수 없는 것이지 가설에 반하는 것이 아니다.`)
console.log()

// 유형별로 갈리는가 (G1)
console.log('  유형별 — P4.5 문항 내 승률')
const byType = {}
for (const it of items) {
  const a = it.per.find((x) => x.isAns).gap
  const d = mean(it.per.filter((x) => !x.isAns).map((x) => x.gap))
  const t = (byType[it.type] ??= { n: 0, w: 0 })
  if (Math.abs(d - a) <= EPS) continue      // 동점은 유형별 집계에서도 뺀다
  t.n += 1
  if (d > a) t.w += 1
}
for (const [t, v] of Object.entries(byType)) console.log(`    ${t.padEnd(11)} ${v.w}/${v.n} = ${pct(v.w, v.n)}%`)
console.log()

report({
  name: 'P4.5 — 오답은 지문에 국소적으로만 붙어 있다  [검사]',
  hit: winners, n: decided, baseRate: 0.5, shape: 'count-vs-baserate',
  falsifier: '오답의 국소-전역 격차가 정답과 같거나 작으면 깨진다 — 오답이 세부사항 미끼가 아니라는 뜻이다',
  subgroups: Object.entries(byType).map(([label, v]) => ({ label, hit: v.w, n: v.n })),
  perExam: [...new Set(items.map((x) => x.exam))].map((e) => ({
    exam: e,
    hit: items.filter((x) => {
      if (x.exam !== e) return false
      const a = x.per.find((y) => y.isAns).gap
      return mean(x.per.filter((y) => !y.isAns).map((y) => y.gap)) > a
    }).length,
    n: items.filter((x) => x.exam === e).length,
  })),
})

fs.writeFileSync(path.join(DIR, 'p44-p45-distractor.json'), JSON.stringify({
  n: items.length, ansNeg, disNegTot, disTot, p44,
  ansGapMean: mean(ansGap), disGapMean: mean(disGap), winners, byType,
  rows: items.map((x) => ({ exam: x.exam, no: x.no, type: x.type, points: x.points, per: x.per })),
}, null, 1))
console.log(`→ ${path.join(DIR, 'p44-p45-distractor.json')}`)
