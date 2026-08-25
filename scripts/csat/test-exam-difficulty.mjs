// scripts/csat/test-exam-difficulty.mjs
//
// **회차 실난도 — 난도 축의 마지막 구멍을 메운다.**
//
// §6.10 은 3점 배점을 난도의 대리 지표로 썼다. 그러나 **3점은 의도지 결과가 아니다.**
// 영어는 2018학년도부터 **절대평가**라 등급컷이 90점 고정이므로,
// 회차 난도는 **1등급 비율**로 드러난다 — 낮을수록 어려웠다는 뜻이다.
//
// 그래서 이 검정이 설계도의 핵심 물음에 직접 답한다:
//
//   **출제자는 지문을 조작해 난도를 맞추는가, 아니면 정해진 틀에 지문을 끼우는가?**
//
//   지문 특성이 회차 난도를 설명한다  → 지문이 난도 손잡이다
//   설명하지 못한다                  → 난도는 지문 밖(문항·선지·관행)에서 온다
//
// ⚠️ n=9 회차뿐이다. 상관이 유의하려면 |r| ≳ 0.67 이어야 한다. 검정력의 한계를 명시한다.
// ⚠️ 2025 는 출처마다 6.22% / 6.55% 로 갈린다. 둘 다 넣어 결론이 바뀌는지 본다.
//
// 실행: pnpm dlx tsx scripts/csat/test-exam-difficulty.mjs

import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('scripts/csat/data')
const axis = JSON.parse(fs.readFileSync(path.join(DIR, 'difficulty-axis.json'), 'utf8'))

/**
 * 절대평가 도입(2018학년도) 이후 영어 1등급 비율(%).
 * 평가원 채점 결과 발표. 낮을수록 어려웠다.
 * ⚠️ 2025 는 보도마다 6.22 / 6.55 로 갈린다 — 둘 다 검사한다.
 */
const GRADE1 = {
  2018: 10.03, 2019: 5.30, 2020: 7.43, 2021: 12.66,
  2022: 6.25, 2023: 7.83, 2024: 4.71, 2025: 6.22, 2026: 3.11,
}
const GRADE1_ALT = { ...GRADE1, 2025: 6.55 }

// ── 회차별 지문 특성 ──────────────────────────────────────────────────
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const byExam = {}
for (const r of axis.rows) {
  if (!/^\d{4}$/.test(r.exam)) continue            // 모평 제외 (등급 자료 없음)
  ;(byExam[r.exam] ??= []).push(r)
}

const METRICS = [
  ['C1+ 어휘 비율', 'c1Ratio'],
  ['문장당 절 수', 'clausesPerSent'],
  ['지문 낱말 수', 'nWords'],
]

function pearson(x, y) {
  const n = x.length
  const mx = mean(x), my = mean(y)
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i += 1) { const a = x[i] - mx, b = y[i] - my; num += a * b; dx += a * a; dy += b * b }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0
}

/** 순열검정 — n=9 에서 t 분포 가정을 피한다 */
function permR(x, y, iters = 20000) {
  const obs = pearson(x, y)
  let seed = 777, ge = 0
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  for (let k = 0; k < iters; k += 1) {
    const p = [...y]
    for (let i = p.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1));[p[i], p[j]] = [p[j], p[i]] }
    if (Math.abs(pearson(x, p)) >= Math.abs(obs)) ge += 1
  }
  return { r: obs, p: (ge + 1) / (iters + 1) }
}

const exams = Object.keys(GRADE1).map(String).filter((e) => byExam[e]).sort()
console.log('회차 실난도 vs 지문 특성 — 난도는 지문에서 오는가')
console.log('='.repeat(76))
console.log(`  회차 ${exams.length} (2018~2026 · 절대평가 구간) · 문항 ${exams.reduce((s, e) => s + byExam[e].length, 0)}`)
console.log(`  실난도 = **1등급 비율(%)** — 낮을수록 어려웠다`)
console.log()
console.log('  회차   1등급%   C1+어휘%   문장당절수   지문낱말수   3점 지문 C1+%')
console.log('  ' + '-'.repeat(72))
for (const e of exams) {
  const a = byExam[e]
  const p3 = a.filter((x) => x.points === 3)
  console.log(
    `  ${e}  ${String(GRADE1[e]).padStart(6)}  ${(mean(a.map((x) => x.c1Ratio)) * 100).toFixed(2).padStart(8)}  ` +
    `${mean(a.map((x) => x.clausesPerSent)).toFixed(3).padStart(10)}  ${mean(a.map((x) => x.nWords)).toFixed(1).padStart(10)}  ` +
    `${(p3.length ? mean(p3.map((x) => x.c1Ratio)) * 100 : 0).toFixed(2).padStart(12)}`,
  )
}
console.log()

const g1 = exams.map((e) => GRADE1[e])
const g1alt = exams.map((e) => GRADE1_ALT[e])

console.log('  상관 — 1등급 비율(낮을수록 어려움) vs 지문 특성')
console.log('  ' + '-'.repeat(72))
console.log('  지표                        r        순열 p     2025 대안값에서 r')
const out = {}
for (const [name, key] of METRICS) {
  const v = exams.map((e) => mean(byExam[e].map((x) => x[key])))
  const r = permR(g1, v)
  const rAlt = pearson(g1alt, v)
  out[key] = { ...r, rAlt }
  console.log(`  ${name.padEnd(24)} ${r.r.toFixed(3).padStart(7)} ${r.p.toFixed(4).padStart(10)} ${rAlt.toFixed(3).padStart(16)}`)
}
// 3점 지문만
const v3 = exams.map((e) => { const a = byExam[e].filter((x) => x.points === 3); return a.length ? mean(a.map((x) => x.c1Ratio)) : 0 })
const r3 = permR(g1, v3)
out.c1_3jeom = { ...r3, rAlt: pearson(g1alt, v3) }
console.log(`  ${'3점 지문의 C1+ 비율'.padEnd(24)} ${r3.r.toFixed(3).padStart(7)} ${r3.p.toFixed(4).padStart(10)} ${pearson(g1alt, v3).toFixed(3).padStart(16)}`)
console.log()

const sig = Object.values(out).filter((x) => x.p < 0.05).length
console.log('  판정')
console.log('  ' + '-'.repeat(72))
console.log(`    유의한 상관 ${sig}/${Object.keys(out).length}`)
console.log()
if (sig === 0) {
  console.log('  → **지문 특성은 회차 난도를 설명하지 못한다.**')
  console.log('    어휘도, 통사 복잡도도, 길이도 1등급 비율과 상관이 없다.')
  console.log('    난도는 지문 밖 — 문항·선지·관행 — 에서 온다.')
} else {
  console.log('  → 일부 지표가 회차 난도와 상관이 있다. 위 표를 볼 것.')
}
console.log()
console.log('  ⚠️ 한계')
console.log(`    · 회차 ${exams.length}개뿐이다. |r| ≳ 0.67 이라야 p<0.05 에 닿는다 — **검정력이 낮다.**`)
console.log('      유의하지 않다는 것이 "효과가 없다" 를 뜻하지는 않는다.')
console.log('    · 1등급 비율은 **응시집단**에도 좌우된다(재수생 비율 등). 지문만의 함수가 아니다.')
console.log('    · 2025 는 보도마다 6.22 / 6.55 로 갈린다. 위 표의 마지막 열이 대안값 결과다.')

fs.writeFileSync(path.join(DIR, 'exam-difficulty.json'), JSON.stringify({
  grade1: GRADE1, grade1Alt: GRADE1_ALT, exams, correlations: out,
  perExam: exams.map((e) => ({
    exam: e, grade1: GRADE1[e],
    c1Ratio: mean(byExam[e].map((x) => x.c1Ratio)),
    clausesPerSent: mean(byExam[e].map((x) => x.clausesPerSent)),
    nWords: mean(byExam[e].map((x) => x.nWords)),
  })),
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'exam-difficulty.json')}`)
