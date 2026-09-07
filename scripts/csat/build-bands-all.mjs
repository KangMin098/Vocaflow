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

/**
 * ⚠️ **대리 대역.** 두 유형은 자기 표본으로 대역을 못 만든다:
 *   L-MAIN — 2024학년도 신설인데 이 저장소의 대본은 2017~2023 뿐이라 **표본 0**
 *   L-TODO — 7개년 중 6개년에만 출제돼 **n=6**
 * 표본이 없다고 설계도를 비워 두는 대신, **가장 가까운 친족 유형의 대역을 빌려 쓰되 빌린 표시를 남긴다.**
 * 친족은 자료를 보기 전에 **발화 구조**로 고른다(독백↔독백 · 대화↔대화) — 사후에 잘 맞는 것을 고르지 않는다.
 * 빌린 대역은 그 유형의 관측이 아니므로, **대본이 확보되면 반드시 교체해야 한다.**
 */
const PROXY = {
  'L-MAIN': { from: 'L-PURPOSE', why: '둘 다 화자 1인 독백(발화 1). 요지와 목적은 담화 길이·문형이 같은 계열' },
  'L-TODO': { from: 'L-REASON', why: '둘 다 화자 2인 대화(발화 10~13). 요청·설명 구조가 같은 계열' },
}
for (const [t, p] of Object.entries(PROXY)) {
  if (bands[t]?.ok) continue
  const src = bands[p.from]
  if (!src?.ok) continue
  bands[t] = { ...src, ok: true, proxy: p.from, proxyWhy: p.why, ownN: bands[t]?.n ?? 0 }
}

const okN = Object.values(bands).filter((b) => b.ok).length
const proxyN = Object.values(bands).filter((b) => b.proxy).length
fs.writeFileSync(path.join(DIR, 'type-bands-all.json'), JSON.stringify({
  builtAt: 'build-bands-all.mjs',
  rule: 'n>=7 표본(수능만), 10/50/90 분위. 독해·장문 = 수능 14개년 문제지 · 듣기 = 대본 7개년(2017~2023)',
  denominator: current.length,
  covered: okN,
  proxied: proxyN,
  bands,
}, null, 1))

console.log(`대역 확보 ${okN}/${current.length} (그중 대리 ${proxyN})`)
console.log('')
console.log(['type', 'n', '출처', '연수', 'words lo~mid~hi', 'sentLen', 'wordLen', 'ttr', '비고'].join('\t'))
for (const row of current) {
  const b = bands[row.type]
  if (!b.ok) { console.log([row.type, b.n, b.source, '-', '— 표본 부족'].join('\t')); continue }
  console.log([row.type, b.n, b.source, b.years.length,
    `${b.words.lo}~${b.words.mid}~${b.words.hi}`,
    b.sentLen.mid.toFixed(1), b.wordLen.mid.toFixed(2), b.ttr.mid.toFixed(3),
    b.proxy ? `대리 ← ${b.proxy} (자기 표본 ${b.ownN})` : ''].join('\t'))
}
console.log(`\n→ ${path.join(DIR, 'type-bands-all.json')}`)
