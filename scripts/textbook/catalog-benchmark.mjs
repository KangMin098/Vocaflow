// scripts/textbook/catalog-benchmark.mjs
//
// **경쟁 상업 카탈로그 대비 매대 지수 — 렌더된 HTML 에만 묻는다.**
//
// ── 왜 이 자가 따로 필요한가 ────────────────────────────────────────
// `market-benchmark.mjs` 는 **교재 안**(해설·지문·유형)을 잰다. 그 축은 이미 1.45 다.
// 그런데 학습자가 처음 만나는 것은 내용이 아니라 **매대**다. 매대가 얇으면 내용이 좋아도
// 아무도 안까지 가지 않는다 — 그리고 매대는 지금까지 **한 번도 측정된 적이 없었다.**
//
// ── 이 자의 규칙 ────────────────────────────────────────────────────
// ① 기준선은 관측한 상업 사이트다(`catalog-spec.json` provenance — NE_Books 2026-08-30).
// ② 우리 값은 **실제로 렌더된 HTML 에서 찾은 것만** 센다. 코드에 있어도 화면에 안 나오면 0 점이다.
//    "구현했다" 와 "학습자가 볼 수 있다" 를 가르는 유일한 방법이라 이렇게 한다.
// ③ 종합은 기하평균 — 한 축이 0 이면 종합도 0. 검색이 없는 매대는 다른 게 좋아도 매대가 아니다.
// ④ 저쪽이 구조적으로 가질 수 없는 축(즉시 학습 등)은 **지수에 섞지 않는다.** 섞으면 자화자찬이다.
//
// 재실행 안전: 읽기만 한다(HTTP GET).
// 실행: node scripts/textbook/catalog-benchmark.mjs [--base http://localhost:3000] [--json] [--out <경로>]

import fs from 'node:fs'
import path from 'node:path'

const SPEC_PATH = path.resolve('packages/library-pipeline/src/textbook/catalog-spec.json')
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'))

const baseFlag = process.argv.indexOf('--base')
const BASE = baseFlag >= 0 ? process.argv[baseFlag + 1] : 'http://localhost:3000'
const SHELF_URL = `${BASE}/library/textbooks`
// 낱권 상세는 **재고가 가장 많은 계단**으로 잰다 — 빈 권을 재면 상세 화면이 실제보다 얇아 보인다.
const stepFlag = process.argv.indexOf('--step')
const DETAIL_STEP = stepFlag >= 0 ? process.argv[stepFlag + 1] : '5'
const DETAIL_URL = `${BASE}/library/textbooks/${DETAIL_STEP}`

async function get(url) {
  const t0 = Date.now()
  const res = await fetch(url, { headers: { 'user-agent': 'vocaflow-catalog-benchmark' } })
  const html = await res.text()
  return { url, html, ms: Date.now() - t0, status: res.status }
}

// ⚠️ dev 서버는 **첫 요청에서 그 라우트를 컴파일한다.** 그 시간을 화면 시간으로 읽으면
//    5초짜리 페이지처럼 보인다(실측 2026-08-31: 5.1s → 0.20s). 그래서 한 번 데우고 잰다.
await Promise.all([get(SHELF_URL), get(DETAIL_URL)])
const [page, detail] = await Promise.all([get(SHELF_URL), get(DETAIL_URL)])

for (const p of [page, detail]) {
  if (p.status !== 200) {
    console.error(`화면을 열지 못했다: ${p.url} → HTTP ${p.status}`)
    console.error('dev 서버가 떠 있는지 확인할 것 (pnpm --filter web dev).')
    process.exit(1)
  }
}

/**
 * probe 는 렌더된 HTML 에 대한 **문자열 포함 검사**다.
 * ⚠️ 정규식이 아니라 포함 검사인 이유: 라벨이 바뀌면 조용히 통과하는 것보다
 *    시끄럽게 실패하는 편이 낫다. 라벨을 바꾸면 spec 도 같이 고쳐야 한다.
 */
function hitIn(html, probe) {
  return html.includes(probe)
}

const scoreAxes = (list, html) =>
  list.map((a) => {
  const found = a.ours.filter((o) => hitIn(html, o.probe))
  const missing = a.ours.filter((o) => !hitIn(html, o.probe))
  const ours = found.length
  return {
    id: a.id,
    name: a.name,
    why: a.why,
    market: a.market,
    marketEvidence: a.marketEvidence,
    ours,
    index: a.market === 0 ? null : Number((ours / a.market).toFixed(3)),
    found: found.map((o) => o.label),
    // ⚠️ **선언했는데 화면에 없는 것**을 반드시 드러낸다. spec 에 적어 두고 렌더를 안 하면
    //    여기서 잡히지 않으면 영영 안 잡힌다.
    declaredButNotRendered: missing.map((o) => o.label),
  }
  })

/** 축 묶음 하나의 종합 — 기하평균. 한 축이 0 이면 종합도 0 이다. */
function overallOf(list) {
  if (list.some((a) => a.index === 0)) return 0
  const idx = list.map((a) => a.index).filter((x) => x != null)
  if (idx.length === 0) return null
  return Number(Math.exp(idx.reduce((s, x) => s + Math.log(x), 0) / idx.length).toFixed(3))
}

const axes = scoreAxes(spec.axes, page.html)
const detailAxes = scoreAxes(spec.detailAxes ?? [], detail.html)

const overall = overallOf(axes)
const detailOverall = overallOf(detailAxes)
const zeroAxes = axes.filter((a) => a.index === 0)

// **여정 지수** — 매대와 낱권 상세를 함께 본 값. 학습자는 둘을 차례로 지나므로
// 한쪽만 좋아도 여정이 좋아지지 않는다. 그래서 여기서도 기하평균이다.
const journey =
  overall != null && detailOverall != null
    ? Number(Math.sqrt(overall * detailOverall).toFixed(3))
    : null

const structural = spec.structural.items.map((d) => ({ ...d, present: hitIn(page.html, d.probe) }))

const report = {
  generatedAt: new Date().toISOString(),
  specGeneratedAt: spec.generatedAt,
  baseline: spec.provenance.primary[0],
  measured: {
    shelf: { url: SHELF_URL, ms: page.ms, bytes: page.html.length },
    detail: { url: DETAIL_URL, ms: detail.ms, bytes: detail.html.length },
  },
  axes,
  overallIndex: overall,
  detailAxes,
  detailIndex: detailOverall,
  journeyIndex: journey,
  target: spec.target.overallIndex,
  zeroAxes: zeroAxes.map((a) => a.id),
  structural,
  limits: spec.provenance.limits,
  detailNotApplicable: spec.detailProvenance?.notApplicable ?? [],
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const b = report.baseline
  console.log('경쟁 상업 카탈로그 대비 매대 지수')
  console.log(`  기준선: ${b.site} — ${b.catalogSize} (관측 ${b.observedAt})`)
  console.log(`  대상  : ${SHELF_URL}  (${page.ms}ms · ${(page.html.length / 1024).toFixed(0)}KB)\n`)
  console.log('  축                              상업    우리    지수')
  console.log('  ' + '─'.repeat(58))
  for (const a of axes) {
    const mark = a.index >= 1.2 ? '✅' : a.index >= 1.0 ? '△' : a.index > 0 ? '·' : '❌'
    console.log(
      `  ${a.id} ${a.name.padEnd(24)} ${String(a.market).padStart(5)} ${String(a.ours).padStart(6)} ${String(a.index).padStart(7)} ${mark}`,
    )
    if (a.declaredButNotRendered.length) {
      console.log(`       ⚠ 선언했으나 화면에 없음: ${a.declaredButNotRendered.join(', ')}`)
    }
  }
  console.log('  ' + '─'.repeat(58))
  console.log(`  종합(기하평균) ${overall}   목표 ${report.target}`)
  if (zeroAxes.length) {
    console.log(`  ⚠ 0 인 축이 있어 종합이 0 이다: ${zeroAxes.map((a) => `${a.id} ${a.name}`).join(' · ')}`)
  }
  if (detailAxes.length) {
    console.log(`\n  낱권 상세 — ${DETAIL_URL.replace(BASE, '')} (${detail.ms}ms)`)
    console.log('  축                              상업    우리    지수')
    console.log('  ' + '─'.repeat(58))
    for (const a of detailAxes) {
      const mark = a.index >= 1.2 ? '✅' : a.index >= 1.0 ? '△' : a.index > 0 ? '·' : '❌'
      console.log(
        `  ${a.id} ${a.name.padEnd(24)} ${String(a.market).padStart(5)} ${String(a.ours).padStart(6)} ${String(a.index).padStart(7)} ${mark}`,
      )
      if (a.declaredButNotRendered.length) {
        console.log(`       ⚠ 선언했으나 화면에 없음: ${a.declaredButNotRendered.join(', ')}`)
      }
    }
    console.log('  ' + '─'.repeat(58))
    console.log(`  낱권 상세 종합 ${detailOverall}`)
    console.log(`\n  ▶ 여정 지수(매대 × 낱권) ${journey}   목표 ${report.target}`)
    if (report.detailNotApplicable.length) {
      console.log('\n  해당 없음 (지수에서 뺀 저쪽 항목 — 왜 뺐는지 함께 적는다):')
      for (const n of report.detailNotApplicable) {
        console.log(`    · ${n.field} — ${n.why}`)
      }
    }
  }

  console.log('\n  구조적 우위 (지수에 섞지 않음 — 저쪽이 가질 수 없는 것):')
  for (const d of structural) {
    console.log(`    ${d.present ? '✅' : '❌'} ${d.id} ${d.label}`)
  }
}

const outFlag = process.argv.indexOf('--out')
if (outFlag >= 0 && process.argv[outFlag + 1]) {
  fs.writeFileSync(process.argv[outFlag + 1], `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}
