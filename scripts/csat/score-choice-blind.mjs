// scripts/csat/score-choice-blind.mjs
//
// **맹검 손판독 배치 — 3단계(채점). §6.14.5 의 "왜 짧은가" 를 가른다.**
//
// 후보 셋:
//   (a) 추상 — 정답은 추상 명사구, 오답은 구체 서술이라 길다  → abstractness 로 잰다
//   (b) 회피 — 정답만 지문 표현을 피해 바꿔 쓴다              → passageEcho 로 잰다
//   (c) 압축 — 재진술이란 것 자체가 압축이다                  → (a)(b) 를 통제해도 길이차가 남으면
//
// 기저는 가정하지 않는다. **같은 문항 안에서** 정답과 오답 넷을 견주므로
// 문항마다의 소재·문체가 자동으로 통제된다(짝지은 비교). 검정은 순열 20,000회.
//
// ⚠️ **자기 편향 검사가 이 파일의 절반이다.**
//   · 내 abstractness 가 길이만 따라갔다면 이 분석은 순환이다 → 상관을 찍어 본다
//   · concreteMarker 는 대조 항목 — 추상도와 따로 매겼으니 둘이 완전히 겹치면 규칙표가 무의미하다
//   · 판독은 정답을 모르는 채로 했다(KEY.json 은 이 파일에서 처음 열린다)
//
// 실행: pnpm dlx tsx scripts/csat/score-choice-blind.mjs

import fs from 'node:fs'
import path from 'node:path'

const WORK = path.resolve('scripts/csat/choice-blind')
const DIR = path.resolve('scripts/csat/data')
const ITER = 20000
const mkRnd = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }

const key = JSON.parse(fs.readFileSync(path.join(WORK, 'KEY.json'), 'utf8'))
const items = []
for (const f of fs.readdirSync(WORK).filter((x) => x.endsWith('.out.json')).sort()) {
  for (const it of JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')).items) {
    const k = key[it.id]
    if (!k) continue
    const ans = it.choices.find((c) => c.label === k.answerLabel)
    const dis = it.choices.filter((c) => c.label !== k.answerLabel)
    if (!ans || dis.length !== 4) continue
    items.push({ id: it.id, points: k.points, ans, dis, all: it.choices })
  }
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length
const dMean = (xs, f) => mean(xs.map((x) => f(x.ans) - mean(x.dis.map(f))))

/** 짝지은 순열 — 문항마다 정답 자리를 다섯 중 하나로 다시 뽑는다 */
function permPaired(f, seed) {
  const obs = dMean(items, f)
  const rnd = mkRnd(seed)
  let ge = 0
  let le = 0
  for (let t = 0; t < ITER; t += 1) {
    let s = 0
    for (const it of items) {
      const k = Math.floor(rnd() * 5)
      const a = f(it.all[k])
      let o = 0
      for (let i = 0; i < 5; i += 1) if (i !== k) o += f(it.all[i])
      s += a - o / 4
    }
    const m = s / items.length
    if (m >= obs) ge += 1
    if (m <= obs) le += 1
  }
  return { obs, p: Math.min(1, 2 * Math.min((ge + 1) / (ITER + 1), (le + 1) / (ITER + 1))) }
}

const num = (c) => Number(c)
const L = (c) => c.text.length
const A = (c) => c.abstractness
const E = (c) => c.passageEcho
const M = (c) => (c.concreteMarker ? 1 : 0)

console.log('맹검 손판독 채점 — 빈칸 정답은 왜 짧은가')
console.log('='.repeat(76))
console.log(`  문항 ${items.length} · 선지 ${items.length * 5} · 판독은 정답을 모르는 채로 했다`)
console.log('')

console.log('  0. 자기 편향 검사 — 내 판단이 길이만 따라갔는가')
console.log('  ' + '-'.repeat(72))
const flat = items.flatMap((x) => x.all)
function pearson(x, y) {
  const mx = mean(x)
  const my = mean(y)
  let n = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < x.length; i += 1) { n += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2 }
  return dx && dy ? n / Math.sqrt(dx * dy) : 0
}
const rAL = pearson(flat.map(A), flat.map(L))
const rEL = pearson(flat.map(E), flat.map(L))
const rAM = pearson(flat.map(A), flat.map(M))
console.log(`    추상도 ↔ 길이     r = ${rAL.toFixed(3)}  ${Math.abs(rAL) > 0.7 ? '✗ 순환 — 길이를 다시 잰 것이다' : '✓ 길이와 다른 것을 재고 있다'}`)
console.log(`    지문반향 ↔ 길이   r = ${rEL.toFixed(3)}`)
console.log(`    추상도 ↔ 구체표지 r = ${rAM.toFixed(3)}  (대조 항목 — 완전히 겹치면 규칙표가 무의미)`)
console.log(`    추상도 분포  ${[1, 2, 3, 4, 5].map((v) => `${v}:${flat.filter((c) => A(c) === v).length}`).join('  ')}`)
console.log(`    반향 분포    ${[0, 1, 2].map((v) => `${v}:${flat.filter((c) => E(c) === v).length}`).join('  ')}  ·  구체표지 ${flat.filter(M).length}/${flat.length}`)

console.log('')
console.log('  1. 정답 − 오답평균 (같은 문항 안에서 짝지어 비교)')
console.log('  ' + '-'.repeat(72))
const R = {}
for (const [name, f, seed] of [['길이(자)', L, 11], ['추상도(1~5)', A, 22], ['지문반향(0~2)', E, 33], ['구체표지(0/1)', M, 44]]) {
  const r = permPaired(f, seed)
  R[name] = r
  const mark = r.p < 0.05 ? '✓' : '·'
  console.log(`    ${name.padEnd(16)} 차 ${r.obs >= 0 ? '+' : ''}${r.obs.toFixed(3).padStart(7)}   순열 p = ${r.p.toFixed(4)}  ${mark}`)
}
// Holm — 길이는 이미 §6.14 에서 확인된 것이라 새 검정 셋(추상·반향·구체표지)에만 건다
const three = [['추상도(1~5)', R['추상도(1~5)']], ['지문반향(0~2)', R['지문반향(0~2)']], ['구체표지(0/1)', R['구체표지(0/1)']]]
  .sort((a, b) => a[1].p - b[1].p)
let prev = 0
console.log('')
console.log('    Holm 보정 (새 검정 3개 — 길이는 §6.14 에서 이미 확인된 것이라 제외)')
for (let i = 0; i < three.length; i += 1) {
  const adj = Math.max(prev, Math.min(1, (three.length - i) * three[i][1].p))
  prev = adj
  three[i][1].holm = adj
  console.log(`      ${three[i][0].padEnd(16)} raw ${three[i][1].p.toFixed(4)} → Holm ${adj.toFixed(4)}  ${adj < 0.05 ? '✓ 유의' : '· null'}`)
}

console.log('')
console.log('  2. 추상도·반향을 통제해도 길이차가 남는가 (후보 c)')
console.log('  ' + '-'.repeat(72))
// 선지 수준 회귀: 길이 ~ 추상도 + 반향. 잔차로 다시 짝지어 검정한다.
const X = flat.map((c) => [1, A(c), E(c)])
const Y = flat.map(L)
// 정규방정식 3x3
const XtX = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
const XtY = [0, 0, 0]
for (let i = 0; i < X.length; i += 1) {
  for (let a = 0; a < 3; a += 1) {
    XtY[a] += X[i][a] * Y[i]
    for (let b = 0; b < 3; b += 1) XtX[a][b] += X[i][a] * X[i][b]
  }
}
function solve3(Mx, v) {
  const m = Mx.map((r, i) => [...r, v[i]])
  for (let i = 0; i < 3; i += 1) {
    let p = i
    for (let r = i + 1; r < 3; r += 1) if (Math.abs(m[r][i]) > Math.abs(m[p][i])) p = r
    const t = m[i]; m[i] = m[p]; m[p] = t
    for (let r = 0; r < 3; r += 1) {
      if (r === i || !m[i][i]) continue
      const k = m[r][i] / m[i][i]
      for (let c2 = i; c2 < 4; c2 += 1) m[r][c2] -= k * m[i][c2]
    }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]]
}
const beta = solve3(XtX, XtY)
const resid = new Map()
flat.forEach((c, i) => resid.set(c, Y[i] - (beta[0] + beta[1] * X[i][1] + beta[2] * X[i][2])))
const Rres = permPaired((c) => resid.get(c), 55)
console.log(`    회귀  길이 = ${beta[0].toFixed(1)} + ${beta[1].toFixed(2)}·추상도 + ${beta[2].toFixed(2)}·반향`)
console.log(`    잔차 길이 차 ${Rres.obs >= 0 ? '+' : ''}${Rres.obs.toFixed(3)}자   순열 p = ${Rres.p.toFixed(4)}`)
console.log(`    ${Rres.p < 0.05 ? '→ **(a)(b) 로 설명되지 않는 길이차가 남는다** — 후보 (c) 압축이 산다' : '→ 길이차가 (a)(b) 로 흡수된다 — 후보 (c) 는 따로 필요 없다'}`)

console.log('')
console.log('  3. 3점 vs 2점')
console.log('  ' + '-'.repeat(72))
const i3 = items.filter((x) => x.points === 3)
const i2 = items.filter((x) => x.points === 2)
for (const [name, f] of [['길이', L], ['추상도', A], ['지문반향', E]]) {
  console.log(`    ${name.padEnd(8)} 3점 ${dMean(i3, f).toFixed(3).padStart(7)}  ·  2점 ${dMean(i2, f).toFixed(3).padStart(7)}   (n ${i3.length}/${i2.length})`)
}

console.log('')
console.log('  4. G1 하위그룹 · G4 시계열 — 회차별 추상도 차')
console.log('  ' + '-'.repeat(72))
const perExam = {}
for (const it of items) {
  const e = it.id.split('#')[0]
  ;(perExam[e] ??= []).push(A(it.ans) - mean(it.dis.map(A)))
}
const yrs = Object.entries(perExam).sort()
const ms = yrs.map(([e, v]) => [e, mean(v)])
console.log(`    ${ms.map(([e, m]) => `${e}:${m >= 0 ? '+' : ''}${m.toFixed(2)}`).join(' · ')}`)
const nz = ms.map(([, m]) => m).filter((m) => m !== 0)
const pos = nz.filter((m) => m > 0).length
const C = (n, k) => { let r = 1; for (let i = 0; i < k; i += 1) r = (r * (n - i)) / (i + 1); return r }
let tail = 0
for (let k = pos; k <= nz.length; k += 1) tail += C(nz.length, k)
const pSign = Math.min(1, 2 * tail / 2 ** nz.length)
console.log(`    부호검정(동점 ${ms.length - nz.length}회 제외) ${pos}/${nz.length} 회차가 양(+) — p = ${pSign.toFixed(4)}`)
console.log(`    ${pSign < 0.05 ? '✓ 특정 시기의 계단이 아니라 14개년 상시 경향' : '· 회차 수준에서는 일관되지 않는다'}`)

console.log('')
console.log('  판정')
console.log('  ' + '-'.repeat(72))
const win = three.filter(([, r]) => r.holm < 0.05).map(([n2]) => n2)
if (win.length) console.log(`    · Holm 을 견딘 것: ${win.join(' · ')}`)
else console.log('    · Holm 을 견딘 새 측도가 없다 — 세 후보 모두 지지되지 않는다')

fs.writeFileSync(path.join(DIR, 'choice-blind-score.json'), JSON.stringify({
  n: items.length, bias: { rAbsLen: rAL, rEchoLen: rEL, rAbsMarker: rAM },
  paired: Object.fromEntries(Object.entries(R).map(([k, v]) => [k, v])),
  regression: { beta, residual: Rres },
  byPoints: { n3: i3.length, n2: i2.length },
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'choice-blind-score.json')}`)
