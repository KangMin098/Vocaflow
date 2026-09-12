// scripts/csat/test-p618-purpose-pos.mjs
//
// **P6.18 — "목적(18번)은 목적 문장 앞에 배경을 배치한다" 를 전수로 건다.**
//
// 초안은 이것을 18번의 설계 행위로 적었다. 반증 가능한 형태로 바꾸면:
//   **목적을 말하는 문장이 지문의 첫 문장이 아니다** (앞에 배경이 깔린다)
//
// 귀무가설은 문항 안에서 끝난다 — 배경을 깔지 않는다면 편지는 용건부터 쓴다.
// 즉 설계가 없다면 목적 문장이 **첫 문장**일 것이다.
//
// ⚠️ 목적 문장은 정규식으로 찾는다. 편지글의 용건 표지는 닫힌 집합에 가깝다
//    (I am writing to / I would like to / please / request / ask you to / this is to ...).
//    표지를 못 찾은 문항은 **분모에서 빼지 않고** 별도로 센다 — 빼면 유리한 쪽만 남는다.
//
// 실행: pnpm dlx tsx scripts/csat/test-p618-purpose-pos.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, sentences } from './lib-passage.mjs'
import { binomUpper, report } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const rows = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).rows
const items = rows.filter((r) => r.type === 'R-PURPOSE')

// 용건을 꺼내는 표지 — 편지·안내문의 관용구
const PURPOSE = [
  'i am writing', "i'm writing", 'i write to', 'this is to', 'we are writing', "we're writing",
  'i would like to (?:ask|request|inform|invite|suggest|propose|recommend|remind|let you know)',
  'we would like to (?:ask|request|inform|invite|suggest|propose|recommend|remind|let you know)',
  'i am asking', 'we are asking', 'i request', 'we request', 'please (?:consider|accept|allow|send|let|provide|grant|be)',
  'i urge', 'we urge', 'may i ask', 'could you (?:please )?(?:kindly )?',
  'i am contacting', 'we are contacting', 'the purpose of this',
  'on behalf of', 'i hope you (?:will|can) ', 'we hope you (?:will|can) ',
]
const re = new RegExp(`\\b(?:${PURPOSE.join('|')})`, 'i')

// ── 손판정 ────────────────────────────────────────────────────────────
// 정규식은 12문항 중 5개에서만 용건 표지를 찾았다(광고형·자기소개형이 안 걸린다).
// 용건 문장은 의미 수준이라 정규식으로 못 잡는다 → Claude Code 가 직접 읽어 표시했다
// (CLAUDE.md §🤖). 아래는 그 판정이며, 문장 번호는 sentences() 분할 기준이다.
// 판정 기준: "이 글을 쓴 까닭" 을 직접 진술하는 문장 — 요청·통지·홍보의 핵심 한 문장.
const HAND = {
  '2014A': 1, // We, ABLE Shipping, have developed the perfect system... (앞 [0] 은 광고 훅)
  '2016': 3,  // I'd like to check to see if he could switch to the third week program
  '2017': 2,  // The Ha-Rang Writing Center offers a free tutoring program
  '2018': 4,  // Would you please let me know if it is possible to make a group reservation
  '2019': 1,  // However, I would like to change my recipe if it is possible
  '2020': 5,  // Since you are the manager..., I ask you to take measures to prevent the noise
  '2021': 1,  // we are starting the campus food drive
  '2022': 4,  // I would like to ask you to deliver a special lecture
  '2023': 7,  // I would like to know how to sign up for the club
  '2024': 2,  // we've launched special online courses
  '2025': 3,  // As a result, we have decided to cancel the race
  '2026': 5,  // Therefore, I am encouraging you to submit a proposal for a new club
}

const res = []
for (const it of items) {
  const b = itemBlocks(it.exam, it.no)[0]
  if (!b) { res.push({ exam: it.exam, ok: false, why: '블록 없음' }); continue }
  const sents = sentences(passageOf(b))
  if (sents.length < 3) { res.push({ exam: it.exam, ok: false, why: `문장 ${sents.length}개` }); continue }
  const idx = HAND[it.exam] ?? sents.findIndex((s) => re.test(s))
  res.push({
    exam: it.exam, ok: true, nSent: sents.length, idx,
    rel: idx < 0 ? null : Math.round((idx / (sents.length - 1)) * 100) / 100,
    hit: idx > 0,               // 첫 문장이 아니다 = 앞에 배경이 있다
    sent: idx >= 0 ? sents[idx].slice(0, 62) : null,
    first: sents[0].slice(0, 62),
  })
}

const good = res.filter((r) => r.ok)
const found = good.filter((r) => r.idx >= 0)
const notFirst = found.filter((r) => r.hit)
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)

console.log('P6.18 — 목적 문장은 첫 문장인가, 배경 뒤인가')
console.log('='.repeat(78))
console.log(`  R-PURPOSE ${items.length} · 추출 성공 ${good.length} · 용건 표지 발견 ${found.length}`)
console.log()
console.log('  회차    문장  목적문장#  상대위치  배경있음  목적 문장')
console.log('  ' + '-'.repeat(74))
for (const r of res) {
  if (!r.ok) { console.log(`  ${r.exam.padEnd(7)} ${r.why}`); continue }
  if (r.idx < 0) { console.log(`  ${r.exam.padEnd(7)} ${String(r.nSent).padStart(4)}   표지 못 찾음 — 첫 문장: ${r.first}`); continue }
  console.log(
    `  ${r.exam.padEnd(7)} ${String(r.nSent).padStart(4)} ${String(r.idx).padStart(10)} ${String(r.rel.toFixed(2)).padStart(9)} ` +
    `${(r.hit ? '  ✓' : '  ✗').padStart(9)}  ${r.sent}`,
  )
}
console.log()
console.log(`  목적 문장이 첫 문장이 아니다: ${notFirst.length}/${found.length} = ${pct(notFirst.length, found.length)}%`)
console.log(`  중앙값 위치: ${found.length ? found.map((r) => r.idx).sort((a, b) => a - b)[Math.floor(found.length / 2)] : '-'} 번째 문장`)
console.log()

// ⚠️ 기저를 정직하게 잡아야 한다. 지문이 평균 8문장이면 "첫 문장이 아니다" 는
//    **아무 문장이나 골라도 7/8 = 87.5%** 로 참이다. 12/12 는 그 기저에서 p=0.20 이다.
const meanSent = found.reduce((s, r) => s + r.nSent, 0) / found.length
const naive = 1 - 1 / meanSent
console.log(`  ⚠️ 기저 — 평균 ${meanSent.toFixed(1)}문장이므로 무작위 문장도 ${(naive * 100).toFixed(1)}% 는 "첫 문장이 아니다"`)
console.log(`     그 기저에서 ${notFirst.length}/${found.length} 의 이항 p = ${binomUpper(found.length, notFirst.length, naive).toFixed(3)}`)
console.log()

// 진짜 물어야 할 것 — 용건이 **뒤로 밀려 있는가**. 배경을 깐다면 상대 위치가 0.5 보다 커야 한다.
const rels = found.map((r) => r.rel)
const meanRel = rels.reduce((a, b) => a + b, 0) / rels.length
const late = found.filter((r) => r.rel > 0.5).length
console.log('  ── 더 강한 형태 — 용건이 뒤로 밀려 있는가 ──')
console.log(`  상대 위치: ${rels.map((x) => x.toFixed(2)).join(' ')}`)
console.log(`  평균 ${meanRel.toFixed(3)} (균등이면 0.5) · 후반부(>0.5) ${late}/${found.length}`)
console.log(`  균등 기저 0.5 에서 이항 p = ${binomUpper(found.length, late, 0.5).toFixed(3)}`)
console.log()

const half = Math.ceil(found.length / 2)
report({
  name: 'P6.18 형태A — 용건 문장은 첫 문장이 아니다  [검사]',
  hit: notFirst.length, n: found.length, baseRate: naive, shape: 'count-vs-baserate',
  falsifier: '용건 문장이 지문 첫 문장에 오면 깨진다 — 배경 없이 용건부터 쓴 것이다',
  subgroups: [
    { label: '앞 시기', hit: found.slice(0, half).filter((r) => r.hit).length, n: found.slice(0, half).length },
    { label: '뒤 시기', hit: found.slice(half).filter((r) => r.hit).length, n: found.slice(half).length },
  ],
  perExam: found.map((r) => ({ exam: r.exam, hit: r.hit ? 1 : 0, n: 1 })),
})

report({
  name: 'P6.18 형태B — 용건 문장이 지문 후반부로 밀려 있다  [검사]',
  hit: late, n: found.length, baseRate: 0.5, shape: 'count-vs-baserate',
  falsifier: '용건 문장의 상대 위치가 0.5 언저리에 고르게 퍼지면 깨진다 — 밀어 놓은 것이 아니다',
  subgroups: [
    { label: '앞 시기', hit: found.slice(0, half).filter((r) => r.rel > 0.5).length, n: found.slice(0, half).length },
    { label: '뒤 시기', hit: found.slice(half).filter((r) => r.rel > 0.5).length, n: found.slice(half).length },
  ],
  perExam: found.map((r) => ({ exam: r.exam, hit: r.rel > 0.5 ? 1 : 0, n: 1 })),
})

fs.writeFileSync(path.join(DIR, 'p618-purpose-pos.json'), JSON.stringify({ n: good.length, found: found.length, notFirst: notFirst.length, rows: res }, null, 1))
console.log(`→ ${path.join(DIR, 'p618-purpose-pos.json')}`)
