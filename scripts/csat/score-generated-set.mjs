// scripts/csat/score-generated-set.mjs
//
// **축 ③ — 만든 문항이 기출의 계측 범위 안에 드는가.**
//
// ⚠️ **자기 채점의 순환을 먼저 갈라야 한다.**
// 나는 §6.15(정답은 한 층위 위)·§6.12(오답이 지문을 문다)를 **보고** 문항을 만들었다.
// 그 축으로 재면 당연히 맞는다. 그건 품질의 증거가 아니라 **내가 규칙을 따랐다는 확인**일 뿐이다.
//
// 그래서 축을 둘로 가른다:
//   **A. 겨냥하지 않은 축** — 지문 길이 · 문장 길이 · 낱말 길이 · 어휘 다양도 · 선지 길이.
//      만들 때 이 값들을 목표로 삼지 않았다. **여기서 기출 범위를 벗어나면 진짜 결함이다.**
//   **B. 겨냥한 축** — 정답 길이순위 · (추상도·반향은 손판독이 필요해 여기선 뺀다).
//      맞아도 증거가 아니다. **순환**이라고 표시해서 적는다.
//
// 기출 분포는 같은 유형에서만 뽑는다 — 유형이 다르면 지문 길이도 선지 길이도 다르다.
//
// 실행: pnpm dlx tsx scripts/csat/score-generated-set.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, choicesOf, answerOf, allRows } from './lib-passage.mjs'

const DIR = path.resolve('scripts/csat/data')
const SET = (process.argv.find((x) => x.startsWith('--set=')) ?? '').split('=')[1] || 'generated-set-v1.json'
const gen = JSON.parse(fs.readFileSync(path.join(DIR, SET), 'utf8'))

// ⚠️ **채점기 결함 둘을 먼저 고쳤다.**
// ① 마커형(어법·어휘·무관·삽입)은 기출 쪽 choicesOf 가 **선지가 아니라 지문 조각**을 돌려준다.
//    낱말 선지와 지문 조각을 견주면 당연히 '밖' 이 나온다 — 그 축을 이 유형에서 뺀다.
// ② 순서 문항은 (A)(B)(C) 블록이 지문의 일부다. 도입문만 재면 147자가 나온다.
const MARKER_IN = new Set(['R-GRAMMAR', 'R-VOCAB', 'R-IRRELEVANT', 'R-INSERT'])
for (const it of gen.items) {
  if (it.blocks) it.passage = it.passage + ' ' + Object.values(it.blocks).join(' ')
}

const words = (s) => (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? [])
const sentences = (s) => s.split(/[.!?]+\s/).filter((x) => x.trim().length > 3)
const metrics = (passage, choices) => {
  const w = words(passage)
  const sent = sentences(passage)
  return {
    chars: passage.length,
    words: w.length,
    sentLen: w.length / Math.max(1, sent.length),
    wordLen: w.reduce((s, x) => s + x.length, 0) / Math.max(1, w.length),
    ttr: new Set(w.map((x) => x.toLowerCase())).size / Math.max(1, w.length),
    choiceLen: choices ? choices.reduce((s, c) => s + c.length, 0) / choices.length : null,
  }
}

// ── 기출 분포 (같은 유형만) ──────────────────────────────────────────────────
const ref = {}
for (const r of allRows()) {
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const p = passageOf(b)
  if (!p || p.length < 150) continue
  const ch = choicesOf(b)
  const m = metrics(p, ch && ch.every((c) => c.length >= 2) ? ch : null)
  ;(ref[r.type] ??= []).push(m)
}

const pct = (arr, v) => arr.filter((x) => x <= v).length / arr.length
const qs = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))] }

console.log('축 ③ — 만든 문항이 기출 계측 범위 안에 드는가')
console.log('='.repeat(78))
console.log(`  만든 문항 ${gen.items.length} · 지문 출처 CC0 ${gen.sources.length}편 (기출 지문 0편)`)
console.log('')

const AXES = [
  { k: 'chars', name: '지문 글자수', aimed: false },
  { k: 'words', name: '지문 낱말수', aimed: false },
  { k: 'sentLen', name: '문장당 낱말', aimed: false },
  { k: 'wordLen', name: '낱말 길이', aimed: false },
  { k: 'ttr', name: '어휘 다양도', aimed: false },
  { k: 'choiceLen', name: '선지 길이', aimed: false },
]

const rows = []
for (const it of gen.items) {
  const R = ref[it.type]
  if (!R || R.length < 5) { console.log(`  ${it.no}번 ${it.type} — 기출 표본 부족(${R?.length ?? 0}) 대조 불가`); continue }
  const m = metrics(it.passage, it.choices)
  const out = { no: it.no, type: it.type, n: R.length, axes: {} }
  for (const a of AXES) {
    if (a.k === 'choiceLen' && MARKER_IN.has(it.type)) continue  // 채점기 결함 ① 회피
    const vals = R.map((x) => x[a.k]).filter((x) => x != null)
    if (!vals.length || m[a.k] == null) continue
    const p = pct(vals, m[a.k])
    out.axes[a.k] = { v: m[a.k], p, lo: qs(vals, 0.1), hi: qs(vals, 0.9), inBand: p >= 0.1 && p <= 0.9 }
  }
  rows.push(out)
}

console.log('  A. **겨냥하지 않은 축** — 만들 때 목표로 삼지 않은 값. 벗어나면 진짜 결함이다')
console.log('  ' + '-'.repeat(74))
console.log('    번호 유형        축            값      기출 10~90%대역     백분위  판정')
let inBand = 0
let total = 0
for (const r of rows) {
  for (const a of AXES) {
    const x = r.axes[a.k]
    if (!x) continue
    total += 1
    if (x.inBand) inBand += 1
    const fmt = (v) => (v >= 100 ? Math.round(v) : v.toFixed(2))
    console.log(`    ${String(r.no).padStart(3)} ${r.type.replace(/^[RX]-/, '').padEnd(10)} ${a.name.padEnd(10)} ${String(fmt(x.v)).padStart(6)}   ${String(fmt(x.lo)).padStart(6)} ~ ${String(fmt(x.hi)).padEnd(7)} ${(100 * x.p).toFixed(0).padStart(4)}%   ${x.inBand ? '안' : '**밖**'}`)
  }
}
console.log('')
console.log(`    대역 안 **${inBand}/${total} = ${(100 * inBand / total).toFixed(1)}%** (기출 10~90% 대역 기준)`)

// 축별 요약
console.log('')
console.log('    축별')
for (const a of AXES) {
  const xs = rows.map((r) => r.axes[a.k]).filter(Boolean)
  if (!xs.length) continue
  const ok = xs.filter((x) => x.inBand).length
  const med = xs.map((x) => x.p).sort((p, q) => p - q)[Math.floor(xs.length / 2)]
  console.log(`      ${a.name.padEnd(10)} ${ok}/${xs.length} 안  ·  백분위 중앙값 ${(100 * med).toFixed(0)}%`)
}

console.log('')
console.log('  B. **겨냥한 축** — 규칙을 보고 만들었으므로 맞아도 증거가 아니다 (순환)')
console.log('  ' + '-'.repeat(74))
const blanks = gen.items.filter((x) => x.type === 'R-BLANK')
for (const it of blanks) {
  const lens = it.choices.map((c) => c.length)
  const k = it.answer - 1
  let less = 0
  let eq = 0
  for (const v of lens) { if (v < lens[k]) less += 1; else if (v === lens[k]) eq += 1 }
  const rank = less + (eq + 1) / 2
  console.log(`    ${it.no}번 빈칸 — 정답 길이순위 ${rank.toFixed(1)} (기출 빈칸 평균 2.32 · 기저 3.00)`)
}
console.log('    ⚠️ 정답을 짧게 쓰라고 §6.15 가 말했고 나는 그것을 보고 썼다. **순환이다.**')

fs.writeFileSync(path.join(DIR, SET.replace('.json', '-score.json')), JSON.stringify({ rows, inBand, total }, null, 1))
console.log(`\n→ ${path.join(DIR, 'generated-set-score.json')}`)
