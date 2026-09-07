// scripts/csat/measure-response-modes.mjs
//
// **짧은 응답(L-RESPONSE)은 한 유형이 아니라 두 유형이다.**
//
// 이 유형은 회차당 4문항으로 듣기에서 가장 많고 3점이 가장 몰린다(14개년 58문항 중 22).
// 그런데 대역을 재면 낱말 수가 38~54~146 으로 벌어져 "대역" 이라 부르기 민망했다.
// 벌어진 게 아니라 **둘로 갈라져 있었다.**
//
// 대본 7개년 28문항을 낱말 수로 늘어놓으면 **36~54 에 14개 · 127~163 에 14개**이고
// 그 사이 **55~126 구간은 완전히 비어 있다**(예외 0).
// 문항 번호로도 정확히 갈린다 — 앞자리(1·2·11·12)는 짧은 대화 3~4발화,
// 뒷자리(13·14)는 긴 대화 11~15발화다. 2021학년도에 앞자리가 1·2 → 11·12 로 옮겨졌을 뿐
// **두 갈래 구조 자체는 그대로다.**
//
// 그래서 이 유형의 설계도는 대역을 하나로 쓰면 안 된다 — **어느 갈래로 낼지 먼저 정해야 한다.**
//
// 실행: node scripts/csat/measure-response-modes.mjs

import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('scripts/csat/data')
const rd = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))

const L = rd('listening-all.json')
const cls = rd('classified.json')
const typeOf = new Map(cls.rows.map((r) => [`${r.exam}#${r.no}`, r.type]))
const W = (s) => (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length

const rows = L.items
  .filter((i) => typeOf.get(`${i.exam}#${i.no}`) === 'L-RESPONSE')
  .map((i) => ({ exam: i.exam, no: i.no, words: W((i.turns ?? []).map((t) => t.text).join(' ')), turns: (i.turns ?? []).length }))
  .sort((a, b) => a.words - b.words)

// 가장 큰 틈을 찾는다 — 자료가 스스로 경계를 말하게 한다
let cut = null
for (let i = 1; i < rows.length; i += 1) {
  const gap = rows[i].words - rows[i - 1].words
  if (!cut || gap > cut.gap) cut = { gap, lo: rows[i - 1].words, hi: rows[i].words }
}
const short = rows.filter((r) => r.words <= cut.lo)
const long = rows.filter((r) => r.words >= cut.hi)
const between = rows.filter((r) => r.words > cut.lo && r.words < cut.hi)

const q = (a, x) => { const s = [...a].sort((m, n) => m - n); return s[Math.floor(x * (s.length - 1))] }
const band = (a, k) => ({ lo: q(a.map((r) => r[k]), 0.1), mid: q(a.map((r) => r[k]), 0.5), hi: q(a.map((r) => r[k]), 0.9), n: a.length })

const out = {
  scope: '듣기 대본 7개년(2017~2023) · L-RESPONSE 28문항',
  gap: { from: cut.lo, to: cut.hi, width: cut.gap, inside: between.length },
  short: { n: short.length, nos: [...new Set(short.map((r) => r.no))].sort((a, b) => a - b), words: band(short, 'words'), turns: band(short, 'turns') },
  long: { n: long.length, nos: [...new Set(long.map((r) => r.no))].sort((a, b) => a - b), words: band(long, 'words'), turns: band(long, 'turns') },
  claim: `짧은 응답은 두 갈래다 — 짧은형 ${short.length}문항(${band(short, 'words').lo}~${band(short, 'words').hi}낱말) · 긴형 ${long.length}문항(${band(long, 'words').lo}~${band(long, 'words').hi}낱말). 그 사이 ${cut.lo + 1}~${cut.hi - 1}낱말 구간은 28문항 중 ${between.length}건 — 예외 0`,
  rows,
}
fs.writeFileSync(path.join(DIR, 'response-modes.json'), JSON.stringify(out, null, 1))

console.log(out.claim)
console.log(`짧은형 번호 ${out.short.nos.join('·')} · 발화 ${out.short.turns.lo}~${out.short.turns.hi}`)
console.log(`긴형   번호 ${out.long.nos.join('·')} · 발화 ${out.long.turns.lo}~${out.long.turns.hi}`)
console.log(`\n→ ${path.join(DIR, 'response-modes.json')}`)
