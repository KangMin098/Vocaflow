// scripts/csat/diagnosis/ranking-calibrate.mts
//
// 진단 순위 안정성 보정(2026-10-08) — DB 없이 M2409 픽스처(문항 메타 · 검수안 v2 · seed-v1/v2)로:
//   · 1·2위 관찰값 차(margin) 분포
//   · 태그 하나 바꾸기(보조 추가 · 연결 제거) / 문항 하나 빼기에서 1위가 유지되는지 — margin 구간 · 1위 축 관측 수별
//   · seed-v1 · seed-v2 태그에서 검수안 1위가 유지되는 비율 — margin 구간별
//   · binary(지금 엔진) vs weighted(가중치 곱) — 정답 축 일치 · 안정성 · 관측량 편향 · 축 지배
// 합성 학습자는 두 생성기로 만든다(검수 가중치를 쓰는 생성기만 쓰면 weighted 가 유리해진다):
//   gen-link = 약한 역량이 붙었는지(0/1)로 오답 확률 · gen-weight = 약한 역량의 가중치 비율로 오답 확률. 시드 고정(결정적).
//   node <tsx cli> scripts/csat/diagnosis/ranking-calibrate.mts [--n 1000]
import fs from 'node:fs'
import path from 'node:path'

import { ATTRIBUTE_CODES, type AttributeCode } from '../../../apps/web/src/lib/csat/diagnosis/engine/types.ts'
import { AXIS_LINES, applyPerturbation, lcg, rank, seedWeights, singlePerturbations, type TaggedItem, type Weights } from '../../../apps/web/src/lib/csat/diagnosis/seed-rules.ts'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const N = process.argv.includes('--n') ? Number(process.argv[process.argv.indexOf('--n') + 1]) : 1000
const meta = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'pilot/M2409-items.json'), 'utf8')) as { items: { no: number; type: string; points: number; choiceWords: number }[] }
const review = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'pilot/M2409-review.json'), 'utf8')) as { items: { no: number; w: Weights }[] }
const REV: TaggedItem[] = meta.items.map((m) => ({ no: m.no, points: m.points, weights: review.items.find((r) => r.no === m.no)!.w }))
const SEED = (v: 'seed-v1' | 'seed-v2'): TaggedItem[] => meta.items.map((m) => ({ no: m.no, points: m.points, weights: seedWeights({ type: m.type, choiceWords: m.choiceWords }, v).weights }))
const AXIS_OF: Record<string, string> = { A1: 'V', A2: 'S', A8: 'S', A3: 'R', A6: 'R', A4: 'E', A5: 'E', A9: 'X' }
const CODES = ATTRIBUTE_CODES.filter((c) => c !== 'A7')

type Student = { gen: string; weak: AttributeCode[]; wrong: Set<number> }
function cohort(gen: 'gen-link' | 'gen-weight', seed: number, n: number): Student[] {
  const rnd = lcg(seed)
  return Array.from({ length: n }, () => {
    const k = rnd() < 0.5 ? 1 : 2
    const weak = new Set<AttributeCode>()
    while (weak.size < k) weak.add(CODES[Math.floor(rnd() * CODES.length)])
    const wrong = new Set<number>()
    for (const it of REV) {
      const tot = CODES.reduce((s, c) => s + it.weights[c], 0)
      const share = gen === 'gen-link'
        ? ([...weak].some((c) => it.weights[c] > 0) ? 1 : 0)
        : tot ? [...weak].reduce((s, c) => s + it.weights[c], 0) / tot : 0
      if (rnd() < 0.12 + (gen === 'gen-link' ? 0.45 : 0.7) * share) wrong.add(it.no)
    }
    return { gen, weak: [...weak], wrong }
  })
}

const TAG_P = singlePerturbations(REV).filter((p) => p.kind !== 'core_change')
interface Row {
  gen: string; weighted: boolean; top: string | null; second: string | null; margin: number | null; topN: number; headroom: number; slack: number
  tagFlip: number; itemFlip: number; truth: boolean; v1Keep: boolean; v2Keep: boolean
}
function analyse(s: Student, weighted: boolean): Row | null {
  const r = rank(REV, s.wrong, 0.6, 5, weighted)
  const top = r.candidates[0] ?? null
  if (!top) return null
  const t1 = (items: TaggedItem[]) => rank(items, s.wrong, 0.6, 5, weighted).candidates[0] ?? null
  const tagFlip = TAG_P.filter((p) => t1(applyPerturbation(REV, p)) !== top).length / TAG_P.length
  const itemFlip = REV.filter((it) => t1(REV.filter((x) => x.no !== it.no)) !== top).length / REV.length
  return {
    gen: s.gen, weighted, top, second: r.axes[1]?.axis ?? null, margin: r.gap, topN: r.axes[0].n,
    headroom: 0.6 - r.axes[0].observed,
    slack: Math.min(...AXIS_LINES[top].filter((c) => r.attr[c] !== undefined).map((c) => r.attrN[c] ?? 0)) - 5,
    tagFlip, itemFlip,
    truth: s.weak.some((c) => AXIS_OF[c] === top),
    v1Keep: t1(SEED('seed-v1')) === top,
    v2Keep: t1(SEED('seed-v2')) === top,
  }
}

const BINS = [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2, 1.01]
const binOf = (m: number) => BINS.findIndex((b, i) => m >= b && m < BINS[i + 1])
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null)
/** 안정 = 문항 하나를 빼도 1위 유지(모든 문항) + 태그 하나 바꿔도 1위 유지(바꿀 수 있는 태그의 95% 이상) */
const robust = (r: Row) => r.itemFlip === 0 && r.tagFlip <= 0.05

const report: Record<string, unknown> = { n: N, at: '2026-10-08', robustDefinition: 'itemFlip=0 && tagFlip<=5%' }
for (const gen of ['gen-link', 'gen-weight'] as const) {
  const students = cohort(gen, gen === 'gen-link' ? 1008 : 2008, N)
  for (const weighted of [false, true]) {
    const rows = students.map((s) => analyse(s, weighted)).filter((r): r is Row => r !== null)
    const bins = BINS.slice(0, -1).map((lo, i) => {
      const inBin = rows.filter((r) => r.margin !== null && binOf(r.margin) === i)
      return {
        margin: `${lo}–${BINS[i + 1] > 1 ? '∞' : BINS[i + 1]}`, n: inBin.length,
        robust: pct(inBin.filter(robust).length, inBin.length),
        itemFlip0: pct(inBin.filter((r) => r.itemFlip === 0).length, inBin.length),
        meanTagFlip: inBin.length ? Math.round((inBin.reduce((s, r) => s + r.tagFlip, 0) / inBin.length) * 1000) / 10 : null,
        truth: pct(inBin.filter((r) => r.truth).length, inBin.length),
        v1Keep: pct(inBin.filter((r) => r.v1Keep).length, inBin.length),
        v2Keep: pct(inBin.filter((r) => r.v2Keep).length, inBin.length),
      }
    })
    // 문턱 후보마다: 그 이상 margin 학습자의 안정 비율 · 그 아래(동률 처리) 비율
    const thresholds = [0, 0.02, 0.04, 0.05, 0.06, 0.08, 0.1, 0.12, 0.15].map((m) => {
      const above = rows.filter((r) => (r.margin ?? 1) >= m)
      return { m, clear: pct(above.length, rows.length), robustAmongClear: pct(above.filter(robust).length, above.length), truthAmongClear: pct(above.filter((r) => r.truth).length, above.length) }
    })
    const byTopN = [[0, 8], [8, 12], [12, 16], [16, 99]].map(([lo, hi]) => {
      const g = rows.filter((r) => r.topN >= lo && r.topN < hi)
      return { topAxisItems: `${lo}–${hi === 99 ? '' : hi - 1}`, n: g.length, robust: pct(g.filter(robust).length, g.length), itemFlip0: pct(g.filter((r) => r.itemFlip === 0).length, g.length) }
    })
    // 세 조건 격자: margin(2위와 차) · headroom(약함 문턱 0.6 아래 여유) · slack(1위 축 역량들의 최소 관측 수 − 5)
    const grid: { m: number; h: number; k: number; clear: number | null; robust: number | null; truth: number | null }[] = []
    for (const m of [0, 0.03, 0.05, 0.08, 0.1]) for (const h of [0, 0.03, 0.05, 0.08, 0.1]) for (const k of [0, 1, 2, 3]) {
      const ok = rows.filter((r) => (r.margin ?? 1) >= m && r.headroom >= h && r.slack >= k)
      grid.push({ m, h, k, clear: pct(ok.length, rows.length), robust: pct(ok.filter(robust).length, ok.length), truth: pct(ok.filter((r) => r.truth).length, ok.length) })
    }
    const axisShare =Object.fromEntries(['V', 'S', 'R', 'E', 'X'].map((a) => [a, pct(rows.filter((r) => r.top === a).length, rows.length)]))
    const weakShare = Object.fromEntries(['V', 'S', 'R', 'E', 'X'].map((a) => [a, pct(students.filter((s) => s.weak.some((c) => AXIS_OF[c] === a)).length, students.length)]))
    report[`${gen}/${weighted ? 'weighted' : 'binary'}`] = {
      withCandidate: rows.length,
      truth: pct(rows.filter((r) => r.truth).length, rows.length),
      robust: pct(rows.filter(robust).length, rows.length),
      anySecondaryFlip: pct(rows.filter((r) => r.tagFlip > 0).length, rows.length),
      itemFlipAny: pct(rows.filter((r) => r.itemFlip > 0).length, rows.length),
      v1Keep: pct(rows.filter((r) => r.v1Keep).length, rows.length),
      v2Keep: pct(rows.filter((r) => r.v2Keep).length, rows.length),
      topAxisShare: axisShare, weakAxisShare: weakShare,
      bins, thresholds, byTopN, grid,
    }
  }
}
fs.mkdirSync(path.join(ROOT, 'tmp/pilot'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'tmp/pilot/ranking-calibrate.json'), JSON.stringify(report, null, 1))
for (const [k, v] of Object.entries(report)) {
  if (typeof v !== 'object' || v === null || !('bins' in v)) continue
  const r = v as Record<string, unknown>
  console.log(`\n== ${k} · 후보 ${r.withCandidate} · 정답축 ${r.truth}% · 안정 ${r.robust}% · 보조1개로 뒤집힘 ${r.anySecondaryFlip}% · 문항1개로 뒤집힘 ${r.itemFlipAny}% · v1유지 ${r.v1Keep}% · v2유지 ${r.v2Keep}%`)
  console.log(' 1위축', JSON.stringify(r.topAxisShare), '약한축', JSON.stringify(r.weakAxisShare))
  for (const b of r.bins as Record<string, unknown>[]) console.log(' bin', JSON.stringify(b))
  for (const t of r.thresholds as Record<string, unknown>[]) console.log(' thr', JSON.stringify(t))
  for (const t of r.byTopN as Record<string, unknown>[]) console.log(' topN', JSON.stringify(t))
}
for (const [k, v] of Object.entries(report)) {
  if (typeof v !== 'object' || v === null || !('grid' in v)) continue
  const g = (v as { grid: { m: number; h: number; k: number; clear: number | null; robust: number | null; truth: number | null }[] }).grid
  console.log(`\n== grid ${k} (안정 ≥ 85% 중 clear 큰 순 6)`)
  for (const x of g.filter((x) => (x.robust ?? 0) >= 85).sort((a, b) => (b.clear ?? 0) - (a.clear ?? 0)).slice(0, 6)) console.log(' ', JSON.stringify(x))
}
