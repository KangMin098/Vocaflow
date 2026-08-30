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

async function fetchShelf() {
  const t0 = Date.now()
  const res = await fetch(SHELF_URL, { headers: { 'user-agent': 'vocaflow-catalog-benchmark' } })
  const html = await res.text()
  return { html, ms: Date.now() - t0, status: res.status }
}

const page = await fetchShelf()
if (page.status !== 200) {
  console.error(`매대를 열지 못했다: ${SHELF_URL} → HTTP ${page.status}`)
  console.error('dev 서버가 떠 있는지 확인할 것 (pnpm --filter web dev).')
  process.exit(1)
}

/**
 * probe 는 렌더된 HTML 에 대한 **문자열 포함 검사**다.
 * ⚠️ 정규식이 아니라 포함 검사인 이유: 라벨이 바뀌면 조용히 통과하는 것보다
 *    시끄럽게 실패하는 편이 낫다. 라벨을 바꾸면 spec 도 같이 고쳐야 한다.
 */
function hit(probe) {
  return page.html.includes(probe)
}

const axes = spec.axes.map((a) => {
  const found = a.ours.filter((o) => hit(o.probe))
  const missing = a.ours.filter((o) => !hit(o.probe))
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

const idx = axes.map((a) => a.index).filter((x) => x != null)
const zeroAxes = axes.filter((a) => a.index === 0)
const overall = zeroAxes.length
  ? 0
  : Number(Math.exp(idx.reduce((s, x) => s + Math.log(x), 0) / idx.length).toFixed(3))

const structural = spec.structural.items.map((d) => ({ ...d, present: hit(d.probe) }))

const report = {
  generatedAt: new Date().toISOString(),
  specGeneratedAt: spec.generatedAt,
  baseline: spec.provenance.primary[0],
  measured: { url: SHELF_URL, ms: page.ms, bytes: page.html.length },
  axes,
  overallIndex: overall,
  target: spec.target.overallIndex,
  zeroAxes: zeroAxes.map((a) => a.id),
  structural,
  limits: spec.provenance.limits,
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
  console.log('\n  구조적 우위 (지수에 섞지 않음 — 저쪽이 가질 수 없는 것):')
  for (const d of structural) {
    console.log(`    ${d.present ? '✅' : '❌'} ${d.id} ${d.label}`)
  }
}

const outFlag = process.argv.indexOf('--out')
if (outFlag >= 0 && process.argv[outFlag + 1]) {
  fs.writeFileSync(process.argv[outFlag + 1], `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}
