// scripts/csat/build-bands-all.mjs
//
// **37 현행 유형 전부에 계측 대역을 붙인다.**
//
// `check-passage-band.mjs` 의 대역은 17 유형에서 멈춰 있었다. 이유는 둘이었다:
//   1) 장문(41~45)은 지문이 문항 번호 밑이 아니라 `[41~42]` 머리글 밑에 한 번만 있다
//      → `setBlockFor()` 로 세트 지문을 세트 구성원 전부에 귀속시킨다.
//   2) 듣기(1~17)는 문제지에 지문이 없다 → 대본(`listening-all.json`, 2017~2023 7개년)으로 잰다.
//
// ⚠️ **표본 연수가 다르다** — 독해·장문 14개년 / 듣기 7개년. 대역마다 `years` 로 적어 둔다.
//    듣기 대역을 "14개년" 이라고 적으면 거짓이다.
//
// 실행: node scripts/csat/build-bands-all.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, setBlockFor, passageOf, allRows } from './lib-passage.mjs'
import { cleanPassage, looksInterleaved } from './clean-passage.mjs'

const DIR = path.resolve('scripts/csat/data')
const W = (s) => (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? [])
const S = (s) => s.split(/[.!?]+\s/).filter((x) => x.trim().length > 3)

export function metrics(p) {
  const w = W(p)
  return {
    chars: p.length,
    words: w.length,
    sentLen: w.length / Math.max(1, S(p).length),
    wordLen: w.reduce((s, x) => s + x.length, 0) / Math.max(1, w.length),
    ttr: new Set(w.map((x) => x.toLowerCase())).size / Math.max(1, w.length),
  }
}

const q = (a, x) => { const s = [...a].sort((m, n) => m - n); return s[Math.floor(x * (s.length - 1))] }

/** 독해·장문 — 문항 블록, 없으면 세트 머리글 블록 */
function readingSamples() {
  const ref = {}, years = {}, mock = {}
  for (const r of allRows()) {
    let p = null
    let typical = 1000
    const b = itemBlocks(r.exam, r.no)[0]
    if (b) p = cleanPassage(passageOf(b))
    if (!p || p.length < 150) {
      const sb = setBlockFor(r.exam, r.no)
      if (sb) { p = cleanPassage(passageOf(sb)); typical = r.no >= 43 ? 2400 : 1600 }
    }
    if (!p || p.length < 150) continue
    // ⚠️ 장문 세트 지문은 원래 2,000자대다 — 기본 임계(1,800자)로 재면 **정상 지문이 전부 오염으로 걸린다**
    //    (43~45 는 14개년 중 2편만 살아남았다). 세트 길이에 맞춘 임계를 준다.
    if (looksInterleaved(p, typical)) continue
    const m = metrics(p)
    if (r.src === '모평') { (mock[r.type] ??= []).push(m); continue }
    ;(ref[r.type] ??= []).push(m)
    ;(years[r.type] ??= new Set()).add(r.exam)
  }
  return { ref, years, mock }
}

/** 듣기 — 대본 */
function listeningSamples() {
  const f = path.join(DIR, 'listening-all.json')
  if (!fs.existsSync(f)) return { ref: {}, years: {}, extra: {} }
  const L = JSON.parse(fs.readFileSync(f, 'utf8'))
  const cls = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8'))
  const typeOf = new Map(cls.rows.map((r) => [`${r.exam}#${r.no}`, r.type]))
  const ref = {}, years = {}, extra = {}
  for (const it of L.items) {
    const t = typeOf.get(`${it.exam}#${it.no}`)
    if (!t) continue
    const text = (it.turns ?? []).map((x) => x.text).join(' ').replace(/\s+/g, ' ').trim()
    if (!text || W(text).length < 20) continue
    ;(ref[t] ??= []).push(metrics(text))
    ;(extra[t] ??= []).push({ nTurns: it.nTurns ?? (it.turns ?? []).length, speakers: (it.speakers ?? []).length })
    ;(years[t] ??= new Set()).add(it.exam)
  }
  return { ref, years, extra }
}

function bandOf(rows, keys) {
  const out = {}
  for (const k of keys) {
    const v = rows.map((x) => x[k]).filter((x) => Number.isFinite(x))
    if (!v.length) continue
    out[k] = { lo: q(v, 0.1), mid: q(v, 0.5), hi: q(v, 0.9), n: v.length }
  }
  return out
}

const inv = JSON.parse(fs.readFileSync(path.join(DIR, 'type-inventory.json'), 'utf8'))
const current = inv.rows.filter((r) => r.current)

const R = readingSamples()
const Ls = listeningSamples()
const KEYS = ['chars', 'words', 'sentLen', 'wordLen', 'ttr']

const bands = {}
for (const row of current) {
  const t = row.type
  const isL = row.sec === '듣기'
  const rows = isL ? Ls.ref[t] : R.ref[t]
  const yrs = isL ? Ls.years[t] : R.years[t]
  const MIN = 7
  if (!rows || rows.length < MIN) { bands[t] = { n: rows?.length ?? 0, ok: false, source: isL ? '대본' : '문제지' }; continue }
  const b = bandOf(rows, KEYS)
  if (isL) Object.assign(b, bandOf(Ls.extra[t], ['nTurns', 'speakers']))
  bands[t] = { n: rows.length, ok: true, source: isL ? '대본' : '문제지', years: [...yrs].sort(), nMock: isL ? 0 : (R.mock[t]?.length ?? 0), ...b }
}

const okN = Object.values(bands).filter((b) => b.ok).length
fs.writeFileSync(path.join(DIR, 'type-bands-all.json'), JSON.stringify({
  builtAt: 'build-bands-all.mjs',
  rule: 'n>=7 표본(수능만), 10/50/90 분위. 독해·장문 = 수능 14개년 문제지 · 듣기 = 대본 7개년(2017~2023)',
  denominator: current.length,
  covered: okN,
  bands,
}, null, 1))

console.log(`대역 확보 ${okN}/${current.length}`)
console.log('')
console.log(['type', 'n', '출처', '연수', 'words lo~mid~hi', 'sentLen', 'wordLen', 'ttr'].join('\t'))
for (const row of current) {
  const b = bands[row.type]
  if (!b.ok) { console.log([row.type, b.n, b.source, '-', '— 표본 부족'].join('\t')); continue }
  console.log([row.type, b.n, b.source, b.years.length,
    `${b.words.lo}~${b.words.mid}~${b.words.hi}`,
    b.sentLen.mid.toFixed(1), b.wordLen.mid.toFixed(2), b.ttr.mid.toFixed(3)].join('\t'))
}
console.log(`\n→ ${path.join(DIR, 'type-bands-all.json')}`)
