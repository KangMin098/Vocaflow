// scripts/csat/check-passage-band.mjs
//
// **지문 하나를 유형별 기출 대역에 대고 재는 자.**
//
// §10.12 는 서로 다른 세 소스로 세 번 만들어도 **76~82% 에서 천장**이라는 것을 보였고,
// §10.14 는 그 이유를 찾았다 — 유형별 대역을 **동시에** 만족하는 소스가 저장소에 **0편**이다.
// 병목은 **평균 낱말 길이 4.85~5.25**(531편 중 22편, 4.1%)이고,
// 그것과 **문장당 낱말 18~22.5** 를 함께 만족하는 것은 **2편**뿐이다.
// 즉 **어려운 낱말을 쓰는 글은 문장이 짧고, 문장이 긴 글은 낱말이 쉽다.**
//
// 그래서 남은 길은 소스를 **고르는** 것이 아니라 대역을 **겨냥해 쓰는** 것이다 —
// 사용자가 건 전제("소스 선별은 파이프라인 고도화")가 가리키는 바로 그 일이다.
//
// 이 파일은 그 작업을 위한 **자**다. 지문을 넣으면 유형 대역 안인지 즉시 말해 준다.
// 파이프라인의 작문 게이트로 그대로 쓸 수 있다.
//
// 실행: pnpm dlx tsx scripts/csat/check-passage-band.mjs <유형> <파일>
//   예: pnpm dlx tsx scripts/csat/check-passage-band.mjs R-BLANK draft.txt

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, choicesOf, allRows } from './lib-passage.mjs'

const [, , typeArg, fileArg] = process.argv
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

/** 유형별 기출 대역 — 10 / 50 / 90 분위 */
export function bands() {
  const ref = {}
  for (const r of allRows()) {
    const b = itemBlocks(r.exam, r.no)[0]
    if (!b) continue
    const p = passageOf(b)
    if (!p || p.length < 150) continue
    ;(ref[r.type] ??= []).push(metrics(p))
  }
  const q = (a, x) => { const s = [...a].sort((m, n) => m - n); return s[Math.floor(x * (s.length - 1))] }
  const out = {}
  for (const [t, rows] of Object.entries(ref)) {
    if (rows.length < 8) continue
    out[t] = {}
    for (const k of ['chars', 'words', 'sentLen', 'wordLen', 'ttr']) {
      const v = rows.map((x) => x[k])
      out[t][k] = { lo: q(v, 0.1), mid: q(v, 0.5), hi: q(v, 0.9), n: rows.length }
    }
  }
  return out
}

if (typeArg && fileArg) {
  const B = bands()
  const band = B[typeArg]
  if (!band) { console.log(`유형 ${typeArg} 의 기출 표본이 부족하다. 가능: ${Object.keys(B).join(' ')}`); process.exit(1) }
  const text = fs.readFileSync(fileArg, 'utf8').replace(/\s+/g, ' ').trim()
  const m = metrics(text)
  console.log(`지문 대역 검사 — ${typeArg} (기출 ${band.chars.n}편)`)
  console.log('='.repeat(70))
  const NAME = { chars: '글자수', words: '낱말수', sentLen: '문장당 낱말', wordLen: '낱말 길이', ttr: '어휘 다양도' }
  let ok = 0
  for (const k of ['chars', 'words', 'sentLen', 'wordLen', 'ttr']) {
    const b = band[k]
    const inB = m[k] >= b.lo && m[k] <= b.hi
    if (inB) ok += 1
    const d = k === 'chars' || k === 'words' ? 0 : k === 'ttr' ? 3 : 2
    const arrow = m[k] < b.lo ? '↓ 낮다' : m[k] > b.hi ? '↑ 높다' : ''
    console.log(`  ${NAME[k].padEnd(10)} ${m[k].toFixed(d).padStart(8)}   대역 ${b.lo.toFixed(d)} ~ ${b.hi.toFixed(d)} (중앙 ${b.mid.toFixed(d)})  ${inB ? '안' : '**밖**'} ${arrow}`)
  }
  console.log('')
  console.log(`  대역 안 **${ok}/5**`)
  if (ok < 5) {
    console.log('')
    console.log('  고치는 법')
    if (m.wordLen < band.wordLen.lo) console.log('    · 낱말 길이가 낮다 — 라틴계 추상 명사로 바꾼다(use → employ, show → demonstrate)')
    if (m.wordLen > band.wordLen.hi) console.log('    · 낱말 길이가 높다 — 전문 용어를 일상어로 낮춘다')
    if (m.sentLen < band.sentLen.lo) console.log('    · 문장이 짧다 — 두 문장을 접속사·관계사로 잇는다')
    if (m.sentLen > band.sentLen.hi) console.log('    · 문장이 길다 — 한 문장을 둘로 쪼갠다')
    if (m.ttr > band.ttr.hi) console.log('    · 어휘 다양도가 높다 — 핵심어를 반복해 결속을 만든다(기출은 같은 낱말을 되풀이한다)')
    if (m.ttr < band.ttr.lo) console.log('    · 어휘 다양도가 낮다 — 같은 낱말 반복을 줄인다')
    if (m.chars < band.chars.lo) console.log(`    · 지문이 짧다 — 중앙 ${band.chars.mid.toFixed(0)}자를 겨냥한다`)
    if (m.chars > band.chars.hi) console.log(`    · 지문이 길다 — 중앙 ${band.chars.mid.toFixed(0)}자를 겨냥한다`)
  }
} else if (!typeArg) {
  const B = bands()
  console.log('유형별 기출 대역 (10 ~ 50 ~ 90 분위)')
  console.log('='.repeat(78))
  console.log('유형          n   글자수          문장당낱말      낱말길이        어휘다양도')
  for (const [t, b] of Object.entries(B)) {
    if (!t.startsWith('R-')) continue
    const f = (k, d) => `${b[k].lo.toFixed(d)}~${b[k].mid.toFixed(d)}~${b[k].hi.toFixed(d)}`
    console.log(`${t.replace('R-', '').padEnd(13)}${String(b.chars.n).padStart(3)}  ${f('chars', 0).padEnd(15)} ${f('sentLen', 1).padEnd(15)} ${f('wordLen', 2).padEnd(15)} ${f('ttr', 2)}`)
  }
  const DIR = path.resolve('scripts/csat/data')
  fs.writeFileSync(path.join(DIR, 'type-bands.json'), JSON.stringify(B, null, 1))
  console.log(`\n→ ${path.join(DIR, 'type-bands.json')}`)
}
