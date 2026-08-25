// scripts/csat/test-p41-topic-answer.mjs
//
// **P4.1 / V4 — 책의 핵심 명제 "주제 = 정답" 을 전수로 건다.**
//
// "정답은 주제의 재진술이다" 는 그대로는 거의 동어반복이라 검증이 안 된다.
// 기계로 잴 수 있는 형태로 바꾼다:
//
//   **정답 선지는 지문의 어떤 한 문장과 가장 가깝고, 오답 넷은 그렇지 않다.**
//
// 기저가 명확하다 — 다섯 선지 중 무작위로 하나면 **20%** 다.
//
// 그리고 이 검사에는 **대조군이 설계상 들어 있다.** 빈칸(31~34)은 정답이 곧
// **지워진 문장**이므로 지문에 남아 있지 않다. 그러므로 같은 자로 재면
//
//   대의파악(주제·제목) → 정답이 지문 문장과 가깝다  (주제를 **묻는다**)
//   빈칸               → 그렇지 않다                 (주제를 **비운다**)
//
// 두 유형이 갈리면 이 저장소가 손표본에서 본 8/8 vs 0/3 이 전수로 재현되는 것이다.
//
// 유사도 — 임베딩이 없으므로 **IDF 가중 내용어 겹침**을 쓴다. 투명하고 재현된다.
//   · IDF 는 이 저장소의 지문 전체(93편)에서 낸다
//   · 어간을 대충 맞춰 refining/refine 을 같은 것으로 본다
//
// 실행: pnpm dlx tsx scripts/csat/test-p41-topic-answer.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, choicesOf, sentences, answerOf, allRows } from './lib-passage.mjs'
import { binomUpper, fisher, report } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const rows = allRows()   // 수능 14 + 모평 3

const STOP = new Set(('a an the of to in on for and or not is are was were be been being it its this that these those with as by at from he she they we you i his her their our your them us him one ones can could may might will would shall should must do does did done have has had having but so than then there here what which who whom whose when where why how all any both each few more most other some such no nor only own same too very just also into over under about after before between out up down off again further once s t don now').split(' '))
const stem = (w) => w.replace(/(ing|ions|ion|ers|er|ies|es|ed|ly|s)$/, '')
const toks = (s) => (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem)

// ── 대상 ──────────────────────────────────────────────────────────────
const GROUPS = {
  '대의파악 (주제·제목)': ['R-TOPIC', 'R-TITLE'],
  '빈칸 (31~34)': ['R-BLANK'],
  '요약 (40)': ['R-SUMMARY'],
}

const items = []
for (const [g, types] of Object.entries(GROUPS)) {
  for (const it of rows.filter((r) => types.includes(r.type))) {
    const b = itemBlocks(it.exam, it.no)[0]
    if (!b) continue
    const p = passageOf(b), ch = choicesOf(b), a = answerOf(it.exam, it.no)
    if (p.length < 150 || !ch || !ch.every((c) => c.length > 3) || !a || a.answer < 1 || a.answer > 5) continue
    items.push({ group: g, exam: it.exam, no: it.no, type: it.type, passage: p, choices: ch, answer: a.answer, points: a.points })
  }
}

// ── IDF — 지문 전체에서 ────────────────────────────────────────────────
const df = new Map()
for (const it of items) for (const w of new Set(toks(it.passage))) df.set(w, (df.get(w) ?? 0) + 1)
const N = items.length
const idf = (w) => Math.log((N + 1) / ((df.get(w) ?? 0) + 1)) + 1

/** 두 문자열의 IDF 가중 겹침 — 선지 쪽 길이로 정규화한다 */
function sim(choice, text) {
  const c = [...new Set(toks(choice))]
  if (!c.length) return 0
  const T = new Set(toks(text))
  let hit = 0, tot = 0
  for (const w of c) { const v = idf(w); tot += v; if (T.has(w)) hit += v }
  return tot ? hit / tot : 0
}

// ── 측정 ──────────────────────────────────────────────────────────────
for (const it of items) {
  const sents = sentences(it.passage)
  it.perChoice = it.choices.map((c) => ({
    maxSent: Math.max(0, ...sents.map((s) => sim(c, s))),   // 가장 가까운 한 문장
    whole: sim(c, it.passage),                              // 지문 전체
  }))
  const rank = (key) => {
    const v = it.perChoice.map((x, i) => ({ i, v: x[key] })).sort((a, b) => b.v - a.v)
    return v.findIndex((x) => x.i === it.answer - 1) + 1
  }
  it.rankSent = rank('maxSent')
  it.rankWhole = rank('whole')
}

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
console.log('P4.1 / V4 — "정답은 지문의 한 문장과 가장 가깝다" 전수 검정')
console.log('='.repeat(78))
console.log(`  대상 ${items.length}문항 · IDF 는 이 ${N}편 지문에서 산출`)
console.log()
console.log('  집단                     문항   1위(문장)  비율    1위(전체)  비율   기저')
console.log('  ' + '-'.repeat(74))

const stats = {}
for (const g of Object.keys(GROUPS)) {
  const a = items.filter((x) => x.group === g)
  if (!a.length) continue
  const s1 = a.filter((x) => x.rankSent === 1).length
  const w1 = a.filter((x) => x.rankWhole === 1).length
  stats[g] = { n: a.length, s1, w1, items: a }
  console.log(
    `  ${g.padEnd(22)} ${String(a.length).padStart(4)} ${String(s1).padStart(10)} ${String(pct(s1, a.length)).padStart(6)}% ` +
    `${String(w1).padStart(10)} ${String(pct(w1, a.length)).padStart(6)}%    20%`,
  )
}
console.log()

for (const [g, s] of Object.entries(stats)) {
  console.log(`  ${g}  1위(문장) 이항 p = ${binomUpper(s.n, s.s1, 0.2).toExponential(2)}`)
}
console.log()

// ── 핵심 대조 — 대의파악 vs 빈칸 ────────────────────────────────────────
const A = stats['대의파악 (주제·제목)'], B = stats['빈칸 (31~34)']
if (A && B) {
  const p = fisher(A.s1, A.n - A.s1, B.s1, B.n - B.s1)
  console.log('  ── 핵심 대조 ──')
  console.log(`  대의파악 ${A.s1}/${A.n} = ${pct(A.s1, A.n)}%   vs   빈칸 ${B.s1}/${B.n} = ${pct(B.s1, B.n)}%`)
  console.log(`  Fisher p = ${p.toFixed(5)}`)
  console.log()
  console.log('  → 대의파악은 주제를 **묻고**, 빈칸은 주제를 **비운다.**')
  console.log('    같은 자로 재면 정답이 지문에 남아 있는가에서 갈린다.')
  console.log()

  report({
    name: 'P4.1 — 대의파악 정답은 지문의 한 문장과 가장 가깝다  [검사]',
    hit: A.s1, n: A.n, baseRate: 0.2, shape: 'count-vs-baserate',
    falsifier: '정답이 다섯 선지 중 1위가 되는 비율이 20% 언저리면 깨진다 — 재진술이 정답의 성질이 아니다',
    subgroups: [
      { label: '주제(23)', hit: A.items.filter((x) => x.type === 'R-TOPIC' && x.rankSent === 1).length, n: A.items.filter((x) => x.type === 'R-TOPIC').length },
      { label: '제목(24)', hit: A.items.filter((x) => x.type === 'R-TITLE' && x.rankSent === 1).length, n: A.items.filter((x) => x.type === 'R-TITLE').length },
    ],
    perExam: [...new Set(A.items.map((x) => x.exam))].map((e) => ({
      exam: e,
      hit: A.items.filter((x) => x.exam === e && x.rankSent === 1).length,
      n: A.items.filter((x) => x.exam === e).length,
    })),
  })

  report({
    name: 'P4.1 대조 — 빈칸 정답도 지문의 한 문장과 가장 가깝다  [기각 기대]',
    hit: B.s1, n: B.n, baseRate: 0.2, shape: 'count-vs-baserate',
    falsifier: '빈칸 정답이 대의파악만큼 지문 문장과 가까우면, 빈칸도 주제를 묻는 유형이라는 뜻이다',
    subgroups: [
      { label: '3점', hit: B.items.filter((x) => x.points === 3 && x.rankSent === 1).length, n: B.items.filter((x) => x.points === 3).length },
      { label: '2점', hit: B.items.filter((x) => x.points === 2 && x.rankSent === 1).length, n: B.items.filter((x) => x.points === 2).length },
    ],
    perExam: [...new Set(B.items.map((x) => x.exam))].map((e) => ({
      exam: e,
      hit: B.items.filter((x) => x.exam === e && x.rankSent === 1).length,
      n: B.items.filter((x) => x.exam === e).length,
    })),
  })
}

fs.writeFileSync(path.join(DIR, 'p41-topic-answer.json'), JSON.stringify({
  n: items.length,
  stats: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, { n: v.n, s1: v.s1, w1: v.w1 }])),
  rows: items.map((x) => ({ exam: x.exam, no: x.no, type: x.type, answer: x.answer, points: x.points, rankSent: x.rankSent, rankWhole: x.rankWhole })),
}, null, 1))
console.log(`→ ${path.join(DIR, 'p41-topic-answer.json')}`)
