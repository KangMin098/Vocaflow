// scripts/csat/diagnosis/routing-eval.mts
//
// 축 관측 특성 routing 평가(2026-10-08) — DB 없이, 같은 합성 표본(300명 seed 20261008 · gen-link 1008 · gen-weight 2008 — 앞 단위와 같다)으로
// 「routing 전(1위를 그대로 단계로)」과 「routing 후(axis-routing.routeAction)」의 학생 행동을 비교한다. 태그 = tri-model, 순위 = k=8 + RANKING_GATE.
//   unsafe direct  — 관측 구조상 혼동되는 축(V · X)을 단계로 바로 추천
//   wrong direct   — 단계로 바로 추천한 축이 실제 약한 축이 아님
//   useful         — 실제 약한 축이 행동 안에 있다(단계 축 · 구분 확인의 두/세 축 · S 직접 확인이면 S)
//   coverage       — 행동이 하나라도 나간 비율
// 결과 → tmp/pilot/routing-eval.json
//   node <tsx cli> scripts/csat/diagnosis/routing-eval.mts
import fs from 'node:fs'
import path from 'node:path'

import { ATTRIBUTE_CODES, type AttributeCode } from '../../../apps/web/src/lib/csat/diagnosis/engine/types.ts'
import { AXIS_LINES, lcg, rank, type TaggedItem, type Weights } from '../../../apps/web/src/lib/csat/diagnosis/seed-rules.ts'
import { AXIS_EXAM_EVIDENCE, routeAction } from '../../../apps/web/src/lib/csat/map/axis-routing.ts'
import { RANKING_SHRINK, rankingOf, type CoreAxisView, type CoreCode, type CoreSummary } from '../../../apps/web/src/lib/csat/map/core.ts'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'pilot', f), 'utf8'))
const meta = read('M2409-items.json') as { items: { no: number; points: number }[] }
const tags = (f: string): TaggedItem[] => { const r = read(f) as { items: { no: number; w: Weights }[] }; return meta.items.map((m) => ({ no: m.no, points: m.points, weights: r.items.find((x) => x.no === m.no)!.w })) }
const TRI = tags('M2409-review-tri.json')
const GEN = tags('M2409-review.json')
const AXIS_OF: Record<string, CoreCode> = { A1: 'V', A2: 'S', A8: 'S', A3: 'R', A6: 'R', A4: 'E', A5: 'E', A9: 'X' }
const CODES = ATTRIBUTE_CODES.filter((c) => c !== 'A7')
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null)

type Student = { weak: AttributeCode[]; wrong: Set<number> }
function cohort(gen: 'gen-link' | 'gen-weight', seed: number, n: number): Student[] {
  const rnd = lcg(seed)
  return Array.from({ length: n }, () => {
    const k = rnd() < 0.5 ? 1 : 2
    const weak = new Set<AttributeCode>()
    while (weak.size < k) weak.add(CODES[Math.floor(rnd() * CODES.length)])
    const wrong = new Set<number>()
    for (const it of GEN) {
      const tot = CODES.reduce((s, c) => s + it.weights[c], 0)
      const share = gen === 'gen-link' ? ([...weak].some((c) => it.weights[c] > 0) ? 1 : 0) : tot ? [...weak].reduce((s, c) => s + it.weights[c], 0) / tot : 0
      if (rnd() < 0.12 + (gen === 'gen-link' ? 0.45 : 0.7) * share) wrong.add(it.no)
    }
    return { weak: [...weak], wrong }
  })
}

/** 오프라인 근사 → 제품 core 요약 꼴(순위 · 후보 · 축) */
function summaryOf(items: TaggedItem[], wrong: Set<number>): Pick<CoreSummary, 'ranking' | 'candidates' | 'axes'> {
  const raw = rank(items, wrong, 0.6, 5, false, 0)
  const est = rank(items, wrong, 0.6, 5, false, RANKING_SHRINK.k)
  const axes = (['V', 'S', 'R', 'E', 'X', 'L'] as CoreCode[]).map((code) => {
    const lines = (AXIS_LINES as Record<string, AttributeCode[]>)[code] ?? []
    const a = est.axes.find((x) => x.axis === code)
    const o = raw.axes.find((x) => x.axis === code)
    const ns = lines.filter((c) => est.attr[c] !== undefined).map((c) => est.attrN[c] ?? 0)
    return { code, observed: o ? o.observed : null, rankingEstimate: a ? a.observed : null, minLineN: ns.length ? Math.min(...ns) : null, status: a ? (a.observed < 0.6 ? 'obs_low' : a.observed < 0.8 ? 'obs_mid' : 'obs_high') : 'insufficient' } as unknown as CoreAxisView
  })
  const forRank = axes.map((a) => ({ code: a.code, minLineN: a.minLineN, observed: a.rankingEstimate, status: a.status }))
  return { axes, ranking: rankingOf(forRank, 0.6), candidates: est.candidates as CoreCode[] }
}
const overlapOf = (items: TaggedItem[], wrong: Set<number>) => {
  const o = { wrongV: 0, R: 0, E: 0, X: 0 }
  for (const it of items) {
    if (!wrong.has(it.no) || !(it.weights.A1 > 0)) continue
    o.wrongV++
    if (it.weights.A3 > 0 || it.weights.A6 > 0) o.R++
    if (it.weights.A4 > 0 || it.weights.A5 > 0) o.E++
    if (it.weights.A9 > 0) o.X++
  }
  return o
}

type Action = { kind: 'step' | 'distinguish' | 'direct' | 'none'; axes: CoreCode[] }
/** routing 전 — 지금 제품: 불안정 → 구분 확인, 확정 1위 → 그 단계(축 특성 무시), 그 밖 없음 */
const before = (s: ReturnType<typeof summaryOf>): Action => {
  const r = s.ranking
  if (r.kind === 'unstable' && r.top && r.rival) return { kind: 'distinguish', axes: [r.top, r.rival] }
  if (r.kind === 'clear' && r.top) return { kind: 'step', axes: [r.top] }
  return { kind: 'none', axes: [] }
}
const after = (s: ReturnType<typeof summaryOf>, wrong: Set<number>): Action => {
  const r = routeAction(s, overlapOf(TRI, wrong), { analyzable: true, watch: 0.8 })
  if (r.kind === 'step') return { kind: 'step', axes: [r.axis] }
  if (r.kind === 'distinguish') return { kind: 'distinguish', axes: [r.axis, r.rival, ...(r.also ? [r.also] : [])] }
  if (r.kind === 'direct') return { kind: 'direct', axes: [r.axis] }
  return { kind: 'none', axes: [] }
}

function evaluate(students: Student[]) {
  const rows = students.map((st) => {
    const s = summaryOf(TRI, st.wrong)
    const truth = new Set(st.weak.map((c) => AXIS_OF[c]))
    return { truth, b: before(s), a: after(s, st.wrong), topV: s.ranking.kind === 'clear' && s.ranking.top === 'V' }
  })
  const m = (pick: (r: (typeof rows)[number]) => Action) => {
    const acts = rows.map(pick)
    const withAct = rows.filter((_, i) => acts[i].kind !== 'none')
    const steps = rows.map((r, i) => ({ r, a: acts[i] })).filter((x) => x.a.kind === 'step')
    const kinds: Record<string, number> = {}
    for (const a of acts) kinds[a.kind] = (kinds[a.kind] ?? 0) + 1
    return {
      coverage: pct(withAct.length, rows.length),
      kinds: Object.fromEntries(Object.entries(kinds).map(([k, n]) => [k, pct(n, rows.length)])),
      unsafeDirect: pct(steps.filter((x) => AXIS_EXAM_EVIDENCE[x.a.axes[0]] === 'exam_assisted').length, rows.length),
      unsafeDirectN: steps.filter((x) => AXIS_EXAM_EVIDENCE[x.a.axes[0]] === 'exam_assisted').length,
      wrongDirect: pct(steps.filter((x) => !x.r.truth.has(x.a.axes[0])).length, steps.length),
      directStepTruth: pct(steps.filter((x) => x.r.truth.has(x.a.axes[0])).length, steps.length),
      useful: pct(rows.filter((r, i) => acts[i].axes.some((ax) => r.truth.has(ax))).length, withAct.length),
      usefulOfAll: pct(rows.filter((r, i) => acts[i].axes.some((ax) => r.truth.has(ax))).length, rows.length),
      // 단계 · 구분 확인만(약점 후보를 말하는 행동) — S 직접 확인은 약점 주장이 아니라 확인 행동이라 따로 센다
      usefulStepDistinguish: pct(rows.filter((r, i) => (acts[i].kind === 'step' || acts[i].kind === 'distinguish') && acts[i].axes.some((ax) => r.truth.has(ax))).length, rows.filter((_, i) => acts[i].kind === 'step' || acts[i].kind === 'distinguish').length),
      directS_weakS: pct(rows.filter((r, i) => acts[i].kind === 'direct' && r.truth.has('S')).length, rows.filter((_, i) => acts[i].kind === 'direct').length),
    }
  }
  // 앞 단위의 거짓 V(확정 V 1위인데 V 가 약하지 않음) — routing 뒤 어디로 갔나
  const falseV = rows.filter((r) => r.topV && !r.truth.has('V'))
  const falseVAfter: Record<string, number> = {}
  for (const r of falseV) {
    const k = r.a.kind === 'distinguish' ? `distinguish(${r.a.axes.join('/')})${r.a.axes.some((ax) => r.truth.has(ax)) ? '·약한축포함' : '·약한축없음'}` : r.a.kind
    falseVAfter[k] = (falseVAfter[k] ?? 0) + 1
  }
  return { students: students.length, before: m((r) => r.b), after: m((r) => r.a), falseV: { n: falseV.length, after: falseVAfter } }
}

const out = {
  at: '2026-10-08', tags: 'tri-model', k: RANKING_SHRINK.k,
  '300': evaluate(cohort('gen-weight', 20261008, 300)),
  'gen-link': evaluate(cohort('gen-link', 1008, 1000)),
  'gen-weight': evaluate(cohort('gen-weight', 2008, 1000)),
}
fs.mkdirSync(path.join(ROOT, 'tmp/pilot'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'tmp/pilot/routing-eval.json'), JSON.stringify(out, null, 1))
for (const k of ['300', 'gen-link', 'gen-weight'] as const) {
  const v = out[k]
  console.log(`== ${k}`)
  console.log(' before', JSON.stringify(v.before))
  console.log(' after ', JSON.stringify(v.after))
  console.log(' falseV', JSON.stringify(v.falseV))
}
