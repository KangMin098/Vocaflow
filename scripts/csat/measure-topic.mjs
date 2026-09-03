// scripts/csat/measure-topic.mjs
//
// **소재 분포 — `CSAT_BLUEPRINT.md §6-2` 가 "세지 않았다" 로 남긴 마지막 미측정 항목.**
//
// 물음은 하나다: **회차마다 소재 구성이 고정인가?**
//   고정이면 → E8(번호→능력군 고정)처럼 **자리 채우기**의 또 한 축이다
//   자유로우면 → 소재는 출제자가 실제로 고르는 몇 안 되는 것 중 하나다
//
// ⚠️ `shared_dictionary.domain_levels` 는 **쓸 수 없다** — 그건 토픽 태그가 아니라
//    도메인별 난이도라서 거의 모든 낱말이 8개 값을 다 갖는다(34~37k/38k).
//    그래서 **투명한 키워드 분류기**를 쓰고(표는 `lib-topic.mjs`), 손판독으로 정확도를 잰다.
//
// ⚠️ 분류기가 약해도 검정은 성립한다 — 오류가 **회차에 따라 달라지지 않기 때문**이다.
//    "회차 간 구성이 다른가" 는 분류 오류가 상수면 그대로 잡힌다.
//
// 실행: pnpm dlx tsx scripts/csat/measure-topic.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, allRows } from './lib-passage.mjs'
// ⚠️ 분류표는 **여기 두지 않는다** — 같은 표를 재고 쪽(`topic-gap.mjs`)도 쓰기 때문이다.
//   복사본이 생기면 한쪽만 고쳐졌을 때 두 분포의 **격차가 아니라 분류표 차이**를 재게 된다.
import { TOPICS, classify } from './lib-topic.mjs'

const DIR = path.resolve('scripts/csat/data')


// ── 지문 모으기 ───────────────────────────────────────────────────────
const READ = ['R-PURPOSE', 'R-MOOD', 'R-CLAIM', 'R-GIST', 'R-TOPIC', 'R-TITLE', 'R-IMPLY',
  'R-GRAMMAR', 'R-VOCAB', 'R-BLANK', 'R-IRRELEVANT', 'R-ORDER', 'R-INSERT', 'R-SUMMARY']
const items = []
for (const r of allRows().filter((x) => READ.includes(x.type))) {
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const p = passageOf(b)
  if (p.length < 200) continue
  const c = classify(p)
  items.push({ exam: r.exam, no: r.no, type: r.type, topic: c.topic, margin: c.margin, chars: p.length })
}

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
const KEYS = [...Object.keys(TOPICS), '분류불가']

console.log('소재 분포 — 회차마다 구성이 고정인가')
console.log('='.repeat(78))
console.log(`  지문 ${items.length}편 (수능 14 + 모평 3)`)
console.log()
console.log('  ① 전체 분포')
console.log('  ' + '-'.repeat(74))
const tot = {}
for (const it of items) tot[it.topic] = (tot[it.topic] ?? 0) + 1
for (const k of KEYS) {
  const n = tot[k] ?? 0
  console.log(`    ${k.padEnd(12)} ${String(n).padStart(4)}  ${String(pct(n, items.length)).padStart(5)}%  ${'█'.repeat(Math.round(pct(n, items.length) / 2))}`)
}
console.log()

// ── ② 회차별 구성 ────────────────────────────────────────────────────
const exams = [...new Set(items.map((x) => x.exam))].sort()
console.log('  ② 회차별 구성 (문항 수)')
console.log('  ' + '-'.repeat(74))
console.log('  회차   ' + KEYS.map((k) => k.slice(0, 4).padStart(5)).join(''))
const table = {}
for (const e of exams) {
  const a = items.filter((x) => x.exam === e)
  table[e] = Object.fromEntries(KEYS.map((k) => [k, a.filter((x) => x.topic === k).length]))
  console.log(`  ${e.padEnd(7)}` + KEYS.map((k) => String(table[e][k]).padStart(5)).join(''))
}
console.log()

// ── ③ 회차 × 소재 독립성 (카이제곱) ──────────────────────────────────
// 귀무가설: 회차와 소재가 독립 = 모든 회차가 같은 비율에서 뽑는다 = **구성이 고정**
const rowsN = exams.map((e) => KEYS.reduce((s, k) => s + table[e][k], 0))
const colsN = KEYS.map((k) => exams.reduce((s, e) => s + table[e][k], 0))
const N = rowsN.reduce((a, b) => a + b, 0)
let chi2 = 0, cells = 0
for (let i = 0; i < exams.length; i += 1) {
  for (let j = 0; j < KEYS.length; j += 1) {
    const exp = rowsN[i] * colsN[j] / N
    if (exp <= 0) continue
    chi2 += (table[exams[i]][KEYS[j]] - exp) ** 2 / exp
    cells += 1
  }
}
const dfree = (exams.length - 1) * (KEYS.filter((k) => colsN[KEYS.indexOf(k)] > 0).length - 1)

// 순열검정 — 기대도수가 작아 카이제곱 근사가 위험하므로 소재 라벨을 섞는다
function permChi(iters = 20000) {
  const labels = items.map((x) => x.topic)
  const examOf = items.map((x) => x.exam)
  let seed = 31337, ge = 0
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  for (let k = 0; k < iters; k += 1) {
    const p = [...labels]
    for (let i = p.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1));[p[i], p[j]] = [p[j], p[i]] }
    const t = {}
    for (let i = 0; i < p.length; i += 1) { (t[examOf[i]] ??= {})[p[i]] = ((t[examOf[i]] ?? {})[p[i]] ?? 0) + 1 }
    let c = 0
    for (let i = 0; i < exams.length; i += 1) {
      for (let j = 0; j < KEYS.length; j += 1) {
        const exp = rowsN[i] * colsN[j] / N
        if (exp <= 0) continue
        c += (((t[exams[i]] ?? {})[KEYS[j]] ?? 0) - exp) ** 2 / exp
      }
    }
    if (c >= chi2) ge += 1
  }
  return (ge + 1) / (iters + 1)
}
const pPerm = permChi()

console.log('  ③ 회차 × 소재가 독립인가 (= 구성이 고정인가)')
console.log('  ' + '-'.repeat(74))
console.log(`    카이제곱 ${chi2.toFixed(1)} · 자유도 ${dfree} · **순열검정 p = ${pPerm.toFixed(4)}**`)
console.log()
if (pPerm >= 0.05) {
  console.log('  → **회차와 소재는 독립이다.** 모든 회차가 같은 비율에서 뽑은 것과 구분되지 않는다.')
  console.log('    즉 소재 구성은 회차마다 **다시 정하는 것이 아니라 고정된 배합**이다.')
} else {
  console.log('  → **회차마다 소재 구성이 다르다.** 소재는 출제자가 회차별로 고르는 축이다.')
}
console.log()
console.log('  ⚠️ 분류기의 한계 — 키워드 기반이라 오류가 있다. 다만 오류가 **회차에 따라 달라지지**')
console.log('     않으므로 ③의 독립성 검정은 그대로 성립한다. ①의 절대 비율은 오차를 안고 읽을 것.')
console.log(`     분류불가 ${pct(tot['분류불가'] ?? 0, items.length)}% · 1위-2위 격차 중앙값 ${[...items.map((x) => x.margin)].sort((a, b) => a - b)[Math.floor(items.length / 2)]}`)

fs.writeFileSync(path.join(DIR, 'topic-distribution.json'), JSON.stringify({
  n: items.length, total: tot, table, chi2, df: dfree, pPerm, rows: items,
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'topic-distribution.json')}`)
