// scripts/csat/test-blank-choice-length.mjs
//
// **G1 관문이 잡은 것 — 전체 null 이 상쇄로 만들어졌다.**
//
// `test-choice-cues.mjs` 는 577문항 전체에서 길이 단서를 기각했다(평균순위 3.046, p=0.407).
// 그런데 유형별로 보면 **빈칸 2.18** 만 방향이 다르다(고치기 전에는 순서도 3.50 이었으나 ⑤ 부풀림의 산물이었다 — §7.5).
// 전체 평균 3.05 는 "단서가 없다" 가 아니라 **상쇄된 결과**일 수 있다.
// 이게 G1(하위그룹·심슨) 관문을 두는 이유다. 그래서 유형별로 다시 건다.
//
// 검정. 유형마다 그 유형 문항의 정답 자리를 무작위로 다시 뽑아 귀무분포를 만든다
// (20,000회 · 고정 시드). 기저는 언제나 3.0 이고 가정이 아니다.
// **여러 유형을 동시에 보므로 Holm 보정을 반드시 건다.**
//
// 왜 중요한가. 참이면 이것은 **지문을 안 읽고도 쓰이는 단서**다 —
// 학습자 역산(§7)에 바로 들어가고, 동시에 §6.12(오답이 지문을 문다)의 독립 재현이 된다.
// 오답이 지문 어휘를 길게 물고 늘어지면 자연히 정답보다 길어지기 때문이다.
//
// 실행: pnpm dlx tsx scripts/csat/test-blank-choice-length.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, choicesOf, answerOf, allRows } from './lib-passage.mjs'

const DIR = path.resolve('scripts/csat/data')
const ITER = 20000
const mkRnd = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }

function avgRank(lens, idx) {
  const v = lens[idx]
  let less = 0
  let eq = 0
  for (const x of lens) { if (x < v) less += 1; else if (x === v) eq += 1 }
  return less + (eq + 1) / 2
}

const EXCLUDE = new Set(['R-GRAMMAR', 'R-VOCAB', 'R-VOCAB2'])
const rows = allRows()
const items = []
for (const r of rows) {
  if (EXCLUDE.has(r.type)) continue
  const a = answerOf(r.exam, r.no)
  if (!a) continue
  const b0 = itemBlocks(r.exam, r.no)[0]
  if (!b0) continue
  const ch = choicesOf(b0)
  if (!ch || ch.length !== 5 || ch.some((c) => !c || c.length < 2)) continue
  const lens = ch.map((c) => c.length)
  if (new Set(lens).size === 1) continue
  const k = a.answer - 1
  if (k < 0 || k > 4) continue
  items.push({ exam: r.exam, no: r.no, type: r.type, points: a.points, lens, k, rank: avgRank(lens, k), ansLen: lens[k], others: lens.filter((_, i) => i !== k) })
}

const byType = {}
for (const x of items) (byType[x.type] ??= []).push(x)
const groups = Object.entries(byType).filter(([, xs]) => xs.length >= 20).sort((a, b) => b[1].length - a[1].length)

console.log('빈칸 선지 길이 — 하위그룹을 정식으로 건다 (G1)')
console.log('='.repeat(76))
console.log(`  유형 ${groups.length}개 · 문항 ${groups.reduce((s, [, xs]) => s + xs.length, 0)}`)
console.log('')
console.log('  유형          n    평균순위   정답 글자수   오답 평균   차이     순열 p')
console.log('  ' + '-'.repeat(72))

const raw = []
for (const [t, xs] of groups) {
  const obs = xs.reduce((s, y) => s + y.rank, 0) / xs.length
  const rnd = mkRnd(20260825 + t.length * 7919)
  let ge = 0
  let le = 0
  for (let i = 0; i < ITER; i += 1) {
    let s = 0
    for (const y of xs) s += avgRank(y.lens, Math.floor(rnd() * 5))
    const m = s / xs.length
    if (m >= obs) ge += 1
    if (m <= obs) le += 1
  }
  const p = Math.min(1, 2 * Math.min((ge + 1) / (ITER + 1), (le + 1) / (ITER + 1)))
  const aLen = xs.reduce((s, y) => s + y.ansLen, 0) / xs.length
  const oLen = xs.reduce((s, y) => s + y.others.reduce((q, v) => q + v, 0) / 4, 0) / xs.length
  raw.push({ type: t, n: xs.length, mean: obs, ansLen: aLen, othLen: oLen, p })
  console.log(`  ${t.padEnd(12)} ${String(xs.length).padStart(3)}   ${obs.toFixed(3)}     ${aLen.toFixed(1).padStart(6)}      ${oLen.toFixed(1).padStart(6)}   ${(aLen - oLen).toFixed(1).padStart(6)}   ${p.toFixed(4)}`)
}

// Holm — 5개 동시 검정
const sorted = [...raw].sort((a, b) => a.p - b.p)
let prev = 0
sorted.forEach((r, i) => {
  const adj = Math.min(1, (sorted.length - i) * r.p)
  r.holm = Math.max(prev, adj)
  prev = r.holm
})

console.log('')
console.log(`  Holm 보정 (${sorted.length}개 동시 검정)`)
console.log('  ' + '-'.repeat(72))
for (const r of sorted) {
  const mark = r.holm < 0.05 ? '✓ 유의' : r.p < 0.05 ? '△ raw 만' : '· null'
  console.log(`    ${r.type.padEnd(12)} raw ${r.p.toFixed(4)}  →  Holm ${r.holm.toFixed(4)}   ${mark}`)
}

// 빈칸 안에서 3점/2점 · 연도 안정성
const blanks = byType['R-BLANK'] ?? []
if (blanks.length) {
  console.log('')
  console.log('  빈칸 상세')
  console.log('  ' + '-'.repeat(72))
  const b3 = blanks.filter((x) => x.points === 3)
  const b2 = blanks.filter((x) => x.points === 2)
  const mm = (xs) => xs.reduce((s, y) => s + y.rank, 0) / xs.length
  console.log(`    3점 n=${b3.length} 평균순위 ${mm(b3).toFixed(3)}  ·  2점 n=${b2.length} 평균순위 ${mm(b2).toFixed(3)}`)
  const short = blanks.filter((x) => x.rank <= 2).length
  console.log(`    정답이 하위 2등 이내  ${short}/${blanks.length} = ${(100 * short / blanks.length).toFixed(1)}%  (기저 40%)`)
  const perExam = {}
  for (const x of blanks) (perExam[x.exam] ??= []).push(x.rank)
  const yrs = Object.entries(perExam).sort()
  const neg = yrs.filter(([, v]) => v.reduce((s, q) => s + q, 0) / v.length < 3).length
  console.log(`    회차별 평균순위 < 3 인 회차  ${neg}/${yrs.length}`)
  console.log(`      ${yrs.map(([e, v]) => `${e}:${(v.reduce((s, q) => s + q, 0) / v.length).toFixed(1)}`).join(' · ')}`)
}

// 교란 배제 — 배열 관행 × 정답 번호 편중의 부산물인가
// 선지를 짧은 것부터 늘어놓는 관행이 있고 정답이 앞 번호에 몰리면, 정답이 짧아 보이는
// 그림이 **정답과 무관하게** 만들어진다. 둘 중 하나라도 없으면 교란이 성립하지 않는다.
if (blanks.length) {
  console.log('')
  console.log('  교란 배제 — 배열 관행 × 정답 번호 편중')
  console.log('  ' + '-'.repeat(72))
  const asc = blanks.filter((x) => x.lens.every((v, i) => i === 0 || v >= x.lens[i - 1])).length
  const desc = blanks.filter((x) => x.lens.every((v, i) => i === 0 || v <= x.lens[i - 1])).length
  console.log(`    선지가 길이순 오름차순인 문항  ${asc}/${blanks.length}  ·  내림차순  ${desc}/${blanks.length}  (우연 기저 각 1/120)`)
  const slot = [0, 0, 0, 0, 0]
  for (const x of blanks) slot[x.k] += 1
  console.log(`    빈칸 정답 번호 분포  ①${slot[0]} ②${slot[1]} ③${slot[2]} ④${slot[3]} ⑤${slot[4]}  (균등 기저 각 ${(blanks.length / 5).toFixed(1)})`)
  // 자리별 평균 길이 — 자리 자체가 길이를 정하는가
  const bySlot = [0, 1, 2, 3, 4].map((i) => blanks.reduce((s, x) => s + x.lens[i], 0) / blanks.length)
  console.log(`    자리별 평균 글자수    ${bySlot.map((v, i) => `${'①②③④⑤'[i]}${v.toFixed(1)}`).join('  ')}`)
  const spread = Math.max(...bySlot) - Math.min(...bySlot)
  const bRow = raw.find((r) => r.type === 'R-BLANK')
  console.log(`    자리 간 최대 격차 ${spread.toFixed(1)}자 — 정답↔오답 격차 ${Math.abs(bRow.ansLen - bRow.othLen).toFixed(1)}자와 견줄 것`)

  // **자리 분포를 맞춘 귀무.** 위의 순열은 정답 자리를 균등하게 뽑는다.
  // 실제 분포는 ①② 로 기울어 있고 ①② 가 근소하게 짧으므로, 균등 귀무는
  // 그 기울기를 효과로 넘겨 읽을 수 있다. 관측된 분포 그대로 뽑아 다시 건다.
  const cum = []
  let acc = 0
  for (const c of slot) { acc += c / blanks.length; cum.push(acc) }
  const pick = (u) => { for (let i = 0; i < 5; i += 1) if (u <= cum[i]) return i; return 4 }
  const rndS = mkRnd(90210)
  const obsB = blanks.reduce((s, x) => s + x.rank, 0) / blanks.length
  let sGe = 0
  let sLe = 0
  for (let t = 0; t < ITER; t += 1) {
    let s = 0
    for (const x of blanks) s += avgRank(x.lens, pick(rndS()))
    const m = s / blanks.length
    if (m >= obsB) sGe += 1
    if (m <= obsB) sLe += 1
  }
  const pSlot = Math.min(1, 2 * Math.min((sGe + 1) / (ITER + 1), (sLe + 1) / (ITER + 1)))
  console.log(`    자리 분포를 맞춘 귀무 — 평균순위 ${obsB.toFixed(3)}, 순열 p = ${pSlot.toFixed(4)}  ${pSlot < 0.05 ? '✓ 교란으로 설명되지 않는다' : '✗ 교란이 설명한다'}`)
  bRow.pSlotMatched = pSlot

  // ⭐ **결정적 검정 — ⑤ 를 아예 뺀다.**
  // ⑤ 는 뒤를 닫아 주는 마커가 없어 꼬리를 먹는다. 지면 상투구를 털어내도
  // 진짜 선지 유형에서 ①~④ 평균보다 **+5.8자** 남는다(§7.5). 그 편향은 여기서 재려는
  // 효과(−3.7자)보다 **크다**. 주석으로 넘길 수 없다.
  // 그래서 ⑤ 를 버리고 **정답이 ①~④ 인 문항만** ①~④ 안에서 순위를 매긴다.
  // 기저는 2.5 이고, 오염원이 표본에서 사라진다.
  const four = blanks.filter((x) => x.k < 4).map((x) => ({ ...x, lens4: x.lens.slice(0, 4) }))
  const rank4 = (lens, i) => avgRank(lens, i)
  const obs4 = four.reduce((s, x) => s + rank4(x.lens4, x.k), 0) / four.length
  const rnd4 = mkRnd(60606)
  let g4 = 0
  let l4 = 0
  for (let t = 0; t < ITER; t += 1) {
    let s = 0
    for (const x of four) s += rank4(x.lens4, Math.floor(rnd4() * 4))
    const m = s / four.length
    if (m >= obs4) g4 += 1
    if (m <= obs4) l4 += 1
  }
  const p4 = Math.min(1, 2 * Math.min((g4 + 1) / (ITER + 1), (l4 + 1) / (ITER + 1)))
  const a4 = four.reduce((s, x) => s + x.lens4[x.k], 0) / four.length
  const o4 = four.reduce((s, x) => s + x.lens4.filter((_, i) => i !== x.k).reduce((q, v) => q + v, 0) / 3, 0) / four.length
  console.log('')
  console.log(`    ⭐ ⑤ 를 뺀 결정적 검정 — 정답이 ①~④ 인 ${four.length}문항, ①~④ 안에서만`)
  console.log(`       평균순위 ${obs4.toFixed(3)}  (기저 2.500)  ·  정답 ${a4.toFixed(1)}자 vs 오답 ${o4.toFixed(1)}자  (차 ${(a4 - o4).toFixed(1)})`)
  console.log(`       순열 20,000회 양측 p = ${p4.toFixed(4)}   ${p4 < 0.05 ? '✓ ⑤ 편향 없이도 성립한다' : '✗ ⑤ 를 빼면 사라진다 — 효과는 ⑤ 편향이었다'}`)
  bRow.pNoFifth = p4
  bRow.nNoFifth = four.length
  bRow.meanNoFifth = obs4

  // G4 시계열 — 회차 부호검정(동점 제외)
  const pe = {}
  for (const x of blanks) (pe[x.exam] ??= []).push(x.rank)
  const yrs2 = Object.entries(pe).sort()
  const signs = yrs2.map(([, v]) => v.reduce((s, q) => s + q, 0) / v.length).filter((m) => m !== 3)
  const below = signs.filter((m) => m < 3).length
  let tail = 0
  const C = (n, k) => { let r = 1; for (let i = 0; i < k; i += 1) r = (r * (n - i)) / (i + 1); return r }
  for (let k = below; k <= signs.length; k += 1) tail += C(signs.length, k)
  const pSign = Math.min(1, 2 * tail / 2 ** signs.length)
  console.log(`    회차 부호검정(동점 ${yrs2.length - signs.length}회 제외) ${below}/${signs.length} 회차가 3 미만 — p = ${pSign.toFixed(4)}`)
  bRow.pSign = pSign
}

console.log('')
console.log('  판정')
console.log('  ' + '-'.repeat(72))
const win = sorted.filter((r) => r.holm < 0.05)
if (win.length) {
  for (const r of win) {
    const dir = r.mean < 3 ? '**짧다**' : '**길다**'
    console.log(`    · ${r.type} — 정답이 ${dir} (평균순위 ${r.mean.toFixed(2)}, Holm p=${r.holm.toFixed(4)}, n=${r.n})`)
  }
  console.log('    → 전체 577문항의 null(3.046) 은 **상쇄로 만들어진 것**이었다. G1 관문이 잡았다.')
} else {
  console.log('    · Holm 을 견디는 유형이 없다 — 유형별로도 길이 단서는 없다.')
}

fs.writeFileSync(path.join(DIR, 'blank-choice-length.json'), JSON.stringify({ groups: sorted }, null, 1))
console.log(`\n→ ${path.join(DIR, 'blank-choice-length.json')}`)
