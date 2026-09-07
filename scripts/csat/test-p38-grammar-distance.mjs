// scripts/csat/test-p38-grammar-distance.mjs
//
// **P3.8 — "어법 난도 다이얼 = 판단 근거를 밑줄에서 멀리 두는 것" 을 건다.**
//
// 초안은 이것을 [가설] 로 달았다(긴 주어 · 먼 선행사). 반증 가능한 형태로 바꾸면:
//   **정답 밑줄은 오답 밑줄보다 판단 근거가 멀다.**
//
// 구문 파서가 없으므로 **거리의 대리 지표** 둘을 쓴다. 둘 다 문항 안에서 짝지어 잰다:
//   D1  밑줄이 든 **문장의 길이**(낱말 수) — 길수록 근거가 멀어질 여지가 크다
//   D2  그 문장 안에서 **밑줄 앞에 놓인 낱말 수** — 앞이 길수록 주어·선행사가 멀다
//
// 짝지음이라 회차·지문 난이도가 자동 통제된다. 밑줄 5개 중 정답 1 · 오답 4 를 견준다.
//
// ⚠️ 대리 지표임을 분명히 한다. 문장이 길다고 반드시 근거가 먼 것은 아니다.
//    그러나 **짧고 앞쪽인 밑줄에 정답이 몰린다면** 가설은 그 자리에서 깨진다.
//
// 실행: pnpm dlx tsx scripts/csat/test-p38-grammar-distance.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, sentences, answerOf, mockRows } from './lib-passage.mjs'
import { binomUpper, report } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const words = (s) => (s.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length
const CIRC = '①②③④⑤'

// ⚠️ 밑줄 구간을 **텍스트로 맞추면** 추출 잡음에 걸려 13문항 중 6개가 날아갔다.
//    어법 지문은 ①~⑤ 가 **본문 안에 그대로 찍혀 있으므로** 그 위치를 바로 쓴다.
//    덤으로 모의평가에도 그대로 걸린다(라벨이 필요 없다).
const targets = []
for (const r of JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).rows) {
  if (r.type === 'R-GRAMMAR') targets.push({ exam: r.exam, no: r.no, src: '수능' })
}
for (const r of mockRows()) {
  if (r.type === 'R-GRAMMAR') targets.push({ exam: r.exam, no: r.no, src: '모평' })
}

const rows = []
for (const t of targets) {
  const k = `${t.exam}#${t.no}`
  const b = itemBlocks(t.exam, t.no)[0]
  if (!b) { rows.push({ k, ok: false, why: '블록 없음' }); continue }
  const p = passageOf(b)
  const marks = [...p.matchAll(/[①②③④⑤]/g)].map((m) => ({ n: CIRC.indexOf(m[0]) + 1, at: m.index }))
  if (marks.length < 4) { rows.push({ k, ok: false, why: `마커 ${marks.length}/5` }); continue }
  const a = answerOf(t.exam, t.no)
  if (!a) { rows.push({ k, ok: false, why: '정답 없음' }); continue }

  // 마커가 든 문장을 찾는다 — 문장 경계를 문자 오프셋으로 잡는다
  const sents = sentences(p)
  const bounds = []
  let cur = 0
  for (const s of sents) {
    const at = p.indexOf(s.slice(0, 20), cur)
    const start = at < 0 ? cur : at
    bounds.push({ s, start, end: start + s.length })
    cur = start + s.length
  }
  const per = []
  for (const m of marks) {
    const bi = bounds.findIndex((x) => m.at >= x.start && m.at < x.end)
    const bd = bi >= 0 ? bounds[bi] : null
    if (!bd) continue
    per.push({
      n: m.n, isAnswer: m.n === a.answer,
      d1: words(bd.s),                              // 문장 길이
      d2: words(p.slice(bd.start, m.at)),           // 밑줄 앞 낱말 수
    })
  }
  const ans = per.find((x) => x.isAnswer)
  const dis = per.filter((x) => !x.isAnswer)
  if (!ans || dis.length < 2) { rows.push({ k, ok: false, why: `문장 매칭 ${per.length}/5` }); continue }
  const mean = (x) => x.reduce((s, y) => s + y, 0) / x.length
  rows.push({
    k, exam: t.exam, no: t.no, src: t.src, ok: true, nFound: per.length,
    ansD1: ans.d1, disD1: mean(dis.map((x) => x.d1)),
    ansD2: ans.d2, disD2: mean(dis.map((x) => x.d2)),
  })
}
const byItem = { size: targets.length }

const good = rows.filter((r) => r.ok)
const bad = rows.filter((r) => !r.ok)
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)

console.log('P3.8 — 어법: 정답 밑줄이 오답 밑줄보다 근거가 먼가')
console.log('='.repeat(74))
console.log(`  어법 문항 ${byItem.size} · 판정 가능 ${good.length} · 제외 ${bad.length}`)
if (bad.length) console.log(`    제외 — ${bad.map((r) => `${r.k}(${r.why})`).join(' · ')}`)
console.log()
console.log('  회차     문장길이 정답/오답     밑줄앞 낱말 정답/오답')
console.log('  ' + '-'.repeat(68))
for (const r of good) {
  console.log(
    `  ${r.k.padEnd(9)} ${String(r.ansD1).padStart(4)} / ${r.disD1.toFixed(1).padStart(5)}` +
    `        ${String(r.ansD2).padStart(4)} / ${r.disD2.toFixed(1).padStart(5)}`,
  )
}
console.log()

for (const [name, a, b] of [
  ['D1 문장 길이', good.map((r) => r.ansD1), good.map((r) => r.disD1)],
  ['D2 밑줄 앞 낱말 수', good.map((r) => r.ansD2), good.map((r) => r.disD2)],
]) {
  const win = good.filter((_, i) => a[i] > b[i]).length
  const tie = good.filter((_, i) => a[i] === b[i]).length
  const dec = good.length - tie
  console.log(`  ${name}`)
  console.log(`    정답 평균 ${mean(a).toFixed(1)} · 오답 평균 ${mean(b).toFixed(1)}`)
  console.log(`    정답이 더 큰 문항 ${win}/${dec} = ${pct(win, dec)}% (동점 ${tie} 제외) · 이항 p = ${binomUpper(dec, win, 0.5).toFixed(4)}`)
  console.log()
}

const w1 = good.filter((r) => r.ansD1 > r.disD1).length
const t1 = good.filter((r) => r.ansD1 === r.disD1).length
report({
  name: 'P3.8 — 어법 정답 밑줄은 더 긴 문장에 놓인다  [검사]',
  hit: w1, n: good.length - t1, baseRate: 0.5, shape: 'count-vs-baserate',
  falsifier: '정답 밑줄이 오답보다 짧은 문장에 놓이거나 반반이면 깨진다 — 근거를 멀리 두는 다이얼이 아니다',
  subgroups: [
    { label: '2014~2019', hit: good.filter((r) => +r.exam.slice(0, 4) <= 2019 && r.ansD1 > r.disD1).length, n: good.filter((r) => +r.exam.slice(0, 4) <= 2019).length },
    { label: '2020~2026', hit: good.filter((r) => +r.exam.slice(0, 4) >= 2020 && r.ansD1 > r.disD1).length, n: good.filter((r) => +r.exam.slice(0, 4) >= 2020).length },
  ],
  perExam: good.map((r) => ({ exam: r.exam, hit: r.ansD1 > r.disD1 ? 1 : 0, n: 1 })),
})

fs.writeFileSync(path.join(DIR, 'p38-grammar-distance.json'), JSON.stringify({ n: good.length, excluded: bad.length, rows }, null, 1))
console.log(`→ ${path.join(DIR, 'p38-grammar-distance.json')}`)
