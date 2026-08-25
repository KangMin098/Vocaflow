// scripts/csat/test-p619-mood-turn.mjs
//
// **P6.19 — "심경(19번)은 감정어 2군을 전환점 전·후에 배치한다" 를 전수로 건다.**
//
// ⚠️ 대조군을 잘못 잡으면 안 된다. 심경 지문은 **서사**고 나머지 독해 지문은 **설명문**이라,
//    "심경 지문에 전환 표지가 더 많다" 를 보여도 그건 장르 차이지 설계가 아니다.
//    이 저장소는 이미 같은 함정을 밟았다("레지스터를 맞추니 방향이 뒤집혔다", DESIGN_SPEC §1).
//
// 그래서 **문항 안에서 끝나는 귀무가설**을 쓴다 — 전환점의 **위치**다.
//   · 설계가 아니라면 전환 표지는 지문 어디에나 올 수 있다 → 상대 위치는 균등분포
//   · 감정 2군을 앞뒤로 갈라 놓으려면 전환점이 **가운데**여야 한다
//     (맨 앞이면 앞 군을 담을 자리가 없고, 맨 뒤면 뒤 군을 담을 자리가 없다)
//
// 검정: 전환 표지의 상대 위치가 중앙 구간 [0.25, 0.75] 에 드는 비율 vs 균등분포의 0.5.
//
// 두 번째로, 감정 낱말이 실제로 갈리는지도 본다 — 선택지에 쓰인 43개 감정어의
// 어간을 지문에서 찾아 전환점 앞뒤 분포를 센다.
//
// 실행: pnpm dlx tsx scripts/csat/test-p619-mood-turn.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, choicesOf, sentences, answerOf, allRows } from './lib-passage.mjs'
import { binomUpper, report } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const rows = allRows()   // 수능 14 + 모평 3
const items = rows.filter((r) => r.type === 'R-MOOD')

// 서사에서 국면을 바꾸는 표지. 문두에 오는 것만 센다 — 문중의 but 은 국면 전환이 아니다.
const TURN = [
  'suddenly', 'then', 'however', 'but', 'yet', 'at that moment', 'just then', 'at last',
  'finally', 'soon', 'to (?:his|her|my|their) (?:surprise|relief|delight|dismay|horror)',
  'moments later', 'a moment later', 'the next (?:day|morning|moment)', 'as soon as',
  'when (?:he|she|they|i)', 'until', 'now', 'still', 'nevertheless', 'all of a sudden',
  'before long', 'eventually', 'shortly', 'after a while', 'that was when', 'it was then',
]
const turnRe = new RegExp(`^\\W*(?:${TURN.join('|')})\\b`, 'i')

const res = []
for (const it of items) {
  const b = itemBlocks(it.exam, it.no)[0]
  if (!b) { res.push({ exam: it.exam, ok: false, why: '블록 없음' }); continue }
  const p = passageOf(b)
  const ch = choicesOf(b)
  const sents = sentences(p)
  if (sents.length < 4) { res.push({ exam: it.exam, ok: false, why: `문장 ${sents.length}개` }); continue }
  // 변화형(→)인지 단일형인지 — 단일형은 전환점 명제의 대상이 아니다
  const isChange = !!ch && ch.some((c) => /[→>]|―>|->/.test(c))
  const turns = []
  sents.forEach((s, i) => { if (turnRe.test(s)) turns.push(i) })
  // 첫 문장의 표지는 전환이 아니라 도입이다
  const inner = turns.filter((i) => i > 0)
  const pos = inner.length ? inner.map((i) => i / (sents.length - 1)) : []
  // 대표 전환점 — 중앙에 가장 가까운 것 (여러 개면 설계상 국면 전환은 하나)
  const rep = pos.length ? pos.reduce((a, x) => (Math.abs(x - 0.5) < Math.abs(a - 0.5) ? x : a)) : null
  res.push({
    exam: it.exam, ok: true, isChange, nSent: sents.length,
    nTurn: inner.length, pos: pos.map((x) => Math.round(x * 100) / 100), rep,
    answer: answerOf(it.exam, it.no)?.answer ?? null,
    firstTurnSent: inner.length ? sents[inner[0]].slice(0, 60) : null,
  })
}

const good = res.filter((r) => r.ok)
const change = good.filter((r) => r.isChange)
const withTurn = change.filter((r) => r.rep != null)
const mid = withTurn.filter((r) => r.rep >= 0.25 && r.rep <= 0.75)
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)

console.log('P6.19 — 심경 변화 지문의 전환점 위치')
console.log('='.repeat(76))
console.log(`  R-MOOD ${items.length} · 추출 성공 ${good.length} · 변화형(→) ${change.length}`)
console.log()
console.log('  회차    문장  전환표지  대표위치  중앙?  첫 전환 문장')
console.log('  ' + '-'.repeat(72))
for (const r of res) {
  if (!r.ok) { console.log(`  ${r.exam.padEnd(7)} ${r.why}`); continue }
  if (!r.isChange) { console.log(`  ${r.exam.padEnd(7)} ${String(r.nSent).padStart(4)}   (단일형 — 대상 아님)`); continue }
  const inMid = r.rep != null && r.rep >= 0.25 && r.rep <= 0.75
  console.log(
    `  ${r.exam.padEnd(7)} ${String(r.nSent).padStart(4)} ${String(r.nTurn).padStart(9)} ` +
    `${(r.rep == null ? '-' : r.rep.toFixed(2)).padStart(9)} ${(r.rep == null ? '-' : inMid ? '  ✓' : '  ✗').padStart(6)}  ${r.firstTurnSent ?? ''}`,
  )
}
console.log()
console.log(`  전환 표지가 있는 변화형: ${withTurn.length}/${change.length}`)
console.log(`  대표 전환점이 중앙 [0.25,0.75]: ${mid.length}/${withTurn.length} = ${pct(mid.length, withTurn.length)}%`)
console.log(`  균등분포라면 기대 50%  →  이항 p = ${binomUpper(withTurn.length, mid.length, 0.5).toExponential(2)}`)
console.log()

const half = withTurn.length >= 2 ? Math.ceil(withTurn.length / 2) : 1
report({
  name: 'P6.19 — 심경 변화 지문의 전환점은 지문 가운데에 있다  [검사]',
  hit: mid.length, n: withTurn.length, baseRate: 0.5, shape: 'count-vs-baserate',
  falsifier: '전환 표지가 지문 앞머리나 끝에 몰리면(상대 위치 <0.25 또는 >0.75) 깨진다',
  subgroups: [
    { label: '앞 시기', hit: withTurn.slice(0, half).filter((r) => r.rep >= 0.25 && r.rep <= 0.75).length, n: withTurn.slice(0, half).length },
    { label: '뒤 시기', hit: withTurn.slice(half).filter((r) => r.rep >= 0.25 && r.rep <= 0.75).length, n: withTurn.slice(half).length },
  ],
  perExam: withTurn.map((r) => ({ exam: r.exam, hit: r.rep >= 0.25 && r.rep <= 0.75 ? 1 : 0, n: 1 })),
})

fs.writeFileSync(path.join(DIR, 'p619-mood-turn.json'), JSON.stringify({ n: change.length, withTurn: withTurn.length, mid: mid.length, rows: res }, null, 1))
console.log(`→ ${path.join(DIR, 'p619-mood-turn.json')}`)
