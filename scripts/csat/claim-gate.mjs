// scripts/csat/claim-gate.mjs
//
// **주장 관문 — 이 저장소에서 겪은 다섯 가지 착오를 코드로 막는다.**
//
// 이 프로젝트는 같은 계열의 실수를 **다섯 번** 했다. 매번 사후에 발견하고
// "다음엔 조심하겠다" 고 적었다. 그게 다섯 번 실패했으므로 이제 코드로 막는다.
//
//   G1 하위 그룹  집계만 보고 결론 냈다 → 3점의 76%가 빈칸이었는데 못 봤다(심슨의 역설)
//   G2 기저 확률  적중률만 봤다 → H6 96% 인데 아무 문장이나 71% 였다
//   G3 반증 가능  규칙이 어떤 입력으로도 실패할 수 없었다 → E4 항진명제
//   G4 시계열     앞뒤 평균으로 갈랐다 → 계단(E7)과 잡음(순서 단서)을 추세로 읽었다
//   G5 검정 선택  자료 형태에 안 맞는 검정을 썼다 → 어휘 ④⑤ 를 Fisher 로 재서 놓쳤다
//
// **다섯 관문을 전부 통과하지 못한 주장은 문서에 HARD 로 올리지 않는다.**
//
// 실행: pnpm dlx tsx scripts/csat/claim-gate.mjs   (기존 주장들로 자기 검증)

// ── 통계 도구 ────────────────────────────────────────────────────────
const C = (n, k) => { let r = 1; for (let i = 0; i < k; i += 1) r = r * (n - i) / (i + 1); return r }
export const binomUpper = (n, k, p) => {
  let s = 0
  for (let i = k; i <= n; i += 1) s += C(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i)
  return Math.min(1, s)
}
const lgam = (z) => {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let x = z, y = z, t = x + 5.5
  t -= (x + 0.5) * Math.log(t)
  let s = 1.000000000190015
  for (let j = 0; j < 6; j += 1) s += g[j] / ++y
  return -t + Math.log(2.5066282746310005 * s / x)
}
const lch = (n, k) => (k < 0 || k > n ? -Infinity : lgam(n + 1) - lgam(k + 1) - lgam(n - k + 1))
export function fisher(a, b, c, d) {
  const n = a + b + c + d, r1 = a + b, c1 = a + c
  const lp = (x) => lch(r1, x) + lch(n - r1, c1 - x) - lch(n, c1)
  const o = lp(a)
  let p = 0
  for (let x = Math.max(0, c1 - (n - r1)); x <= Math.min(r1, c1); x += 1) { const v = lp(x); if (v <= o + 1e-9) p += Math.exp(v) }
  return Math.min(1, p)
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) }

// ── 관문 ─────────────────────────────────────────────────────────────

/** G1 하위 그룹 — 집계가 한 하위 그룹에 끌려가고 있지 않은가 */
function g1(claim) {
  const sub = claim.subgroups
  if (!sub || sub.length < 2) return { pass: false, msg: '하위 그룹을 제시하지 않았다 — 집계만으로는 판단 불가' }
  const total = sub.reduce((s, x) => s + x.n, 0)
  const biggest = [...sub].sort((a, b) => b.n - a.n)[0]
  const share = biggest.n / total
  const testable = sub.filter((x) => x.n >= 3)
  const dirs = testable.map((x) => x.hit / x.n > (claim.baseRate ?? 0))
  const agree = dirs.filter(Boolean).length
  // 방향이 갈리는 것이 심슨의 역설의 본체다. 여기서 먼저 떨어뜨린다.
  if (dirs.length >= 2 && agree !== dirs.length && agree !== 0) {
    return { pass: false, msg: `하위 그룹 방향 불일치 ${agree}/${dirs.length} — 집계가 착시다` }
  }
  // ⚠️ 비중 편중은 **방향이 갈릴 때만** 문제다. 모든 하위 그룹이 같은 방향이면 가릴 것이 없다.
  //    (첫 판은 하위 그룹 둘이 모두 100% 인데도 비중 67% 라는 이유로 떨어뜨렸다 — 부당하다)
  if (share > 0.6 && dirs.length < 2) {
    return { pass: false, msg: `한 하위 그룹이 표본의 ${(100 * share).toFixed(0)}% 인데 나머지가 검정 가능한 크기가 아니다 (${biggest.label})` }
  }
  const note = share > 0.6 ? ` · 최대 비중 ${(100 * share).toFixed(0)}% 이나 하위 그룹 전부 같은 방향이라 착시 위험 없음` : ` · 최대 비중 ${(100 * share).toFixed(0)}%`
  return { pass: true, msg: `하위 그룹 ${sub.length}개${note} · 방향 일치` }
}

/** G2 기저 확률 — 그 성질을 갖지 않은 것이 애초에 몇이나 되는가 */
function g2(claim) {
  if (claim.baseRate == null) return { pass: false, msg: '기저 확률을 제시하지 않았다' }
  const obs = claim.hit / claim.n
  const lift = obs - claim.baseRate
  if (lift < 0.15) return { pass: false, msg: `lift ${(100 * lift).toFixed(1)}%p — 기저(${(100 * claim.baseRate).toFixed(1)}%)와 구분되지 않는다` }
  return { pass: true, msg: `관측 ${(100 * obs).toFixed(1)}% vs 기저 ${(100 * claim.baseRate).toFixed(1)}% · lift ${(100 * lift).toFixed(1)}%p` }
}

/** G3 반증 가능 — 이 주장을 깨는 관측을 말할 수 있는가 */
function g3(claim) {
  if (!claim.falsifier) return { pass: false, msg: '반증 조건을 적지 않았다 — 항진명제일 수 있다' }
  return { pass: true, msg: claim.falsifier }
}

/** G4 시계열 — 계단·추세·잡음을 가른다. 앞뒤 평균만 보면 셋이 구분되지 않는다 */
function g4(claim) {
  const pe = claim.perExam
  if (!pe || pe.length < 6) return { pass: false, msg: '회차별 전개를 제시하지 않았다 — 평균은 계단과 잡음을 추세로 보이게 한다' }
  // ⚠️ 회차당 표본이 1~2 면 회차별 비율이 구조적으로 0/1 로만 나온다(베르누이).
  //    거기서 잰 SD 는 자료의 잡음이 아니라 **표본 크기의 산물**이므로 분산 판정을 하면 안 된다.
  //    (첫 판이 어휘 ④⑤ 를 이 이유로 부당하게 떨어뜨렸다 — 회차당 1문항인 유형이다)
  // ⚠️ 여기서 **max 를 쓰면 안 된다**(2026-08-25 수정). 회차 하나가 n=4 면 나머지 열세 회차가
  //    전부 n=2 여도 가드가 열리고, 그러면 베르누이 잡음을 "계단" 으로 읽는다.
  //    실제로 P4.1(대의파악, 회차당 2문항)에서 이 결함으로 "2025 에서 갈린다" 는 오판이 나왔다.
  //    분산 판정은 **회차 대부분이 충분히 클 때만** 뜻이 있으므로 중앙값으로 본다.
  const ns = pe.map((x) => x.n).sort((a, b) => a - b)
  const medN = ns[Math.floor(ns.length / 2)]
  if (medN <= 2) {
    return { pass: true, na: true, msg: `회차당 표본 중앙값 ${medN} — 분산 판정 불가(구조적으로 0/1). 계단 여부는 §시계열 표를 직접 볼 것` }
  }
  const r = pe.map((x) => x.hit / x.n)
  const s = sd(r)
  // 계단 후보: 어느 지점에서 자르면 양쪽 SD 가 작고 평균 차가 큰가
  let best = null
  for (let i = 2; i < r.length - 1; i += 1) {
    const a = r.slice(0, i), b = r.slice(i)
    const gap = Math.abs(mean(a) - mean(b))
    const within = (sd(a) + sd(b)) / 2
    const score = gap - within
    if (!best || score > best.score) best = { i, gap, within, score }
  }
  const shape = best && best.score > 0.2 ? 'step' : s > 0.2 ? 'noise' : 'stable'
  if (shape === 'noise') return { pass: false, msg: `회차별 SD ${s.toFixed(2)} — 잡음이다. 평균 차는 그 잡음을 가른 선일 뿐이다` }
  if (shape === 'step') return { pass: true, msg: `**계단** — ${pe[best.i].exam} 에서 갈린다(격차 ${best.gap.toFixed(2)}, 내부 SD ${best.within.toFixed(2)}). 추세가 아니다` }
  return { pass: true, msg: `안정 — 회차별 SD ${s.toFixed(2)}, 시간 추세 없음` }
}

/** G5 검정 선택 — 자료 형태에 맞는 검정인가 */
function g5(claim) {
  const shape = claim.shape
  if (!shape) return { pass: false, msg: '자료 형태를 선언하지 않았다' }
  if (shape === 'count-vs-baserate') {
    const p = binomUpper(claim.n, claim.hit, claim.baseRate)
    return { pass: p < 0.05, msg: `이항검정(고정 기저 대비 성공 횟수) p = ${p.toFixed(4)}`, p }
  }
  if (shape === 'two-proportions') {
    const [a, b, c, d] = claim.table
    const p = fisher(a, b, c, d)
    return { pass: p < 0.05, msg: `Fisher 정확검정(두 비율) p = ${p.toFixed(4)}`, p }
  }
  return { pass: false, msg: `모르는 형태: ${shape}` }
}

const GATES = [['G1 하위그룹', g1], ['G2 기저확률', g2], ['G3 반증가능', g3], ['G4 시계열', g4], ['G5 검정선택', g5]]

export function gate(claim) {
  const results = GATES.map(([name, fn]) => ({ name, ...fn(claim) }))
  const passed = results.filter((r) => r.pass).length
  // ⚠️ G5(유의성)는 **필수 관문**이다. 여기서 떨어진 주장은 다른 넷을 통과해도 SOFT 가 아니다.
  //    (첫 판은 순서 단서 감소를 3/5 SOFT 로 통과시켰다 — p=0.0636 인데도. 그건 폐기가 맞다)
  const sig = results.find((r) => r.name.startsWith('G5'))
  // ⚠️ HARD 는 **범위 안에서 예외가 없는** 규칙이다(E1~E7·I1~I3 전부 100%).
  //    관문을 5/5 통과해도 예외가 있으면 경향이지 불변식이 아니다.
  //    (첫 판은 어휘 ④⑤ 를 5/5 로 HARD 후보에 올렸다 — 10/13 이라 예외가 3건인데도)
  const exceptionFree = claim.hit === claim.n
  const verdict = !sig.pass ? '근거 부족 — 유의성 미달'
    : passed === 5 && exceptionFree ? 'HARD 후보'
      : passed === 5 ? `SOFT 상위 — 관문은 전부 통과했으나 예외 ${claim.n - claim.hit}건 (불변식이 아니라 경향)`
        : passed >= 4 ? 'SOFT'
          : '근거 부족'
  return { claim: claim.name, results, passed, verdict, exceptionFree }
}

export function report(claim) {
  const g = gate(claim)
  console.log(`\n${g.claim}`)
  console.log('─'.repeat(74))
  for (const r of g.results) console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}  ${r.msg}`)
  console.log(`  → ${g.passed}/5 · **${g.verdict}**`)
  return g
}

// ── 자기 검증 — 이미 판정이 끝난 주장들로 관문이 옳게 작동하는지 본다 ──
if (process.argv[1] && process.argv[1].endsWith('claim-gate.mjs')) {
  console.log('주장 관문 — 이미 판정된 주장으로 자기 검증')
  console.log('═'.repeat(74))

  report({
    name: '어휘 치환은 지문 후반부(④⑤) 에 온다  [기대: SOFT 상위]',
    hit: 10, n: 13, baseRate: 0.4, shape: 'count-vs-baserate',
    falsifier: '어휘 30번 정답이 ①②③ 에 고르게 퍼지면 깨진다',
    subgroups: [{ label: '2014B~2018', hit: 3, n: 5 }, { label: '2019~2026', hit: 7, n: 8 }],
    perExam: [4, 5, 3, 4, 2, 5, 4, 5, 3, 5, 4, 4, 5].map((a, i) => ({ exam: String(2014 + i), hit: a >= 4 ? 1 : 0, n: 1 })),
  })

  report({
    name: '어법 정답은 준동사·관계사·수일치 3종에 몰린다  [기대: 강등]',
    hit: 12, n: 13, baseRate: 47 / 65, shape: 'count-vs-baserate',
    falsifier: '정답이 태·병렬·도치 등 나머지 포인트에서 나오면 깨진다',
    subgroups: [{ label: '2014B~2018', hit: 5, n: 5 }, { label: '2019~2026', hit: 7, n: 8 }],
    perExam: Array.from({ length: 13 }, (_, i) => ({ exam: String(2014 + i), hit: i === 9 ? 0 : 1, n: 1 })),
  })

  report({
    name: '순서 문항의 표면 단서가 줄어드는 중이다  [기대: 폐기]',
    hit: 27, n: 51, baseRate: 0.333, shape: 'two-proportions', table: [27, 24, 14, 28],
    falsifier: '뒤 시기의 단서 없음 비율이 앞 시기와 같거나 낮으면 깨진다',
    subgroups: [{ label: '앞 6회', hit: 14, n: 42 }, { label: '뒤 6회', hit: 27, n: 51 }],
    perExam: [[2, 3], [1, 6], [2, 9], [3, 9], [3, 6], [3, 9], [4, 9], [7, 9], [6, 9], [0, 3], [2, 6], [3, 6], [5, 9]]
      .map(([h, n], i) => ({ exam: String(2014 + i), hit: h, n })),
  })

  report({
    name: '2019 부터 3점 배분 고정 — 빈칸 2 · 순서 1 · 삽입 1  [기대: HARD]',
    hit: 8, n: 8, baseRate: 0, shape: 'count-vs-baserate',
    falsifier: '2019 이후 어느 회차든 빈칸 3점이 2개가 아니면 깨진다',
    subgroups: [{ label: '빈칸', hit: 8, n: 8 }, { label: '순서', hit: 8, n: 8 }, { label: '삽입', hit: 8, n: 8 }],
    perExam: Array.from({ length: 13 }, (_, i) => ({ exam: String(2014 + i), hit: i >= 5 ? 1 : 0, n: 1 })),
  })

  console.log('\n' + '═'.repeat(74))
  console.log('  관문이 기대대로 갈랐다면 이 도구를 새 주장에 그대로 쓴다.')
}
