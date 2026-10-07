// scripts/csat/diagnosis/shrink-validate.mts
//
// 최종 이중검수 태그 + 축소 추정 k=8 봉인 검증(2026-10-08) — DB 없이 M2409 픽스처로.
//   A raw    : 지금 엔진 그대로 1위(게이트 없음 · 축소 없음)
//   B gate   : RANKING_GATE + provisional (축소 없음)
//   C gate+k : RANKING_GATE + provisional + 축소 추정 k(제품 RANKING_SHRINK 와 같은 정의)
// 본다: 후보 · 정답 축 · 확정(stable/provisional) · 구분 확인 · 축별 1위 분포 · 축별 거짓 1위 · 태그 하나/문항 하나 흔들림 · margin 분포 ·
//       k 0..20 곡선 · 생성기 분리(gen-link 로 고르고 gen-weight 로 확인) · 부트스트랩(200회)에서 k 6~10 안정성.
// 결과 → tmp/pilot/shrink-validate.json
//   node <tsx cli> scripts/csat/diagnosis/shrink-validate.mts
import fs from 'node:fs'
import path from 'node:path'

import { ATTRIBUTE_CODES, type AttributeCode } from '../../../apps/web/src/lib/csat/diagnosis/engine/types.ts'
import { AXIS_LINES, applyPerturbation, lcg, rank, singlePerturbations, type TaggedItem, type Weights } from '../../../apps/web/src/lib/csat/diagnosis/seed-rules.ts'
import { RANKING_SHRINK, rankingOf, type CoreAxisView } from '../../../apps/web/src/lib/csat/map/core.ts'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'pilot', f), 'utf8'))
const meta = read('M2409-items.json') as { items: { no: number; points: number }[] }
const tagSet = (f: string): TaggedItem[] => {
  const r = read(f) as { items: { no: number; w: Weights }[] }
  return meta.items.map((m) => ({ no: m.no, points: m.points, weights: r.items.find((x) => x.no === m.no)!.w }))
}
const FINAL = tagSet('M2409-review-final.json')
const GEN_TAGS = tagSet('M2409-review.json') // 응답 생성은 검수안 v2 기준(학습자의 「진짜」 약점 구조 — 판정 태그와 분리)
const AXIS_OF: Record<string, string> = { A1: 'V', A2: 'S', A8: 'S', A3: 'R', A6: 'R', A4: 'E', A5: 'E', A9: 'X' }
const AXES = ['V', 'S', 'R', 'E', 'X'] as const
const CODES = ATTRIBUTE_CODES.filter((c) => c !== 'A7')
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null)
const K = RANKING_SHRINK.k

type Student = { weak: AttributeCode[]; wrong: Set<number> }
function cohort(gen: 'gen-link' | 'gen-weight', seed: number, n: number): Student[] {
  const rnd = lcg(seed)
  return Array.from({ length: n }, () => {
    const k = rnd() < 0.5 ? 1 : 2
    const weak = new Set<AttributeCode>()
    while (weak.size < k) weak.add(CODES[Math.floor(rnd() * CODES.length)])
    const wrong = new Set<number>()
    for (const it of GEN_TAGS) {
      const tot = CODES.reduce((s, c) => s + it.weights[c], 0)
      const share = gen === 'gen-link' ? ([...weak].some((c) => it.weights[c] > 0) ? 1 : 0) : tot ? [...weak].reduce((s, c) => s + it.weights[c], 0) / tot : 0
      if (rnd() < 0.12 + (gen === 'gen-link' ? 0.45 : 0.7) * share) wrong.add(it.no)
    }
    return { weak: [...weak], wrong }
  })
}

type Mode = 'A' | 'B' | 'C'
/** 학생에게 보일 결과 — kind(step=clear/raw · distinguish · none) · 1위 · 경쟁 축 · 확신 · margin */
function decide(items: TaggedItem[], wrong: Set<number>, mode: Mode, k = K) {
  const r = rank(items, wrong, 0.6, 5, false, mode === 'C' ? k : 0)
  if (mode === 'A') {
    const top = r.candidates[0] ?? null
    return { kind: top ? 'step' : 'none', top, rival: null as string | null, conf: null as string | null, margin: r.gap }
  }
  const views = (Object.entries(AXIS_LINES) as [CoreAxisView['code'], AttributeCode[]][]).map(([code, lines]) => {
    const a = r.axes.find((x) => x.axis === code)
    const ns = lines.filter((c) => r.attr[c] !== undefined).map((c) => r.attrN[c] ?? 0)
    const o = a ? a.observed : null
    return { code, observed: o, minLineN: ns.length ? Math.min(...ns) : null, status: o === null ? 'insufficient' : o < 0.6 ? 'obs_low' : o < 0.8 ? 'obs_mid' : 'obs_high' } as Pick<CoreAxisView, 'code' | 'status' | 'observed' | 'minLineN'>
  })
  const g = rankingOf(views, 0.6)
  return { kind: g.kind === 'clear' ? 'step' : g.kind === 'unstable' ? 'distinguish' : 'none', top: g.top as string | null, rival: g.rival as string | null, conf: g.confidence as string | null, margin: r.gap }
}

function evaluate(items: TaggedItem[], students: Student[], mode: Mode, k = K, heavy = true) {
  const pert = singlePerturbations(items).filter((p) => p.kind !== 'core_change')
  const rows = students.map((s) => {
    const d = decide(items, s.wrong, mode, k)
    if (d.kind === 'none') return null
    const weakAxes = new Set(s.weak.map((c) => AXIS_OF[c]))
    const same = (x: ReturnType<typeof decide>) => x.kind === d.kind && x.top === d.top && x.rival === d.rival
    const tagFlip = heavy ? pert.filter((p) => !same(decide(applyPerturbation(items, p), s.wrong, mode, k))).length / pert.length : 0
    const itemFlip = heavy ? items.filter((x) => !same(decide(items.filter((y) => y.no !== x.no), s.wrong, mode, k))).length / items.length : 0
    return { ...d, truth: weakAxes.has(d.top as string), pairTruth: weakAxes.has(d.top as string) || (d.rival !== null && weakAxes.has(d.rival)), weakAxes, tagFlip, itemFlip }
  }).filter((x): x is NonNullable<typeof x> => x !== null)
  const step = rows.filter((r) => r.kind === 'step')
  const dist = rows.filter((r) => r.kind === 'distinguish')
  const margins = rows.map((r) => r.margin ?? 1).sort((a, b) => a - b)
  const q = (p: number) => Math.round((margins[Math.floor(p * (margins.length - 1))] ?? 0) * 1000) / 1000
  const perAxis = Object.fromEntries(AXES.map((a) => {
    const tops = step.filter((r) => r.top === a)
    return [a, {
      items: Object.fromEntries((AXIS_LINES[a] as AttributeCode[]).map((c) => [c, items.filter((i) => i.weights[c] > 0).length])),
      stepTop: pct(tops.length, step.length),
      weakShare: pct(students.filter((s) => s.weak.some((c) => AXIS_OF[c] === a)).length, students.length),
      falseTop: pct(tops.filter((r) => !r.truth).length, tops.length),
      itemKeep: heavy ? pct(tops.filter((r) => r.itemFlip === 0).length, tops.length) : null,
    }]
  }))
  return {
    students: students.length,
    withAction: rows.length,
    truth: pct(rows.filter((r) => r.truth).length, rows.length),
    step: pct(step.length, rows.length),
    stepStable: pct(step.filter((r) => r.conf === 'stable').length, rows.length),
    stepProvisional: pct(step.filter((r) => r.conf === 'provisional').length, rows.length),
    stepTruth: pct(step.filter((r) => r.truth).length, step.length),
    distinguish: pct(dist.length, rows.length),
    distinguishPairTruth: pct(dist.filter((r) => r.pairTruth).length, dist.length),
    stepTagFlipAny: heavy ? pct(step.filter((r) => r.tagFlip > 0).length, step.length) : null,
    stepTagFlipMean: heavy ? Math.round((step.reduce((t, r) => t + r.tagFlip, 0) / Math.max(1, step.length)) * 1000) / 10 : null,
    stepItemFlipAny: heavy ? pct(step.filter((r) => r.itemFlip > 0).length, step.length) : null,
    marginQ: { p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75) },
    perAxis,
  }
}

const out: Record<string, unknown> = { at: '2026-10-08', k: K, tags: 'final(dual-model reviewed)', generator: 'responses from review-v2 tags' }

// 1) 300명(기준선 표본 시드) A/B/C
const base300 = cohort('gen-weight', 20261008, 300)
for (const m of ['A', 'B', 'C'] as const) out[`300/${m}`] = evaluate(FINAL, base300, m)

// 2) 두 생성기 × 1,000명 A/B/C (흔들림 계산은 무거워 C/B 만)
const cohorts = { 'gen-link': cohort('gen-link', 1008, 1000), 'gen-weight': cohort('gen-weight', 2008, 1000) }
for (const [g, S] of Object.entries(cohorts)) for (const m of ['A', 'B', 'C'] as const) out[`${g}/${m}`] = evaluate(FINAL, S, m)

// 3) k 곡선 — 생성기별(가벼운 지표만) · gen-link 로 고르고 gen-weight 로 확인
const KS = [0, 2, 4, 6, 7, 8, 9, 10, 12, 16, 20]
for (const [g, S] of Object.entries(cohorts)) {
  out[`kcurve/${g}`] = KS.map((k) => {
    const e = evaluate(FINAL, S, 'C', k, false)
    return { k, withAction: e.withAction, truth: e.truth, step: e.step, stepTruth: e.stepTruth, distinguish: e.distinguish, maxStepTop: Math.max(...AXES.map((a) => (e.perAxis[a] as { stepTop: number | null }).stepTop ?? 0)) }
  })
}
// 4) 부트스트랩 — 학습자 재표본 200회, k 6..10 의 확정 정답 축 · 행동 수 · 최대 쏠림
const boot = (S: Student[], seed: number) => {
  const rnd = lcg(seed)
  const res: Record<number, { stepTruth: number[]; withAction: number[]; maxTop: number[]; best: number }> = {}
  const bestCount: Record<number, number> = {}
  for (let b = 0; b < 200; b++) {
    const sample = Array.from({ length: S.length }, () => S[Math.floor(rnd() * S.length)])
    let best = -1, bestK = -1
    for (const k of [6, 7, 8, 9, 10]) {
      const e = evaluate(FINAL, sample, 'C', k, false)
      const r = (res[k] ??= { stepTruth: [], withAction: [], maxTop: [], best: 0 })
      r.stepTruth.push(e.stepTruth ?? 0)
      r.withAction.push(e.withAction)
      r.maxTop.push(Math.max(...AXES.map((a) => (e.perAxis[a] as { stepTop: number | null }).stepTop ?? 0)))
      if ((e.stepTruth ?? 0) > best) { best = e.stepTruth ?? 0; bestK = k }
    }
    bestCount[bestK] = (bestCount[bestK] ?? 0) + 1
  }
  const ms = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return `${m.toFixed(1)}±${Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length).toFixed(1)}` }
  return { perK: Object.fromEntries(Object.entries(res).map(([k, r]) => [k, { stepTruth: ms(r.stepTruth), withAction: ms(r.withAction), maxStepTop: ms(r.maxTop) }])), bestKCount: bestCount }
}
out['bootstrap/gen-link'] = boot(cohorts['gen-link'].slice(0, 400), 31)
out['bootstrap/gen-weight'] = boot(cohorts['gen-weight'].slice(0, 400), 32)

// 5) P1 · P2 — 1위 · 2위 · 관찰값 · 순위 추정 · 관측 · 확신
for (const [name, w] of [['P1', [19, 24, 29, 30, 31, 34, 40, 42]], ['P2', [20, 23, 32, 33, 35, 36, 37, 38, 39, 43, 44]]] as const) {
  const raw = rank(FINAL, new Set(w), 0.6, 5, false, 0)
  const est = rank(FINAL, new Set(w), 0.6, 5, false, K)
  out[`profile/${name}`] = {
    A: decide(FINAL, new Set(w), 'A'), B: decide(FINAL, new Set(w), 'B'), C: decide(FINAL, new Set(w), 'C'),
    axes: est.axes.map((a) => ({ axis: a.axis, observed: Math.round((raw.axes.find((x) => x.axis === a.axis)?.observed ?? NaN) * 1000) / 1000, rankingEstimate: Math.round(a.observed * 1000) / 1000, n: a.n })),
  }
}
fs.mkdirSync(path.join(ROOT, 'tmp/pilot'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'tmp/pilot/shrink-validate.json'), JSON.stringify(out, null, 1))
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v))
