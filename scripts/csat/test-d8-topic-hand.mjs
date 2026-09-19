// scripts/csat/test-d8-topic-hand.mjs
//
// **D8 재검 — 손판독 300편 전수로 다시 건다.**
//
// D8("소재 구성은 회차마다 다시 정하는 게 아니라 고정된 배합")은 키워드 분류기 라벨로
// 카이제곱 p=0.2544 를 얻어 세운 것이었다. 그 분류기가 **카파 0.40** 임이 드러나
// **기각 → 판정 보류**로 내려갔다(§6.11.4). 무딘 자로 낸 null 은 아무 말도 하지 않는다.
//
// 여는 조건은 하나였다 — **카파 0.6 이상의 소재 분류**.
// 임베딩이 없으므로 **300편을 전수 손판독**했다. 그러면 분류기 타당도 문제가 아예 사라진다 —
// 판정자가 곧 자다.
//
// 여기서 두 가지를 한다:
//   1. **키워드 분류기 vs 손판독 300편 전수** — 카파를 확정한다(앞 판은 표본 48편이었다)
//   2. **손판독 라벨로 회차 × 소재 독립성 재검** — 순열검정 20,000회
//
// ⚠️ **단일 판정자다.** 판독자 간 신뢰도는 못 잰다. 그러나 **키워드 목록보다는 낫다** —
//    적어도 지문을 읽고 판정했고, 기계 라벨을 모르는 채로 했다.
//    이 한계는 결과와 함께 문서에 적는다.
//
// 실행: pnpm dlx tsx scripts/csat/test-d8-topic-hand.mjs

import fs from 'node:fs'
import path from 'node:path'

const WORK = path.resolve('scripts/csat/topic-blind')
const DIR = path.resolve('scripts/csat/data')
const ITER = 20000
const mkRnd = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }

const mach = new Map()
for (const r of JSON.parse(fs.readFileSync(path.join(DIR, 'topic-distribution.json'), 'utf8')).rows) {
  mach.set(`${r.exam}#${r.no}`, r.topic ?? '분류불가')
}

const hand = new Map()
for (const f of fs.readdirSync(WORK).filter((x) => x.endsWith('.out.json')).sort()) {
  for (const it of JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')).items) hand.set(it.id, it.hand)
}

const rows = [...hand.entries()].map(([id, h]) => ({ id, exam: id.split('#')[0], hand: h, mach: mach.get(id) ?? null })).filter((r) => r.mach)

console.log('D8 재검 — 손판독 300편 전수')
console.log('='.repeat(78))
console.log(`  손판독 ${hand.size}편 · 기계 라벨과 짝지어진 것 ${rows.length}편`)
console.log('')

// ── 1. 카파 확정 ────────────────────────────────────────────────────────────
const agree = rows.filter((r) => r.hand === r.mach).length
const po = agree / rows.length
const cats = [...new Set(rows.flatMap((r) => [r.hand, r.mach]))].sort()
let pe = 0
for (const c of cats) {
  pe += (rows.filter((r) => r.hand === c).length / rows.length) * (rows.filter((r) => r.mach === c).length / rows.length)
}
const kappa = (po - pe) / (1 - pe)
console.log('  1. 키워드 분류기 타당도 — 전수 확정')
console.log('  ' + '-'.repeat(74))
console.log(`    일치 ${agree}/${rows.length} = ${(100 * po).toFixed(1)}%  ·  우연 기대 ${(100 * pe).toFixed(1)}%  ·  **카파 ${kappa.toFixed(3)}**`)
console.log(`    (앞 판: 표본 12편 83% → 표본 48편 카파 0.398 → **전수 ${rows.length}편 카파 ${kappa.toFixed(3)}**)`)

console.log('')
console.log('  소재 분포 — 기계 vs 손판독')
console.log('  ' + '-'.repeat(74))
console.log('    소재            기계        손판독      차')
for (const c of cats) {
  const m = rows.filter((r) => r.mach === c).length
  const h = rows.filter((r) => r.hand === c).length
  const d = (100 * h / rows.length) - (100 * m / rows.length)
  console.log(`    ${c.padEnd(12)} ${String(m).padStart(4)} (${(100 * m / rows.length).toFixed(1).padStart(4)}%)  ${String(h).padStart(4)} (${(100 * h / rows.length).toFixed(1).padStart(4)}%)  ${(d >= 0 ? '+' : '') + d.toFixed(1)}%p`)
}

// ── 2. 회차 × 소재 독립성 — 손판독 라벨로 ────────────────────────────────────
const exams = [...new Set(rows.map((r) => r.exam))].sort()
function chi2(labels) {
  const obs = {}
  for (const e of exams) { obs[e] = {}; for (const c of cats) obs[e][c] = 0 }
  rows.forEach((r, i) => { obs[r.exam][labels[i]] += 1 })
  const rowSum = Object.fromEntries(exams.map((e) => [e, cats.reduce((s, c) => s + obs[e][c], 0)]))
  const colSum = Object.fromEntries(cats.map((c) => [c, exams.reduce((s, e) => s + obs[e][c], 0)]))
  let x = 0
  for (const e of exams) for (const c of cats) {
    const exp = (rowSum[e] * colSum[c]) / rows.length
    if (exp > 0) x += ((obs[e][c] - exp) ** 2) / exp
  }
  return x
}
const labels = rows.map((r) => r.hand)
const obsChi = chi2(labels)
const rnd = mkRnd(20260826)
let ge = 0
let le = 0
let sum = 0
for (let t = 0; t < ITER; t += 1) {
  const sh = labels.slice()
  for (let i = sh.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); const tmp = sh[i]; sh[i] = sh[j]; sh[j] = tmp }
  const x = chi2(sh)
  sum += x
  if (x >= obsChi) ge += 1
  if (x <= obsChi) le += 1
}
const pPerm = (ge + 1) / (ITER + 1)
// **아래쪽 꼬리도 본다.** 관측 카이제곱이 귀무 평균보다 낮으면 "차이 없음" 이 아니라
// **무작위 배분보다도 고르다** 는 뜻일 수 있다 — 그것이 곧 "고정된 배합" 의 모양이다.
const pLower = (le + 1) / (ITER + 1)
const nullMean = sum / ITER
const df = (exams.length - 1) * (cats.length - 1)

console.log('')
console.log('  2. 회차 × 소재 독립성 — **손판독 라벨로**')
console.log('  ' + '-'.repeat(74))
console.log(`    회차 ${exams.length} × 소재 ${cats.length} · 지문 ${rows.length}`)
console.log(`    카이제곱 ${obsChi.toFixed(1)} (df ${df}) · 순열 20,000회 **p = ${pPerm.toFixed(4)}**`)
console.log(`    (앞 판, 기계 라벨: 카이제곱 138.5 df 128 p=0.2544)`)
console.log(`    귀무 평균 카이제곱 ${nullMean.toFixed(1)} — 관측이 ${obsChi < nullMean ? "**낮다**(무작위보다 고르다)" : "높다"} · 아래쪽 꼬리 p = ${pLower.toFixed(4)}`)
console.log('')
if (pPerm < 0.05) {
  console.log('    → **회차마다 소재 구성이 다르다.** D8 은 기각이고, 앞 판의 "고정된 배합" 은 틀렸다.')
} else {
  console.log('    → **여전히 독립을 기각하지 못한다.** 그런데 이번엔 자가 무디지 않다 —')
  console.log(`      카파 ${kappa.toFixed(2)} 짜리 기계가 아니라 지문을 읽은 판독이다.`)
  console.log('      **이제 null 이 무언가를 말한다: 회차별 소재 구성은 무작위 배분과 구분되지 않는다.**')
  console.log('      ⚠️ 다만 독립을 기각 못 한 것이 "고정" 의 증명은 아니다 —')
  console.log(`        ${exams.length}×${cats.length} 표에 지문 ${rows.length}편이면 칸당 ${(rows.length / (exams.length * cats.length)).toFixed(1)}편이라 검정력이 낮다.`)
}

fs.writeFileSync(path.join(DIR, 'd8-topic-hand.json'), JSON.stringify({
  n: rows.length, agree, po, pe, kappa,
  dist: cats.map((c) => ({ cat: c, mach: rows.filter((r) => r.mach === c).length, hand: rows.filter((r) => r.hand === c).length })),
  chi2: obsChi, df, pPerm, pLower, nullMean, exams: exams.length, cats: cats.length,
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'd8-topic-hand.json')}`)
