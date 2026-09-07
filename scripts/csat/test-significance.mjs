// scripts/csat/test-significance.mjs
//
// **이 저장소가 주장하는 것들이 표본 크기를 견디는가 — 읽기 전용.**
//
// 왜. 앞 6회/뒤 6회 비교의 분모가 작다. 제목 0%→33% 는 0/6 → 2/6 이고,
// 어법 100%→33% 는 6/6 → 2/6 이다. 방향이 있어 보여도 우연과 구분이 안 될 수 있다.
// "실측 근거" 라고 쓰기 전에 **재 보고** 쓴다.
//
// 방법
//   두 비율 비교 — Fisher 정확검정 (분모가 작아 카이제곱은 못 쓴다)
//   0 건 관찰    — 단측 이항검정. 귀무가설은 "기저 비율과 같다"
//
// ⚠️ 13개년 전수라 표본추출 오차가 아니라 **"이 13회가 우연히 이럴 확률"** 을 재는 것이다.
//    모집단이 곧 표본이므로 p 는 일반화가 아니라 **패턴의 안정성** 에 대한 진술로 읽는다.
// ⚠️ 여러 개를 동시에 재므로 다중비교 보정이 필요하다. Holm-Bonferroni 를 함께 낸다.
//
// 실행: pnpm dlx tsx scripts/csat/test-significance.mjs

const lgamma = (z) => {
  // Lanczos 근사
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let x = z, y = z, tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j += 1) ser += g[j] / ++y
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}
const lchoose = (n, k) => (k < 0 || k > n ? -Infinity : lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1))

/** Fisher 정확검정 (양측). 표 [[a,b],[c,d]] */
function fisher(a, b, c, d) {
  const n = a + b + c + d
  const r1 = a + b, c1 = a + c
  const lp = (x) => lchoose(r1, x) + lchoose(n - r1, c1 - x) - lchoose(n, c1)
  const obs = lp(a)
  const lo = Math.max(0, c1 - (n - r1)), hi = Math.min(r1, c1)
  let p = 0
  for (let x = lo; x <= hi; x += 1) {
    const v = lp(x)
    if (v <= obs + 1e-9) p += Math.exp(v)
  }
  return Math.min(1, p)
}

/** 0건 관찰의 단측 이항 p — n 번 시행에서 기저 확률 p0 인데 0건일 확률 */
const zeroP = (n, p0) => Math.exp(n * Math.log(1 - p0))

const T = []
const cmp = (label, [a, b], [c, d], note = '') =>
  T.push({ label, kind: '두 비율', detail: `${a}/${a + b} → ${c}/${c + d}`, p: fisher(a, b, c, d), note })
const zero = (label, n, p0, note = '') =>
  T.push({ label, kind: '0건', detail: `0/${n} (기저 ${(100 * p0).toFixed(0)}%)`, p: zeroP(n, p0), note })

// ── 0건 주장 ────────────────────────────────────────────────────────
zero('①-회피 · 순서 대응형', 192, 106 / 393, '기저 = 비대응형의 ① 비율 27%')
zero('①-회피 · 균등 가정', 192, 0.2, '기저 = 균등 20%')
zero('한글 선택지에 3점 없음', 179, 130 / 585, '기저 = 전체 3점 비율 22%')
zero('어법 형용사·부사 정답 0', 9, 13 / 65, '기저 = 밑줄 1개가 정답일 확률 20%')

// ── 앞 6회 → 뒤 6회 (분모 고정 유형) ────────────────────────────────
cmp('빈칸 3점률', [21, 3], [12, 12], '24문항 고정')
cmp('어법 3점률', [6, 0], [2, 4], '6문항 — 분모 작음')
cmp('순서 3점률', [3, 8], [6, 6], '')
cmp('삽입 3점률', [3, 8], [6, 6], '')
cmp('주제 3점률', [1, 6], [3, 3], '')
cmp('제목 3점률', [0, 8], [2, 4], '분모 작음')
cmp('어휘 3점률', [2, 4], [4, 2], '분모 작음')
cmp('순서 토막 단서 없음', [14, 28], [27, 24], '42 → 51 토막')

// ── 개별 가설 ──────────────────────────────────────────────────────
cmp('H4 어휘 치환 ④⑤ (기저 40%)', [10, 3], [Math.round(0.4 * 13), 13 - Math.round(0.4 * 13)], '관측 vs 기저 기대')
cmp('H6 삽입 후방 지시어 vs base', [24, 1], [Math.round(0.71 * 25), 25 - Math.round(0.71 * 25)], '96% vs base 71%')
cmp('H8 무관한 문장 앞 문장 어휘', [8, 4], [26, 22], '정답 문장 vs 나머지 네 문장')
cmp('H2 빈칸 앞뒤 (목표 80%)', [22, 21], [Math.round(0.8 * 43), 43 - Math.round(0.8 * 43)], '관측 51% vs 목표 80%')
cmp('H5 순서 단서 (목표 90%)', [21, 72], [Math.round(0.9 * 93), 93 - Math.round(0.9 * 93)], '관측 22.6% vs 목표 90%')

// ── Holm-Bonferroni ────────────────────────────────────────────────
const sorted = [...T].sort((a, b) => a.p - b.p)
const m = sorted.length
sorted.forEach((t, i) => {
  t.adj = Math.min(1, t.p * (m - i))
  t.sig = t.adj < 0.05
})
// 단조성 보정
for (let i = 1; i < m; i += 1) sorted[i].adj = Math.max(sorted[i].adj, sorted[i - 1].adj)
sorted.forEach((t) => { t.sig = t.adj < 0.05 })

const fmt = (p) => (p < 1e-6 ? p.toExponential(1) : p < 0.001 ? p.toExponential(2) : p.toFixed(4))
console.log(`유의성 — 주장 ${m}개 · Fisher 정확검정 + Holm-Bonferroni 보정`)
console.log('─'.repeat(88))
console.log('  주장                                관측            p        보정 p    판정')
for (const t of sorted) {
  console.log(
    `  ${t.label.padEnd(30)} ${t.detail.padEnd(22)} ${fmt(t.p).padStart(9)} ${fmt(t.adj).padStart(9)}  ${t.sig ? '✓ 견딘다' : '✗ 우연과 구분 안 됨'}`,
  )
}
console.log('─'.repeat(88))
const pass = sorted.filter((t) => t.sig).length
console.log(`  ${pass}/${m} 이 보정 후에도 p < 0.05`)
console.log('')
console.log('  주의 — 보정 후 탈락한 것들')
for (const t of sorted.filter((t) => !t.sig)) console.log(`    · ${t.label} (${t.detail})${t.note ? ' — ' + t.note : ''}`)
