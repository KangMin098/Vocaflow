// scripts/csat/test-bait-agreement.mjs
//
// **어휘 도구와 손판독이 문항마다 일치하는가 — 수렴 타당도.**
//
// §6.12 는 **집계**로만 두 도구를 견줬다(어휘: 지문 미끼 우세 / 의미: B형 우세).
// 집계가 같아도 **문항 단위로는 어긋날 수 있다.** 그러면 두 결과는 서로를 못 받쳐 준다.
//
// ⚠️ **이것은 판독자 간 일치율이 아니다.** 나는 이미 정답과 내 판정을 봤으므로
//    두 번째 판독을 해도 오염된다. 그래서 **서로 다른 종류의 도구**(기계 어휘 vs 사람 의미)가
//    같은 문항에서 같은 답을 내는지를 본다 — 수렴 타당도(convergent validity)다.
//
// 기계 예측: 그 문항의 **혼동도**와 **지문 미끼**를 코퍼스 전체 기준으로 표준화(z)해
//   z(혼동도) > z(지문미끼) → **A형** (정답을 문다)
//   그 반대                → **B형** (지문을 문다)
//
// 실행: pnpm dlx tsx scripts/csat/test-bait-agreement.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fisher, binomUpper } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const lex = JSON.parse(fs.readFileSync(path.join(DIR, 'distractor-confusion.json'), 'utf8')).rows
const hand = JSON.parse(fs.readFileSync(path.join(DIR, 'bait-blind-score.json'), 'utf8')).rows

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) }

// 코퍼스 전체에서 표준화 기준을 낸다
const mC = mean(lex.map((r) => r.confusion)), sC = sd(lex.map((r) => r.confusion))
const mP = mean(lex.map((r) => r.distractorPassage)), sP = sd(lex.map((r) => r.distractorPassage))

const byKey = new Map(lex.map((r) => [`${r.exam}#${r.no}`, r]))
const rows = []
for (const h of hand) {
  const l = byKey.get(`${h.exam}#${h.no}`)
  if (!l) { rows.push({ ...h, ok: false }); continue }
  const zC = (l.confusion - mC) / sC
  const zP = (l.distractorPassage - mP) / sP
  rows.push({
    exam: h.exam, no: h.no, type: h.type, points: h.points, ok: true,
    hand: h.bait, machine: zC > zP ? 'A' : 'B', zC, zP, gap: zP - zC,
  })
}

const good = rows.filter((r) => r.ok)
const agree = good.filter((r) => r.hand === r.machine).length
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)

console.log('수렴 타당도 — 어휘 도구 vs 손판독 (문항 단위)')
console.log('='.repeat(74))
console.log(`  대상 ${good.length}/${rows.length}문항 · 표준화 기준은 코퍼스 ${lex.length}문항`)
console.log()
console.log('  회차       유형        손판독  기계   z(혼동)  z(지문미끼)  일치')
console.log('  ' + '-'.repeat(70))
for (const r of good) {
  console.log(
    `  ${(r.exam + '#' + r.no).padEnd(10)} ${r.type.padEnd(11)} ${r.hand.padStart(4)}  ${r.machine.padStart(4)}  ` +
    `${r.zC.toFixed(2).padStart(7)} ${r.zP.toFixed(2).padStart(11)}   ${r.hand === r.machine ? '✓' : '✗'}`,
  )
}
console.log()
console.log(`  일치 ${agree}/${good.length} = ${pct(agree, good.length)}%`)

// 우연 일치를 걷어낸다 — 코헨의 카파
const a = good.filter((r) => r.hand === 'A' && r.machine === 'A').length
const b = good.filter((r) => r.hand === 'A' && r.machine === 'B').length
const c = good.filter((r) => r.hand === 'B' && r.machine === 'A').length
const d = good.filter((r) => r.hand === 'B' && r.machine === 'B').length
const n = a + b + c + d
const po = (a + d) / n
const pe = ((a + b) * (a + c) + (c + d) * (b + d)) / (n * n)
const kappa = pe === 1 ? 0 : (po - pe) / (1 - pe)
console.log(`  우연 일치 기대 ${pct(pe, 1)}% · **코헨 카파 = ${kappa.toFixed(3)}**`)
console.log(`  Fisher (2×2 독립성) p = ${fisher(a, b, c, d).toFixed(4)}`)
console.log()
console.log(`  교차표          기계 A   기계 B`)
console.log(`    손판독 A    ${String(a).padStart(6)} ${String(b).padStart(8)}`)
console.log(`    손판독 B    ${String(c).padStart(6)} ${String(d).padStart(8)}`)
console.log()

console.log('  판정')
console.log('  ' + '-'.repeat(70))
if (kappa >= 0.4 && fisher(a, b, c, d) < 0.05) {
  console.log('  → **두 도구가 문항 단위로도 일치한다.** 집계 수렴이 우연이 아니다.')
} else if (kappa > 0) {
  console.log('  → 일치가 우연보다는 낫지만 **약하다.** 집계는 같아도 문항 단위로는 어긋난다.')
  console.log('    두 결과는 서로를 강하게 받쳐 주지 못한다 — 각각 독립 증거로만 읽어야 한다.')
} else {
  console.log('  → **일치가 우연 수준이거나 그 이하다.** 두 도구는 다른 것을 재고 있다.')
}
console.log()
console.log('  ⚠️ 이것은 **판독자 간 일치율이 아니다.** 나는 이미 정답과 내 판정을 봤으므로')
console.log('     두 번째 판독은 오염된다. 진짜 일치율을 내려면 **다른 판독자**가 필요하다.')

fs.writeFileSync(path.join(DIR, 'bait-agreement.json'), JSON.stringify({
  n: good.length, agree, pct: pct(agree, good.length), kappa, po, pe,
  table: { AA: a, AB: b, BA: c, BB: d }, fisher: fisher(a, b, c, d), rows,
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'bait-agreement.json')}`)
