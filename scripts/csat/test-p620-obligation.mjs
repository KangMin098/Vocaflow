// scripts/csat/test-p620-obligation.mjs
//
// **P6.20 — "주장(20)·요지(22)는 당위 주제문이 있는 지문에 배정된다" 를 전수로 건다.**
//
// 대조군 선택이 이 검사의 전부다. 잘못 잡으면 장르 교락에 빠진다(P6.19 에서 겪었다).
// 여기서는 **같은 장르·다른 유형**이 대조군으로 딱 맞는다 —
// 주제(23)·제목(24)도 같은 대의파악 설명문이지만 '당위' 를 요구하지 않는다.
//
//   주장·요지 지문에만 당위가 있다 → 유형 배정이 지문 성질과 **매칭**된다는 증거 (초안 P2.2)
//   양쪽에 고루 있다            → 당위는 설명문 일반의 성질이고 배정 근거가 아니다
//
// 이 검사는 P6.20 과 P2.2 를 **동시에** 가른다.
//
// 실행: pnpm dlx tsx scripts/csat/test-p620-obligation.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, sentences } from './lib-passage.mjs'
import { fisher, report } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const rows = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).rows

// 당위 — 화자가 독자에게 무엇을 하라/해야 한다고 말하는 표지
const OBLIG = [
  '\\bshould\\b', '\\bmust\\b', '\\bought to\\b', '\\bneed(?:s)? to\\b', '\\bhas to\\b', '\\bhave to\\b',
  '\\bit is (?:important|essential|necessary|vital|crucial|critical|imperative|best|wise|worth)\\b',
  '\\bwe (?:need|require)\\b', '\\blet us\\b', "\\blet's\\b", '\\bbe sure to\\b', '\\bmake sure\\b',
  '\\bremember (?:to|that)\\b', '\\bavoid\\b', '\\btry to\\b', '\\brequires? (?:us|that)\\b',
]
const obligRe = new RegExp(OBLIG.join('|'), 'i')

function scan(typeIds) {
  const out = []
  for (const it of rows.filter((r) => typeIds.includes(r.type))) {
    const b = itemBlocks(it.exam, it.no)[0]
    if (!b) continue
    const s = sentences(passageOf(b))
    if (s.length < 3) continue
    const hits = s.filter((x) => obligRe.test(x))
    out.push({ exam: it.exam, no: it.no, type: it.type, nSent: s.length, nOblig: hits.length, has: hits.length > 0, sample: hits[0]?.slice(0, 70) ?? null })
  }
  return out
}

const target = scan(['R-CLAIM', 'R-GIST'])
const control = scan(['R-TOPIC', 'R-TITLE'])

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
const tHas = target.filter((r) => r.has).length
const cHas = control.filter((r) => r.has).length

console.log('P6.20 — 주장·요지 지문에 당위가 있는가 (대조군: 주제·제목)')
console.log('='.repeat(76))
console.log()
console.log('  집단                    문항   당위 있음   비율   문장당 당위')
console.log('  ' + '-'.repeat(72))
const dens = (a) => (a.reduce((s, r) => s + r.nOblig, 0) / a.reduce((s, r) => s + r.nSent, 0) * 100).toFixed(1)
console.log(`  주장·요지 (20·22)      ${String(target.length).padStart(4)} ${String(tHas).padStart(10)} ${String(pct(tHas, target.length)).padStart(7)}% ${dens(target).padStart(10)}%`)
console.log(`  주제·제목 (23·24) 대조 ${String(control.length).padStart(4)} ${String(cHas).padStart(10)} ${String(pct(cHas, control.length)).padStart(7)}% ${dens(control).padStart(10)}%`)
console.log()

const p = fisher(tHas, target.length - tHas, cHas, control.length - cHas)
console.log(`  Fisher 정확검정 (2×2 두 집단 비율) p = ${p.toFixed(4)}`)
console.log()

console.log('  주장·요지 — 회차별')
console.log('  ' + '-'.repeat(72))
for (const r of target) {
  console.log(`  ${r.exam.padEnd(7)} ${r.type.padEnd(9)} ${String(r.nSent).padStart(3)}문장 당위 ${String(r.nOblig).padStart(2)}  ${r.has ? '✓' : '✗'}  ${r.sample ?? ''}`)
}
console.log()
console.log('  주제·제목(대조) — 당위가 있는 것')
for (const r of control.filter((x) => x.has)) console.log(`  ${r.exam.padEnd(7)} ${r.type.padEnd(9)} 당위 ${r.nOblig}  ${r.sample}`)
console.log()

const halfT = Math.ceil(target.length / 2)
report({
  name: 'P6.20 — 주장·요지는 당위가 있는 지문에 배정된다  [검사]',
  hit: tHas, n: target.length, baseRate: cHas / control.length, shape: 'two-proportions',
  table: [tHas, target.length - tHas, cHas, control.length - cHas],
  falsifier: '주제·제목 지문에도 같은 비율로 당위가 있으면 깨진다 — 배정 근거가 아니라 설명문 일반의 성질이다',
  subgroups: [
    { label: '주장(20)', hit: target.filter((r) => r.type === 'R-CLAIM' && r.has).length, n: target.filter((r) => r.type === 'R-CLAIM').length },
    { label: '요지(22)', hit: target.filter((r) => r.type === 'R-GIST' && r.has).length, n: target.filter((r) => r.type === 'R-GIST').length },
  ],
  perExam: target.map((r) => ({ exam: r.exam, hit: r.has ? 1 : 0, n: 1 })),
})

fs.writeFileSync(path.join(DIR, 'p620-obligation.json'), JSON.stringify({ target, control, tHas, cHas, p }, null, 1))
console.log(`→ ${path.join(DIR, 'p620-obligation.json')}`)
