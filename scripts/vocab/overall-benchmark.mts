// scripts/vocab/overall-benchmark.mts
//
// **종합 우위지수 — 세 자를 한 숫자로 합친다.**
//
// ── 왜 합쳐야 하는가 ───────────────────────────────────────────────
// 단어장은 자가 셋이고 재는 것이 서로 다르다:
//
//   · 내용 지수 (`market-benchmark.mjs`)  — 표제어 칸에 무엇이 들어 있나
//   · 선택 지수 (`choice-benchmark.mts`)  — 고르기 전에 줄 근거가 있나
//   · 지면 지수 (`design-benchmark.mts`)  — 펼쳤을 때 매 쪽 장치가 있나
//
// 셋 중 하나만 들고 "시중보다 낫다" 고 말하면 나머지 둘이 무엇이든 상관없어진다.
// 실제로 2026-09-06 에 그런 상태였다 — 앞의 둘이 1.6·1.3 이던 날 지면은 **0.102** 였다.
//
// ── 왜 기하평균인가 ────────────────────────────────────────────────
// 비율의 평균은 기하평균이고, **한 축이 0 에 가까우면 종합도 끌어내려야** 맞다.
// 지면이 없는 단어장은 내용이 아무리 좋아도 단어장으로 못 쓴다. 산술평균은 그 사실을 감춘다.
// (독해 쪽 `scripts/textbook/market-benchmark.mjs` 와 같은 규칙 — 자를 두 벌로 만들지 않는다.)
//
// ── 축마다 천장이 다르다 ───────────────────────────────────────────
// 지면 지수는 장치가 있거나 없거나라서 **천장이 1.153** 이다(17종 ÷ 시장 14.75).
// 그 축에 1.20 을 요구하면 영원히 미달로 남는다. 그래서 축별 판정은 **천장 대비**로 하고,
// 120% 판정은 **종합**으로 한다 — 천장이 낮은 축이 있어도 다른 축이 그만큼 더 이기면
// 학습자가 겪는 총합은 실제로 1.20 을 넘는다.
//
// 재실행 안전: 리포트 세 개를 읽기만 한다. 없으면 그 자를 먼저 돌리라고 말하고 멈춘다.
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/overall-benchmark.mts [--json] [--out <경로>]

import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const OUT = argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] : null
const AS_JSON = argv.includes('--json')

interface AxisSource {
  id: 'content' | 'choice' | 'design'
  label: string
  file: string
  /** 리포트에서 지수를 꺼내는 자리 */
  pick: (j: Record<string, unknown>) => number | null
  /** 천장이 있는 축이면 그 값 (없으면 null — 원리상 더 오를 수 있다) */
  ceiling: (j: Record<string, unknown>) => number | null
  rerun: string
  says: string
}

const AXES: AxisSource[] = [
  {
    id: 'content',
    label: '내용 지수',
    file: 'docs/reports/vocab-market-benchmark.json',
    pick: (j) => (typeof j.overall === 'number' ? j.overall : null),
    ceiling: () => null,
    rerun: 'node scripts/vocab/market-benchmark.mjs --out docs/reports/vocab-market-benchmark.json',
    says: '표제어 칸에 무엇이 들어 있나',
  },
  {
    id: 'choice',
    label: '선택 지수',
    file: 'docs/reports/vocab-choice-benchmark.json',
    pick: (j) => (typeof j.choiceIndex === 'number' ? j.choiceIndex : null),
    ceiling: () => null,
    rerun: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/choice-benchmark.mts --out docs/reports/vocab-choice-benchmark.json',
    says: '고르기 전에 줄 근거가 있나',
  },
  {
    id: 'design',
    label: '지면 지수',
    file: 'docs/reports/vocab-design-benchmark.json',
    pick: (j) => (typeof j.designIndex === 'number' ? j.designIndex : null),
    ceiling: (j) => {
      const c = j.ceiling as { reachableMax?: number } | undefined
      return typeof c?.reachableMax === 'number' ? c.reachableMax : null
    },
    rerun: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/design-benchmark.mts --out docs/reports/vocab-design-benchmark.json',
    says: '펼쳤을 때 매 쪽 장치가 있나',
  },
]

interface AxisResult {
  id: string
  label: string
  says: string
  index: number
  ceiling: number | null
  /** 천장이 있으면 천장 대비, 없으면 1.20 대비. 1 이상이면 그 축은 할 수 있는 만큼 한 것이다. */
  attainment: number
  generatedAt: string | null
}

const results: AxisResult[] = []
for (const axis of AXES) {
  const p = path.resolve(axis.file)
  if (!fs.existsSync(p)) {
    console.error(`${axis.file} 이 없다 — 먼저 돌릴 것:\n  ${axis.rerun}`)
    process.exit(1)
  }
  const j = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>
  const index = axis.pick(j)
  if (index == null) {
    console.error(`${axis.file} 에서 지수를 읽지 못했다 — 리포트 형식이 바뀌었는지 볼 것.`)
    process.exit(1)
  }
  const ceiling = axis.ceiling(j)
  results.push({
    id: axis.id,
    label: axis.label,
    says: axis.says,
    index,
    ceiling,
    attainment: Number((index / (ceiling ?? 1.2)).toFixed(3)),
    generatedAt: typeof j.generatedAt === 'string' ? j.generatedAt : null,
  })
}

const geoMean = (xs: number[]): number =>
  Number(Math.exp(xs.reduce((s, x) => s + Math.log(Math.max(x, 1e-9)), 0) / xs.length).toFixed(3))

const overall = geoMean(results.map((r) => r.index))
const GOAL = 1.2

/**
 * 종합 판정.
 *
 * `pass` 는 종합이 1.20 이상인가만 본다. **축별 미달을 종합으로 덮지 않기 위해**
 * `weakAxes` 를 따로 적는다 — 천장이 없는 축이 1.20 밑이면 그건 종합이 좋아도 문제다.
 */
const weakAxes = results.filter((r) => (r.ceiling == null ? r.index < GOAL : r.index < r.ceiling - 0.02))

const report = {
  $schema: 'vocab-overall-benchmark/1',
  generatedAt: new Date().toISOString(),
  goal: GOAL,
  axes: results,
  overall,
  pass: overall >= GOAL,
  weakAxes: weakAxes.map((r) => ({
    id: r.id,
    index: r.index,
    ceiling: r.ceiling,
    why: r.ceiling == null ? '천장이 없는 축인데 1.20 미만' : '천장에 못 닿음',
  })),
  method:
    '기하평균 — 비율의 평균은 기하평균이고 한 축이 0 에 가까우면 종합도 끌어내려야 맞다. '
    + '지면 지수는 장치가 있거나 없거나라 천장(17종 ÷ 시장 평균)이 있으므로 그 축의 목표는 '
    + '1.20 이 아니라 천장이다. 120% 판정은 종합으로 한다.',
}

if (OUT) {
  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true })
  fs.writeFileSync(path.resolve(OUT), JSON.stringify(report, null, 2), 'utf8')
}

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('\n시중 단어장 대비 종합 우위지수\n')
  for (const r of results) {
    const ceil = r.ceiling != null ? `천장 ${r.ceiling}` : '천장 없음'
    const mark = r.ceiling != null ? (r.index >= r.ceiling - 0.02 ? '✅' : '⚠️') : r.index >= GOAL ? '✅' : '❌'
    console.log(`  ${mark} ${r.label.padEnd(6)} ${String(r.index).padStart(6)}  (${ceil})  — ${r.says}`)
  }
  console.log(`\n  **종합 = ${overall}** (기하평균 ${results.length}축) · 목표 ${GOAL} → ${report.pass ? '달성' : '미달'}`)
  if (report.weakAxes.length > 0) {
    console.log('\n  아직 할 수 있는 만큼 못 한 축:')
    for (const w of report.weakAxes) console.log(`    · ${w.id} ${w.index} — ${w.why}`)
  }
  if (OUT) console.log(`\n리포트 → ${OUT}`)
}
