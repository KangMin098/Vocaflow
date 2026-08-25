// scripts/csat/test-p32b-adjacent-lock.mjs
//
// **P3.2b 감사 — "빈칸은 주제로 안 잠기고 인접 구체진술이 잠근다" 를 전수로 다시 건다.**
//
// 이 명제는 지금 **손표본 5/5 · 기저 20%(가정) · HARD 후보**다.
// P3.1 이 같은 형태(손표본 5/5 · 기저 33% **가정**)였다가 실측하니 무너졌으므로,
// **남은 HARD 후보에도 같은 함정이 있는지 감사한다.**
//
// 명제를 둘로 가른다.
//
//   전반 "주제만으로는 안 잠긴다"
//     → P4.1 이 이미 전수로 쟀다. 빈칸 정답이 지문 문장 유사도 1위인 비율 **25%**,
//       기저 20% 와 구분되지 않는다(p=0.207). **독립 증거로 지지된다.**
//
//   후반 "인접 구체진술이 잠근다"  ← 이 스크립트가 재는 것
//     반증 가능한 형태: **정답은 빈칸의 인접 문장에 오답보다 더 붙어 있다.**
//     측정: 인접우위 = sim(선지, 빈칸 앞뒤 문장) − sim(선지, 나머지 문장 전체)
//     문항 안에서 정답 1 vs 오답 4 를 견준다 → 기저는 가정이 아니라 **50%**
//
// ⚠️ 동점(겹침이 0이라 잴 수 없는 문항)은 부호검정에서 뺀다. P4.5 에서 겪은 함정이다.
//
// 실행: pnpm dlx tsx scripts/csat/test-p32b-adjacent-lock.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, choicesOf, sentences, answerOf, allRows } from './lib-passage.mjs'
import { binomUpper, report } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const rows = allRows()
const SENT = 'ZQBLANKQZ'

const STOP = new Set(('a an the of to in on for and or is are was were be been being it its this that these those with as by at from he she they we you i his her their our your them us him can could may might will would shall should must do does did done have has had having but so than then there here what which who whom whose when where why how all any both each few more most other some such only own same too very just also into over under about after before between out up down off again further once').split(' '))
const stem = (w) => w.replace(/(ing|ions|ion|ers|er|ies|es|ed|ly|s)$/, '')
const toks = (s) => (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem)

function passageWithBlank(block) {
  const body = []
  for (const l of block) { if (/^\s*①/.test(l)) break; body.push(l) }
  const live = body.filter((l) => l.trim())
  if (live.length < 3) return null
  const inds = live.map((l) => l.match(/^ */)[0].length).sort((a, b) => a - b)
  const base = inds[Math.floor(inds.length / 2)]
  let hit = -1
  for (let i = 1; i < body.length; i += 1) {
    if (!body[i].trim()) continue
    if (/^\s*\d+\s*[.．]/.test(body[i])) continue
    if (body[i].match(/^ */)[0].length >= base + 12) { hit = i; break }
  }
  if (hit < 0) return null
  const out = []
  for (let i = 0; i < body.length; i += 1) {
    const l = body[i].trim()
    if (!l) continue
    if (/^\s*\d+\s*[.．]/.test(body[i])) continue
    out.push(i === hit ? SENT + ' ' + l : l)
  }
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

const items = []
for (const r of rows.filter((x) => x.type === 'R-BLANK')) {
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const p = passageWithBlank(b)
  const ch = choicesOf(b)
  const a = answerOf(r.exam, r.no)
  if (!p || !ch || !ch.every((c) => c.length > 3) || !a || a.answer < 1 || a.answer > 5) continue
  const marked = sentences(p)
  const bi = marked.findIndex((s) => s.includes(SENT))
  if (bi < 0 || marked.length < 5) continue
  items.push({ exam: r.exam, no: r.no, points: a.points, answer: a.answer, choices: ch, sents: marked.map((s) => s.replace(SENT, '').trim()), bi })
}

const df = new Map()
for (const it of items) for (const w of new Set(it.sents.flatMap(toks))) df.set(w, (df.get(w) ?? 0) + 1)
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
  const adj = [it.sents[it.bi - 1], it.sents[it.bi + 1]].filter(Boolean).join(' ')
  const rest = it.sents.filter((_, i) => i !== it.bi && i !== it.bi - 1 && i !== it.bi + 1).join(' ')
  it.per = it.choices.map((c, i) => ({
    isAns: i + 1 === it.answer,
    adv: sim(c, adj) - sim(c, rest),      // 인접우위
  }))
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
const EPS = 1e-9

const diffs = items.map((it) => {
  const a = it.per.find((x) => x.isAns).adv
  const d = mean(it.per.filter((x) => !x.isAns).map((x) => x.adv))
  return a - d                              // 정답이 더 인접해 있으면 양수
})
const win = diffs.filter((x) => x > EPS).length
const lose = diffs.filter((x) => x < -EPS).length
const tie = diffs.filter((x) => Math.abs(x) <= EPS).length
const dec = win + lose

console.log('P3.2b 감사 — "인접 구체진술이 잠근다" 를 전수로')
console.log('='.repeat(72))
console.log(`  빈칸 ${items.length}문항 (수능 + 모평, 빈칸 자리를 찾은 것만)`)
console.log()
console.log('  인접우위 = sim(선지, 빈칸 앞뒤 문장) − sim(선지, 나머지 문장)')
console.log('  ' + '-'.repeat(68))
console.log(`    정답 평균 인접우위  ${mean(items.map((it) => it.per.find((x) => x.isAns).adv)).toFixed(4)}`)
console.log(`    오답 평균 인접우위  ${mean(items.flatMap((it) => it.per.filter((x) => !x.isAns).map((x) => x.adv))).toFixed(4)}`)
console.log()
console.log(`    문항 내 부호검정 — 정답이 더 인접 ${win} · 오답이 더 인접 ${lose} · 동점 ${tie}`)
console.log(`      동점 제외  ${win}/${dec} = ${pct(win, dec)}%  (기저 50%)  이항 p = ${binomUpper(dec, win, 0.5).toFixed(4)}`)
console.log()

const p3 = items.filter((x) => x.points === 3), p2 = items.filter((x) => x.points === 2)
const sub = (arr) => {
  let w = 0, n = 0
  for (const it of arr) {
    const a = it.per.find((x) => x.isAns).adv
    const d = mean(it.per.filter((x) => !x.isAns).map((x) => x.adv))
    if (Math.abs(a - d) <= EPS) continue
    n += 1; if (a > d) w += 1
  }
  return { hit: w, n }
}
report({
  name: 'P3.2b 후반 — 정답은 빈칸 인접 문장에 오답보다 더 붙어 있다  [감사]',
  hit: win, n: dec, baseRate: 0.5, shape: 'count-vs-baserate',
  falsifier: '정답의 인접우위가 오답과 같거나 낮으면 깨진다 — 인접 구체진술이 답을 잠근다는 근거가 없어진다',
  subgroups: [{ label: '3점', ...sub(p3) }, { label: '2점', ...sub(p2) }],
  perExam: [...new Set(items.map((x) => x.exam))].map((e) => {
    const a = items.filter((x) => x.exam === e)
    return { exam: e, ...sub(a) }
  }).filter((x) => x.n > 0),
})

console.log()
console.log('  ── 전반 "주제만으로는 안 잠긴다" 는 이미 전수로 지지된다 ──')
console.log('    P4.1: 빈칸 정답이 지문 문장 유사도 1위인 비율 25% vs 기저 20% (p=0.207)')
console.log('    → 정답은 지문 어느 문장과도 특별히 가깝지 않다. 주제로 잠기지 않는다.')

fs.writeFileSync(path.join(DIR, 'p32b-adjacent-lock.json'), JSON.stringify({ n: items.length, win, lose, tie, dec }, null, 1))
console.log(`\n→ ${path.join(DIR, 'p32b-adjacent-lock.json')}`)
