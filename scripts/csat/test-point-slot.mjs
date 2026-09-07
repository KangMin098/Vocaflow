// scripts/csat/test-point-slot.mjs
//
// **3점이 붙는 **번호**가 고정인가 — E7 이 안 정하는 것.**
//
// E7 은 2019 개편 이후 **유형별 3점 개수**를 고정한다(빈칸 2 · 순서 1 · 삽입 1).
// 그런데 **어느 번호**가 3점인지는 안 정한다 —
//   빈칸은 31·32·33·34 중 둘, 순서는 36·37 중 하나, 삽입은 38·39 중 하나.
//
// 고정이면 → E8(번호→능력군)처럼 **자리 채우기**의 또 한 축이고 새 HARD 후보다.
// 자유로우면 → 출제자가 회차마다 실제로 고르는 몇 안 되는 것 중 하나다.
//
// 기저는 조합에서 바로 나온다 — 가정이 아니다:
//   빈칸 2개를 4자리에서 고르는 경우의 수 = C(4,2) = 6  → 특정 조합 확률 1/6
//   순서 1개를 2자리에서                = 2            → 1/2
//   삽입 1개를 2자리에서                = 2            → 1/2
//
// 실행: pnpm dlx tsx scripts/csat/test-point-slot.mjs

import fs from 'node:fs'
import path from 'node:path'
import { answerOf, allRows } from './lib-passage.mjs'
import { binomUpper } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const rows = allRows()

// 2019 개편 이후만 — 그 전에는 번호 배치 자체가 다르다
const yearOf = (e) => (String(e).startsWith('M') ? 2000 + Number(String(e).slice(1, 3)) : Number(e))
const exams = [...new Set(rows.map((r) => r.exam))].filter((e) => yearOf(e) >= 2019).sort()

const GROUPS = [
  { name: '빈칸', type: 'R-BLANK', slots: [31, 32, 33, 34], pick: 2, combos: 6 },
  { name: '순서', type: 'R-ORDER', slots: [36, 37], pick: 1, combos: 2 },
  { name: '삽입', type: 'R-INSERT', slots: [38, 39], pick: 1, combos: 2 },
]

console.log('3점이 붙는 번호가 고정인가 — E7 이 안 정하는 것')
console.log('='.repeat(72))
console.log(`  회차 ${exams.length} (2019 개편 이후 · 수능 + 모평)`)
console.log()

const out = {}
for (const g of GROUPS) {
  const per = []
  for (const e of exams) {
    const items = rows.filter((r) => r.exam === e && r.type === g.type)
    const three = items
      .map((r) => ({ no: r.no, a: answerOf(r.exam, r.no) }))
      .filter((x) => x.a && x.a.points === 3)
      .map((x) => x.no)
      .sort((a, b) => a - b)
    if (three.length === g.pick) per.push({ exam: e, slots: three.join('·') })
  }
  const tally = {}
  for (const x of per) tally[x.slots] = (tally[x.slots] ?? 0) + 1
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])
  const top = sorted[0]
  const pBinom = top ? binomUpper(per.length, top[1], 1 / g.combos) : 1

  out[g.name] = { n: per.length, tally, top: top?.[0], topN: top?.[1], combos: g.combos, p: pBinom }

  console.log(`  ${g.name} — 3점 ${g.pick}개가 ${g.slots.join('·')} 중 어디에 붙는가 (조합 ${g.combos}가지)`)
  console.log('  ' + '-'.repeat(68))
  for (const [k, v] of sorted) {
    console.log(`    ${k.padEnd(10)} ${String(v).padStart(3)}/${per.length}  ${'█'.repeat(v)}`)
  }
  console.log(`    최빈 조합 ${top?.[0]} — ${top?.[1]}/${per.length}, 기저 1/${g.combos} 에서 이항 p = ${pBinom.toExponential(2)}`)
  console.log(`    회차별: ${per.map((x) => `${x.exam}:${x.slots}`).join(' · ')}`)
  console.log()
}

console.log('  판정')
console.log('  ' + '-'.repeat(68))
const fixed = Object.entries(out).filter(([, v]) => v.topN === v.n)
const sig = Object.entries(out).filter(([, v]) => v.p < 0.05)
if (fixed.length) {
  console.log(`  → **완전 고정: ${fixed.map(([k]) => k).join(' · ')}** — 예외 0. 새 HARD 후보다.`)
}
if (sig.length && sig.length !== fixed.length) {
  console.log(`  → 편중은 있으나 예외가 있는 것: ${sig.filter(([k]) => !fixed.find(([f]) => f === k)).map(([k]) => k).join(' · ')}`)
}
const free = Object.entries(out).filter(([, v]) => v.p >= 0.05)
if (free.length) {
  console.log(`  → **자유로운 것: ${free.map(([k]) => k).join(' · ')}** — 기저와 구분되지 않는다.`)
  console.log('    출제자가 회차마다 실제로 고르는 자리다.')
}

fs.writeFileSync(path.join(DIR, 'point-slot.json'), JSON.stringify({ exams, groups: out }, null, 1))
console.log(`\n→ ${path.join(DIR, 'point-slot.json')}`)
