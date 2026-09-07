// scripts/csat/score-choice-blind-all.mjs
//
// **세 배치를 합쳐 본다 — 추상도와 지문반향이 서로 반대 순서로 배열된다.**
//
// 배치마다 따로 채점하면(`score-choice-blind.mjs --dir=...`) 이런 그림이 나온다:
//
//   빈칸(61)          추상도 +0.414 ✓✓   반향 +0.131 null
//   대의파악 영어(63)  추상도 +0.242 ✓    반향 +0.373 ✓
//   요지·주장 한글(30) 추상도 +0.167 null  반향 +0.567 ✓✓
//
// **한 축으로 읽힌다 — 정답이 지문에서 얼마나 멀리 떨어져 있는가.**
// 빈칸 정답은 층위를 올리고 낱말도 바꾼다(가장 멀다).
// 한글 요지·주장 정답은 지문의 표현을 그대로 옮긴 쪽에 가깝다(가장 가깝다).
//
// ⚠️ **언어와 유형이 교락돼 있다.** 한글 선지 유형은 한글이면서 동시에 대의파악이다.
// 그래서 여기서는 **선지 언어로 직접 갈라** 본다 — 세 배치를 합쳐 154문항을 한 판에 놓고,
// 선지에 한글이 있는지로 나눈다. 이것이 이 자료로 가능한 가장 깨끗한 대조다.
// (완전히 가르려면 한글 선지 빈칸이 필요한데 14개년에 6문항뿐이다.)
//
// 실행: pnpm dlx tsx scripts/csat/score-choice-blind-all.mjs

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('scripts/csat')
const DIR = path.resolve('scripts/csat/data')
const DIRS = ['choice-blind', 'choice-blind-gist', 'choice-blind-ko']
const ITER = 20000
const mkRnd = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length

const items = []
for (const d of DIRS) {
  const W = path.join(ROOT, d)
  if (!fs.existsSync(W)) continue
  const key = JSON.parse(fs.readFileSync(path.join(W, 'KEY.json'), 'utf8'))
  for (const f of fs.readdirSync(W).filter((x) => x.endsWith('.out.json')).sort()) {
    for (const it of JSON.parse(fs.readFileSync(path.join(W, f), 'utf8')).items) {
      const k = key[it.id]
      if (!k) continue
      const ans = it.choices.find((c) => c.label === k.answerLabel)
      const dis = it.choices.filter((c) => c.label !== k.answerLabel)
      if (!ans || dis.length !== 4) continue
      const ko = it.choices.some((c) => /[가-힣]/.test(c.text))
      items.push({ id: it.id, batch: d, type: k.type ?? 'R-BLANK', ko, ans, dis, all: it.choices })
    }
  }
}

const A = (c) => c.abstractness
const E = (c) => c.passageEcho
const L = (c) => c.text.length
const dOf = (xs, f) => mean(xs.map((x) => f(x.ans) - mean(x.dis.map(f))))

/** 짝지은 순열 — 문항마다 정답 자리를 다섯 중 하나로 다시 뽑는다 */
function perm(xs, f, seed) {
  const obs = dOf(xs, f)
  const rnd = mkRnd(seed)
  let ge = 0
  let le = 0
  for (let t = 0; t < ITER; t += 1) {
    let s = 0
    for (const it of xs) {
      const k = Math.floor(rnd() * 5)
      let o = 0
      for (let i = 0; i < 5; i += 1) if (i !== k) o += f(it.all[i])
      s += f(it.all[k]) - o / 4
    }
    const m = s / xs.length
    if (m >= obs) ge += 1
    if (m <= obs) le += 1
  }
  return { obs, p: Math.min(1, 2 * Math.min((ge + 1) / (ITER + 1), (le + 1) / (ITER + 1))) }
}

/** 두 집단의 차이 — 문항별 차이값을 섞는다 */
function permGroup(g1, g2, f, seed) {
  const v1 = g1.map((x) => f(x.ans) - mean(x.dis.map(f)))
  const v2 = g2.map((x) => f(x.ans) - mean(x.dis.map(f)))
  const obs = Math.abs(mean(v1) - mean(v2))
  const pool = [...v1, ...v2]
  const rnd = mkRnd(seed)
  let ge = 0
  for (let t = 0; t < ITER; t += 1) {
    const sh = pool.slice()
    for (let i = sh.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); const tmp = sh[i]; sh[i] = sh[j]; sh[j] = tmp }
    if (Math.abs(mean(sh.slice(0, v1.length)) - mean(sh.slice(v1.length))) >= obs) ge += 1
  }
  return { a: mean(v1), b: mean(v2), p: (ge + 1) / (ITER + 1) }
}

console.log('맹검 손판독 — 세 배치 합본')
console.log('='.repeat(78))
console.log(`  문항 ${items.length} · 선지 ${items.length * 5}`)
console.log('')

console.log('  1. 배치별 — 추상도와 반향이 반대 순서로 배열된다')
console.log('  ' + '-'.repeat(74))
console.log('    배치                 n     추상도 차   반향 차   길이 차')
const LABEL = { 'choice-blind': '빈칸', 'choice-blind-gist': '대의파악·요약·함축(영)', 'choice-blind-ko': '요지·주장(한글)' }
const batchRows = []
for (const d of DIRS) {
  const xs = items.filter((x) => x.batch === d)
  if (!xs.length) continue
  const r = { batch: d, n: xs.length, dA: dOf(xs, A), dE: dOf(xs, E), dL: dOf(xs, L) }
  batchRows.push(r)
  const sg = (v, k = 3) => (v >= 0 ? '+' : '') + v.toFixed(k)
  console.log(`    ${(LABEL[d] ?? d).padEnd(22)} ${String(xs.length).padStart(3)}   ${sg(r.dA).padStart(8)}  ${sg(r.dE).padStart(8)}  ${sg(r.dL, 1).padStart(7)}`)
}

console.log('')
console.log('  2. ⭐ 선지 언어로 갈랐다 — 교락을 푸는 가장 깨끗한 대조')
console.log('  ' + '-'.repeat(74))
const ko = items.filter((x) => x.ko)
const en = items.filter((x) => !x.ko)
console.log(`    한글 선지 ${ko.length}문항 · 영어 선지 ${en.length}문항`)
const gA = permGroup(en, ko, A, 909)
const gE = permGroup(en, ko, E, 910)
const gL = permGroup(en, ko, L, 911)
console.log('')
console.log('    측도       영어 선지   한글 선지    두 집단 차 순열 p')
console.log(`    추상도 차   ${gA.a.toFixed(3).padStart(8)}   ${gA.b.toFixed(3).padStart(8)}      ${gA.p.toFixed(4)}  ${gA.p < 0.05 ? '✓ 언어가 가른다' : '· 언어로는 안 갈린다'}`)
console.log(`    반향 차     ${gE.a.toFixed(3).padStart(8)}   ${gE.b.toFixed(3).padStart(8)}      ${gE.p.toFixed(4)}  ${gE.p < 0.05 ? '✓ 언어가 가른다' : '· 언어로는 안 갈린다'}`)
console.log(`    길이 차     ${gL.a.toFixed(1).padStart(8)}   ${gL.b.toFixed(1).padStart(8)}      ${gL.p.toFixed(4)}`)

// 각 집단 안에서 0 과 다른가
const inEnA = perm(en, A, 21)
const inKoA = perm(ko, A, 22)
const inEnE = perm(en, E, 23)
const inKoE = perm(ko, E, 24)
console.log('')
console.log('    각 집단 안에서 0 과 다른가')
console.log(`      영어 추상도 ${inEnA.obs >= 0 ? '+' : ''}${inEnA.obs.toFixed(3)} p=${inEnA.p.toFixed(4)}  ·  한글 추상도 ${inKoA.obs >= 0 ? '+' : ''}${inKoA.obs.toFixed(3)} p=${inKoA.p.toFixed(4)}`)
console.log(`      영어 반향   ${inEnE.obs >= 0 ? '+' : ''}${inEnE.obs.toFixed(3)} p=${inEnE.p.toFixed(4)}  ·  한글 반향   ${inKoE.obs >= 0 ? '+' : ''}${inKoE.obs.toFixed(3)} p=${inKoE.p.toFixed(4)}`)

// Holm — 언어 대조 3검정
const three = [['추상도', gA], ['반향', gE], ['길이', gL]].sort((a, b) => a[1].p - b[1].p)
let prev = 0
console.log('')
console.log('    Holm 보정 (언어 대조 3검정)')
for (let i = 0; i < three.length; i += 1) {
  const adj = Math.max(prev, Math.min(1, (three.length - i) * three[i][1].p))
  prev = adj
  three[i][1].holm = adj
  console.log(`      ${three[i][0].padEnd(8)} raw ${three[i][1].p.toFixed(4)} → Holm ${adj.toFixed(4)}  ${adj < 0.05 ? '✓' : '·'}`)
}

console.log('')
console.log('  3. 전체 합본 — 두 측도 모두 산다')
console.log('  ' + '-'.repeat(74))
const allA = perm(items, A, 31)
const allE = perm(items, E, 32)
const allL = perm(items, L, 33)
console.log(`    추상도 차 ${allA.obs >= 0 ? '+' : ''}${allA.obs.toFixed(3)}  p=${allA.p.toFixed(4)}`)
console.log(`    반향 차   ${allE.obs >= 0 ? '+' : ''}${allE.obs.toFixed(3)}  p=${allE.p.toFixed(4)}`)
console.log(`    길이 차   ${allL.obs >= 0 ? '+' : ''}${allL.obs.toFixed(1)}자  p=${allL.p.toFixed(4)}`)

fs.writeFileSync(path.join(DIR, 'choice-blind-all.json'), JSON.stringify({
  n: items.length, batches: batchRows,
  byLanguage: { nKo: ko.length, nEn: en.length, abstract: gA, echo: gE, length: gL, inEnA, inKoA, inEnE, inKoE },
  overall: { abstract: allA, echo: allE, length: allL },
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'choice-blind-all.json')}`)
