// scripts/csat/test-p37-grammar-slot.mjs
//
// **P3.7 — "어법에서 형용사·부사는 13년간 정답 0회 = 오답 전용 자리" 를 관문에 건다.**
//
// 초안은 이것을 [실측] 으로 적었지만, 이 저장소가 실제로 한 것은 **관측(0/13)** 뿐이다.
// 0/13 은 그 자체로는 아무것도 아니다 — 기저를 봐야 한다.
// 밑줄 65개 중 형용사·부사가 몇 개인지에 따라 0/13 의 뜻이 완전히 달라진다:
//
//   · 밑줄의 40% 가 형용사·부사인데 정답이 0회면 → 강한 회피 (p ≈ 0.4^13)
//   · 밑줄의 5% 뿐이라면 → 0회는 그냥 드문 것이지 회피가 아니다 (p ≈ 0.51)
//
// G2(기저확률) 를 지키는 형태로 재고, 다른 문법 범주에도 같은 검사를 걸어
// **"오답 전용 자리" 가 형용사·부사만의 성질인지** 본다.
//
// 실행: pnpm dlx tsx scripts/csat/test-p37-grammar-slot.mjs

import fs from 'node:fs'
import path from 'node:path'
import { binomUpper } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const h3 = JSON.parse(fs.readFileSync(path.join(DIR, 'blueprint-v0-h3h7.json'), 'utf8')).H3
const spans = h3.detail

// 문항별로 묶는다 — 회차마다 밑줄 5개 중 정답 1개
const byItem = new Map()
for (const s of spans) {
  const k = `${s.exam}#${s.no}`
  if (!byItem.has(k)) byItem.set(k, [])
  byItem.get(k).push(s)
}

const cats = [...new Set(spans.map((s) => s.label))].sort()

console.log('P3.7 — 문법 범주별 "정답 자리" 검정 (밑줄 분포를 기저로)')
console.log('='.repeat(78))
console.log(`  문항 ${byItem.size} · 밑줄 ${spans.length}`)
console.log()
console.log('  범주                    밑줄   기저    정답   기대   이항 p        판정')
console.log('  ' + '-'.repeat(74))

const results = []
for (const cat of cats) {
  const under = spans.filter((s) => s.label === cat).length
  // 기저 = 이 범주가 밑줄에서 차지하는 비율. 정답이 밑줄 중 무작위라면 이 확률로 뽑힌다.
  const base = under / spans.length
  const hit = spans.filter((s) => s.label === cat && s.isAnswer).length
  const n = byItem.size
  const expect = base * n
  // 양쪽을 다 본다 — 몰림(upper)과 회피(lower)
  const pHigh = binomUpper(n, hit, base)
  // 회피 검정: k 이하가 나올 확률 = 1 - P(X >= k+1)
  const pLow = 1 - binomUpper(n, hit + 1, base)
  const p = Math.min(pHigh, pLow)
  const dir = hit > expect ? '몰림' : hit < expect ? '회피' : '중립'
  const verdict = p < 0.05 ? `**${dir} (p=${p.toFixed(4)})**` : `근거 없음`
  results.push({ cat, under, base, hit, n, expect, pHigh, pLow, p, dir, sig: p < 0.05 })
  console.log(
    `  ${cat.padEnd(22)} ${String(under).padStart(4)} ${(base * 100).toFixed(1).padStart(6)}% ` +
    `${String(hit).padStart(6)} ${expect.toFixed(1).padStart(6)} ${p.toFixed(4).padStart(9)}   ${verdict}`,
  )
}

// Holm 보정 — 범주를 전부 훑었으므로 다중비교다
const sorted = [...results].sort((a, b) => a.p - b.p)
const m = sorted.length
let maxAdj = 0
for (let i = 0; i < m; i += 1) {
  const adj = Math.min(1, Math.max(maxAdj, sorted[i].p * (m - i)))
  sorted[i].holm = adj
  maxAdj = adj
}

console.log()
console.log('  Holm 보정 (범주 ' + m + '개를 전부 훑었으므로 다중비교다)')
console.log('  ' + '-'.repeat(74))
for (const r of sorted) {
  console.log(`  ${r.cat.padEnd(22)} raw ${r.p.toFixed(4)}  →  Holm ${r.holm.toFixed(4)}  ${r.holm < 0.05 ? '✓ 유의' : '✗'}`)
}

const adj = results.find((r) => /형용사|부사/.test(r.cat))
console.log()
console.log('  P3.7 판정')
console.log('  ' + '-'.repeat(74))
if (adj) {
  const s = sorted.find((x) => x.cat === adj.cat)
  console.log(`    형용사·부사 밑줄 ${adj.under}/${spans.length} = 기저 ${(adj.base * 100).toFixed(1)}%`)
  console.log(`    정답 ${adj.hit}/${adj.n}회 · 기대 ${adj.expect.toFixed(1)}회`)
  console.log(`    회피 검정 raw p = ${adj.pLow.toFixed(4)} · Holm 보정 p = ${s.holm.toFixed(4)}`)
  console.log()
  if (s.holm < 0.05) {
    console.log('    → **오답 전용 자리라는 진술이 보정 후에도 살아남는다.**')
  } else if (adj.pLow < 0.05) {
    console.log('    → raw 로는 유의하나 **보정을 못 견딘다.** 사전 가설이 아니었으므로 SOFT 이하.')
  } else {
    console.log(`    → **기저가 낮아 0회는 놀랍지 않다.** 기대값이 ${adj.expect.toFixed(1)}회뿐이므로`)
    console.log('       0회를 "회피" 로 읽을 근거가 없다. 초안의 [실측] 태그는 과장이다.')
  }
}

fs.writeFileSync(path.join(DIR, 'p37-grammar-slot.json'), JSON.stringify({ items: byItem.size, spans: spans.length, results: sorted }, null, 1))
console.log(`\n→ ${path.join(DIR, 'p37-grammar-slot.json')}`)
