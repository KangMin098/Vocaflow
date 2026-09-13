// scripts/textbook/register-measure-probe.mjs
//
// **`register` 는 측정값이 아니라 선언값이다 — 그것을 실측으로 드러내고, 기출에 눈금을 맞춘다.**
//
// ── 무엇을 발견했나 (실측 2026-09-13) ────────────────────────────────
// 이 저장소는 지문의 장르를 `register` 컬럼으로 관리하고, 「변형 가능 논증문 1,485편」이라는
// 수치가 이 목표의 우선순위를 정해 왔다. 그런데 그 값이 어디서 오는지 보면:
//
//   `resolveArticleRegister(source, feedId)` → `FEED_REGISTER[…] ?? SOURCE_REGISTER_DEFAULT[…]`
//
// **본문을 한 글자도 보지 않는다.** 소스·피드 이름으로 정한 조회표다. 그래서 이런 일이 생긴다:
//   · frontiers 1,958편을 적재했더니 register 가 **전부 expository** 였다(내용과 무관하게)
//   · 그런데 거친 담화 표지로 재 보니 frontiers("expository")가 however 1.00 · therefore 0.52 로
//     plos("argumentative", however 0.79 · therefore 0.14)보다 **높았다**
//
// 즉 "논증문이 부족하다" 는 **관측이 아니라 라벨링의 결과**일 수 있다. 라벨을 늘리는 일(새 소스 배선)로
// 해결되는 문제가 아니라면, 먼저 **재는 자**가 있어야 한다.
//
// ── 눈금은 기출이 정한다 ─────────────────────────────────────────────
// 임계값을 짐작으로 정하면 그 뒤 모든 판정이 짐작이 된다. 그래서 `csat_items` 의 **실제 평가원
// 지문 796편**을 같은 자로 재고, 그 분포(p25~p75)를 목표 대역으로 쓴다. 「업계 수준 이상」 같은
// 말을 숫자로 바꾸는 유일한 방법이다.
//
// ⚠️ 이 자는 담화 표지 밀도만 본다 — 논증의 **질**이 아니라 **형태**다. 표지가 많아도 엉성한 글이
//   있고 적어도 촘촘한 글이 있다. 그래서 결과는 「후보 선별」용이고 최종 판정은 사람·LLM 몫이다.
//   그 한계를 적어 두지 않으면 다음 사람이 이 점수를 품질 점수로 읽는다.
//
// 재실행 안전: **읽기만 한다.** DB 에 쓰지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/register-measure-probe.mjs
//   pnpm dlx tsx scripts/textbook/register-measure-probe.mjs --per-source 80
//   pnpm dlx tsx scripts/textbook/register-measure-probe.mjs --out <경로.json>

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const PER_SOURCE = Number(arg('per-source') ?? 60)
const outPath = arg('out')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 자 ───────────────────────────────────────────────────────────────
// **자는 이 파일에 두지 않는다.** 여기 두면 검사할 수 없다 — 이 파일을 임포트하면 DB 를 친다.
// 순수 모듈이 정본이고 회귀가 거기 붙는다(`register-signal.test.ts`).
const {
  MARKER_GROUPS,
  MARKER_GROUP_IDS: GROUP_IDS,
  measureRegisterSignal,
  countWords: wordCount,
} = await import('../../packages/library-pipeline/src/textbook/register-signal.ts')

const measureRegister = measureRegisterSignal

const quantile = (sorted, q) => {
  if (sorted.length === 0) return null
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return Number((sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)).toFixed(2))
}

function summarize(label, values) {
  const s = [...values].sort((a, b) => a - b)
  return {
    label,
    n: s.length,
    p10: quantile(s, 0.1),
    p25: quantile(s, 0.25),
    median: quantile(s, 0.5),
    p75: quantile(s, 0.75),
    p90: quantile(s, 0.9),
  }
}

// ── ① 기준선 — 실제 평가원 지문 ──────────────────────────────────────
const csatRows = []
for (let from = 0; ; from += 500) {
  const { data, error } = await db
    .from('csat_items')
    .select('id, type_id, passage')
    .not('passage', 'is', null)
    .order('id')
    .range(from, from + 499)
  if (error) throw new Error(`csat_items 읽기 실패: ${error.message}`)
  if (!data?.length) break
  csatRows.push(...data)
  if (data.length < 500) break
}
const csatMeasured = csatRows
  .map((r) => ({ ...r, m: measureRegister(r.passage) }))
  .filter((r) => r.m)
const csat = summarize('평가원 기출 지문', csatMeasured.map((r) => r.m.density))
/** 표지를 **하나라도** 가진 비율. 밀도가 희소한 짧은 글에서 이 값이 더 안정적이다. */
const csatPresence =
  csatMeasured.filter((r) => r.m.density > 0).length / (csatMeasured.length || 1)
/** 지문당 평균 표지 수 — 길이 정규화를 하지 않은 날값. */
const csatPerPassage =
  csatMeasured.reduce((n, r) => n + (r.m.density * r.m.words) / 1000, 0) / (csatMeasured.length || 1)

console.log('── 기준선 ────────────────────────────────────────────────')
console.log(
  `${csat.label}  n=${csat.n}  p25 ${csat.p25} · 중앙 ${csat.median} · p75 ${csat.p75}` +
    `  (1,000어당 담화 표지 수)`,
)
console.log(
  `  지문당 평균 어수 ${Math.round(csatMeasured.reduce((n, r) => n + r.m.words, 0) / csatMeasured.length)}어 · ` +
    `표지 보유율 ${(100 * csatPresence).toFixed(0)}% · 지문당 평균 표지 ${csatPerPassage.toFixed(2)}개`,
)
console.log('묶음별 중앙값:')
for (const g of GROUP_IDS) {
  const s = summarize(g, csatMeasured.map((r) => r.m.per[g]))
  console.log(`  ${g.padEnd(12)} 중앙 ${String(s.median).padStart(5)}  p75 ${String(s.p75).padStart(5)}`)
}

/**
 * **목표 대역 = 기출의 중앙값 이상.**
 *
 * 처음에 p25 를 썼는데 실측값이 **0** 이었다 — 기출 지문은 약 130어라 1,000어당 밀도로 재면
 * 표지가 하나도 없는 지문이 25% 를 넘는다. 0 을 임계값으로 쓰면 **모든 소스가 100% 통과**해
 * 자가 아무것도 가르지 않는다(실제로 그렇게 나왔다). 짧은 글에서 밀도는 희소하다.
 * 그래서 중앙값을 쓰고, 길이에 덜 흔들리는 **표지 보유율**(≥1개)을 함께 본다.
 */
const THRESHOLD = csat.median

// ── ② 재고 — 선언 register 와 측정값을 나란히 ────────────────────────
const { data: srcRows, error: srcErr } = await db
  .from('library_articles')
  .select('source')
  .in('status', ['ready', 'published'])
  .limit(1)
if (srcErr) throw new Error(`source 목록 실패: ${srcErr.message}`)
void srcRows

// 소스 목록은 고정 질의로 받는다(그룹 바이가 REST 에 없다) — 후보 목록의 배선 값을 쓴다.
const registry = JSON.parse(
  fs.readFileSync(path.resolve('scripts/textbook/passage-source-candidates.json'), 'utf8'),
)
const SOURCES = [...new Set(registry.wired_sources)].filter((s) => s !== 'manual')

const groups = new Map() // `${source}|${register}` → number[]
const perSource = new Map()
let scanned = 0

/**
 * **표본을 앞에서만 뜨지 않는다.** `order('id').limit(N)` 은 **id 앞쪽 N 행**이다 —
 * 재고가 늘면 구성이 바뀌어 같은 소스의 통과율이 흔들린다(실측 2026-09-13: plos 드레인
 * 직후 72% → 53%). DOAB 표본에서 이미 같은 함정을 고쳤는데 여기서 반복했다.
 * 그래서 **행 수를 먼저 세고 구간을 고르게 갈라** 창을 여러 개 뜬다.
 */
const SAMPLE_WINDOWS = 5
async function sampleRows(source) {
  const { count } = await db
    .from('library_articles')
    .select('id', { count: 'exact', head: true })
    .eq('source', source)
    .in('status', ['ready', 'published'])
    .not('content', 'is', null)
  const total = count ?? 0
  if (total === 0) return []
  const per = Math.max(1, Math.floor(PER_SOURCE / SAMPLE_WINDOWS))
  const out = []
  for (let w = 0; w < SAMPLE_WINDOWS; w++) {
    const offset = Math.min(Math.floor((total * w) / SAMPLE_WINDOWS), Math.max(0, total - per))
    const { data, error } = await db
      .from('library_articles')
      .select('id, source, register, content')
      .eq('source', source)
      .in('status', ['ready', 'published'])
      .not('content', 'is', null)
      .order('id')
      .range(offset, offset + per - 1)
    if (error) throw new Error(`${source} 표본 실패(offset ${offset}): ${error.message}`)
    out.push(...(data ?? []))
    if (total <= PER_SOURCE) break // 전수보다 작으면 한 창으로 끝난다
  }
  return out
}

for (const source of SOURCES) {
  const data = await sampleRows(source)
  {
  for (const r of data ?? []) {
    // 앞 6,000자만 본다 — 논문 전체를 재면 참고문헌·방법 절이 밀도를 눌러 버린다.
    const m = measureRegister((r.content ?? '').slice(0, 6000))
    if (!m) continue
    scanned++
    const key = `${r.source}|${r.register ?? '(없음)'}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(m.density)
    if (!perSource.has(r.source)) perSource.set(r.source, [])
    perSource.get(r.source).push(m.density)
  }
  }
}

console.log(`\n── 재고 (소스별 최대 ${PER_SOURCE}편 · 구간 ${SAMPLE_WINDOWS}등분 균등 표본 · 실측 ${scanned}편) ──`)
console.log(`목표 대역 하한 = 기출 중앙값 = ${THRESHOLD}\n`)
console.log('소스            선언 register    n   중앙   p75  기출 중앙 이상')
const rows = []
for (const [key, vals] of [...groups.entries()].sort()) {
  const [source, declared] = key.split('|')
  const s = summarize(key, vals)
  const pass = vals.filter((v) => v >= THRESHOLD).length
  const ratio = vals.length ? pass / vals.length : 0
  rows.push({ source, declared, ...s, passRatio: Number(ratio.toFixed(3)) })
  console.log(
    `${source.padEnd(16)}${declared.padEnd(15)}${String(s.n).padStart(4)}` +
      `${String(s.median).padStart(7)}${String(s.p75).padStart(6)}` +
      `${(100 * ratio).toFixed(0).padStart(9)}%`,
  )
}

// ── ③ 선언이 측정을 예측하는가 ──────────────────────────────────────
const declaredArg = []
const declaredExp = []
for (const [key, vals] of groups.entries()) {
  const declared = key.split('|')[1]
  if (declared === 'argumentative') declaredArg.push(...vals)
  else if (declared === 'expository') declaredExp.push(...vals)
}
const a = summarize('선언 argumentative', declaredArg)
const e = summarize('선언 expository', declaredExp)
console.log('\n── 선언이 측정을 예측하는가 ────────────────────────────────')
console.log(`선언 argumentative  n=${a.n}  중앙 ${a.median}  p25 ${a.p25}  p75 ${a.p75}`)
console.log(`선언 expository     n=${e.n}  중앙 ${e.median}  p25 ${e.p25}  p75 ${e.p75}`)
const sep = a.median != null && e.median != null ? Number((a.median - e.median).toFixed(2)) : null
/**
 * **겹침으로 판정한다.** 중앙값 차이만 보면 속는다 — 실측 2026-09-13 에 차이가 1.12 라
 * 「어느 정도 갈라 준다」고 적었는데, 같은 표에서 선언 expository 의 p75(6.36)가 선언
 * argumentative 의 p75(5.92)보다 **높았다**. 분포가 거의 완전히 겹치는데 중앙값만 조금 다른 것이다.
 *
 * 겹침 = 선언 expository 중 선언 argumentative 의 중앙값을 넘는 비율.
 * 무작위라면 50% 다. 50% 에 가까우면 선언은 아무것도 가르지 않는다.
 */
const overlap = a.median == null ? null : declaredExp.filter((v) => v >= a.median).length / (declaredExp.length || 1)
console.log(`중앙값 차이 ${sep}`)
console.log(
  `겹침: 선언 expository 중 ${(100 * (overlap ?? 0)).toFixed(0)}% 가 선언 argumentative 의 중앙값 이상 ` +
    `(무작위면 50%)`,
)
console.log(
  overlap == null
    ? '  → 판정 불가'
    : overlap > 0.35
      ? '  → **선언이 측정을 갈라 주지 않는다.** register 는 소스 이름으로 정한 라벨이지 본문의 성질이 아니다'
      : '  → 선언이 측정과 어느 정도 맞는다',
)

// ── ④ 측정 기반 공급량 — 표본 통과율 × 실제 행수 ────────────────────
// **선언을 세는 것과 재는 것의 차이를 숫자로 보인다.** 이 계산을 셸에서 한 번 하고 버리면
// 다음 사람이 재현할 수 없고, 그러면 이 수치는 근거가 아니라 주장이 된다.
//
// ⚠️ 변형 가능한 행만 센다(`display_only=false` + PD·CC0·CC BY·CC BY-SA). ND 본문의
//   밀도가 높아도 문항이 되지 않으므로 공급량에 넣으면 거짓이 된다.
const OPEN_LICENSE = ['public_domain', 'cc0', 'cc_by', 'cc_by_sa']
const realCounts = new Map()
for (const source of SOURCES) {
  const { count, error } = await db
    .from('library_articles')
    .select('id', { count: 'exact', head: true })
    .eq('source', source)
    .in('status', ['ready', 'published'])
    .eq('display_only', false)
    .in('license_class', OPEN_LICENSE)
  if (error) throw new Error(`${source} 행수 실패: ${error.message}`)
  realCounts.set(source, count ?? 0)
}

/** 선언 기준 — 지금까지 이 목표의 우선순위를 정해 온 수치. */
const { count: declaredArgCount } = await db
  .from('library_articles')
  .select('id', { count: 'exact', head: true })
  .in('status', ['ready', 'published'])
  .eq('register', 'argumentative')
  .eq('display_only', false)
  .in('license_class', OPEN_LICENSE)

const projection = []
let measuredTotal = 0
for (const source of SOURCES) {
  const mine = rows.filter((r) => r.source === source)
  if (mine.length === 0) continue
  const sampleN = mine.reduce((n, r) => n + r.n, 0)
  if (sampleN === 0) continue
  // 소스 안에서 선언 register 가 갈리면 표본 크기로 가중한다
  const ratio = mine.reduce((n, r) => n + r.passRatio * r.n, 0) / sampleN
  const real = realCounts.get(source) ?? 0
  const est = Math.round(real * ratio)
  measuredTotal += est
  projection.push({
    source,
    rows: real,
    declared: [...new Set(mine.map((r) => r.declared))].join('/'),
    sample_n: sampleN,
    pass_ratio: Number(ratio.toFixed(3)),
    measured_supply_est: est,
  })
}
projection.sort((a, b) => b.measured_supply_est - a.measured_supply_est)

console.log('\n── 측정 기반 공급량 (변형 가능 행만) ───────────────────────')
console.log('소스              행수   선언            통과율   측정 공급 추정')
for (const r of projection) {
  console.log(
    r.source.padEnd(17) +
      String(r.rows).padStart(6) +
      '  ' +
      r.declared.padEnd(15) +
      `${(100 * r.pass_ratio).toFixed(0)}%`.padStart(6) +
      String(r.measured_supply_est).padStart(14),
  )
}
console.log(
  `\n측정 기반 논증형 지문 추정  ≈ ${measuredTotal.toLocaleString()}편` +
    `\n선언 argumentative 행수     = ${(declaredArgCount ?? 0).toLocaleString()}편` +
    `\n배수                        ≈ ${(measuredTotal / Math.max(1, declaredArgCount ?? 1)).toFixed(1)}배` +
    `\n  → 「논증문이 부족하다」는 재고의 성질이 아니라 **라벨링의 결과**였다.` +
    `\n     새 소스를 붙이기 전에 이미 가진 것을 재는 것이 먼저다.`,
)

if (outPath) {
  fs.writeFileSync(
    path.resolve(outPath),
    JSON.stringify(
      {
        measured_at: new Date().toISOString(),
        marker_groups: MARKER_GROUPS,
        note:
          '담화 표지 밀도(1,000어당). 논증의 형태를 재며 질을 재지 않는다 — 후보 선별용이고 최종 판정은 사람·LLM 몫.',
        baseline_csat: csat,
        threshold_from_csat_median: THRESHOLD,
        csat_presence_rate: Number(csatPresence.toFixed(3)),
        csat_markers_per_passage: Number(csatPerPassage.toFixed(2)),
        declared_overlap: overlap == null ? null : Number(overlap.toFixed(3)),
        per_source_declared: rows,
        declared_argumentative: a,
        declared_expository: e,
        declared_separation_median: sep,
        sample_per_source: PER_SOURCE,
        sampling: 'spread',
        sample_windows: SAMPLE_WINDOWS,
        scanned,
        projection,
        measured_supply_total: measuredTotal,
        declared_argumentative_rows: declaredArgCount ?? 0,
      },
      null,
      2,
    ),
  )
  console.log(`\n→ ${outPath}`)
}
