// scripts/csat/diagnosis/xbias-analyze.mts
//
// 관측량 편향(X 쏠림) 분석 · 최종 태그 재실행(2026-10-08) — DB 없이 M2409 픽스처로.
//   태그 세트: review-v2(검수안 v2 — 기준선) · final(Claude Code · Codex 이중 검수, 둘 다 붙인 태그만)
//   집계: raw(지금 엔진) · shrink k(역량값을 학습자 전체 정답률 쪽으로 배점 k 만큼 당김 — 벌점이 아니라 작은 표본 극단값의 신뢰 조정)
//   본다: 축별 관측 문항 수 · 1위 축 비율 vs 약한 축 비율 · 정답 축 일치 · 1위 안정(문항 하나 빼기 + 태그 하나) ·
//         X 1위 학습자의 margin · 문항 하나 빼기 유지 · 「시험 2회」(같은 학습자 · 독립 응답)에서 1회 1위 유지 · 게이트(clear/provisional/unstable) 비율
//   node <tsx cli> scripts/csat/diagnosis/xbias-analyze.mts [--n 1000]
import fs from 'node:fs'
import path from 'node:path'

import { ATTRIBUTE_CODES, type AttributeCode } from '../../../apps/web/src/lib/csat/diagnosis/engine/types.ts'
import { AXIS_LINES, applyPerturbation, lcg, rank, singlePerturbations, type TaggedItem, type Weights } from '../../../apps/web/src/lib/csat/diagnosis/seed-rules.ts'
import { rankingOf, type CoreAxisView } from '../../../apps/web/src/lib/csat/map/core.ts'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const N = process.argv.includes('--n') ? Number(process.argv[process.argv.indexOf('--n') + 1]) : 1000
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'pilot', f), 'utf8'))
const meta = read('M2409-items.json') as { items: { no: number; points: number }[] }
const tagSet = (f: string): TaggedItem[] => {
  const r = read(f) as { items: { no: number; w: Weights }[] }
  return meta.items.map((m) => ({ no: m.no, points: m.points, weights: r.items.find((x) => x.no === m.no)!.w }))
}
const SETS = { 'review-v2': tagSet('M2409-review.json'), final: tagSet('M2409-review-final.json') }
const AXIS_OF: Record<string, string> = { A1: 'V', A2: 'S', A8: 'S', A3: 'R', A6: 'R', A4: 'E', A5: 'E', A9: 'X' }
const CODES = ATTRIBUTE_CODES.filter((c) => c !== 'A7')
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null)

/** 응답 생성 — 약한 역량이 붙은 문항일수록 오답(생성기 2종). 생성은 review-v2 태그 기준(두 태그 세트를 같은 학생 · 같은 응답으로 비교) */
type Student = { weak: AttributeCode[]; wrong: Set<number>; wrong2: Set<number> }
function cohort(gen: 'gen-link' | 'gen-weight', seed: number): Student[] {
  const rnd = lcg(seed)
  const G = SETS['review-v2']
  const draw = (weak: Set<AttributeCode>) => {
    const wrong = new Set<number>()
    for (const it of G) {
      const tot = CODES.reduce((s, c) => s + it.weights[c], 0)
      const share = gen === 'gen-link' ? ([...weak].some((c) => it.weights[c] > 0) ? 1 : 0) : tot ? [...weak].reduce((s, c) => s + it.weights[c], 0) / tot : 0
      if (rnd() < 0.12 + (gen === 'gen-link' ? 0.45 : 0.7) * share) wrong.add(it.no)
    }
    return wrong
  }
  return Array.from({ length: N }, () => {
    const k = rnd() < 0.5 ? 1 : 2
    const weak = new Set<AttributeCode>()
    while (weak.size < k) weak.add(CODES[Math.floor(rnd() * CODES.length)])
    return { weak: [...weak], wrong: draw(weak), wrong2: draw(weak) }
  })
}

/** 「시험 2회」 — 같은 문항 세트를 두 번(번호 +100) · 응답은 독립 */
const twice = (items: TaggedItem[]) => [...items, ...items.map((it) => ({ ...it, no: it.no + 100 }))]
const both = (s: Student) => new Set([...s.wrong, ...[...s.wrong2].map((n) => n + 100)])

function gate(items: TaggedItem[], wrong: Set<number>, shrink: number) {
  const r = rank(items, wrong, 0.6, 5, false, shrink)
  const views = (Object.entries(AXIS_LINES) as [CoreAxisView['code'], AttributeCode[]][]).map(([code, lines]) => {
    const a = r.axes.find((x) => x.axis === code)
    const ns = lines.filter((c) => r.attr[c] !== undefined).map((c) => r.attrN[c] ?? 0)
    const o = a ? a.observed : null
    return { code, observed: o, minLineN: ns.length ? Math.min(...ns) : null, status: o === null ? 'insufficient' : o < 0.6 ? 'obs_low' : o < 0.8 ? 'obs_mid' : 'obs_high' } as Pick<CoreAxisView, 'code' | 'status' | 'observed' | 'minLineN'>
  })
  return { r, g: rankingOf(views, 0.6) }
}

const out: Record<string, unknown> = { n: N, at: '2026-10-08' }
for (const [tag, items] of Object.entries(SETS)) {
  out[`${tag}/axisItems`] = Object.fromEntries(Object.entries(AXIS_LINES).map(([a, lines]) => [a, Object.fromEntries(lines.map((c) => [c, items.filter((i) => i.weights[c] > 0).length]))]))
  const pert = singlePerturbations(items).filter((p) => p.kind !== 'core_change')
  for (const gen of ['gen-link', 'gen-weight'] as const) {
    const students = cohort(gen, gen === 'gen-link' ? 1008 : 2008)
    for (const k of [0, 4, 8, 12, 20]) {
      const top = (I: TaggedItem[], w: Set<number>) => rank(I, w, 0.6, 5, false, k).candidates[0] ?? null
      const rows = students.map((s) => {
        const t = top(items, s.wrong)
        if (!t) return null
        const { r, g } = gate(items, s.wrong, k)
        const itemKeep = items.every((x) => top(items.filter((y) => y.no !== x.no), s.wrong) === t)
        const tagFlip = pert.filter((p) => top(applyPerturbation(items, p), s.wrong) !== t).length / pert.length
        return {
          t, truth: s.weak.some((c) => AXIS_OF[c] === t), margin: r.gap, itemKeep, robust: itemKeep && tagFlip <= 0.05,
          twiceKeep: top(twice(items), both(s)) === t, kind: g.kind, conf: g.confidence,
        }
      }).filter((x): x is NonNullable<typeof x> => x !== null)
      const xs = rows.filter((r) => r.t === 'X')
      out[`${tag}/${gen}/shrink${k}`] = {
        withCandidate: rows.length,
        truth: pct(rows.filter((r) => r.truth).length, rows.length),
        robust: pct(rows.filter((r) => r.robust).length, rows.length),
        twiceKeep: pct(rows.filter((r) => r.twiceKeep).length, rows.length),
        topShare: Object.fromEntries(['V', 'S', 'R', 'E', 'X'].map((a) => [a, pct(rows.filter((r) => r.t === a).length, rows.length)])),
        weakShare: Object.fromEntries(['V', 'S', 'R', 'E', 'X'].map((a) => [a, pct(students.filter((s) => s.weak.some((c) => AXIS_OF[c] === a)).length, students.length)])),
        X: { n: xs.length, truth: pct(xs.filter((r) => r.truth).length, xs.length), marginUnder005: pct(xs.filter((r) => (r.margin ?? 1) < 0.05).length, xs.length), itemKeep: pct(xs.filter((r) => r.itemKeep).length, xs.length), twiceKeep: pct(xs.filter((r) => r.twiceKeep).length, xs.length) },
        gate: { clear_stable: pct(rows.filter((r) => r.kind === 'clear' && r.conf === 'stable').length, rows.length), clear_provisional: pct(rows.filter((r) => r.kind === 'clear' && r.conf === 'provisional').length, rows.length), unstable: pct(rows.filter((r) => r.kind === 'unstable').length, rows.length) },
        clearRobust: pct(rows.filter((r) => r.kind === 'clear' && r.robust).length, rows.filter((r) => r.kind === 'clear').length),
        clearTruth: pct(rows.filter((r) => r.kind === 'clear' && r.truth).length, rows.filter((r) => r.kind === 'clear').length),
        clearTopShare: Object.fromEntries(['V', 'S', 'R', 'E', 'X'].map((ax) => [ax, pct(rows.filter((r) => r.kind === 'clear' && r.t === ax).length, rows.filter((r) => r.kind === 'clear').length)])),
        clearXTruth: pct(rows.filter((r) => r.kind === 'clear' && r.t === 'X' && r.truth).length, rows.filter((r) => r.kind === 'clear' && r.t === 'X').length),
      }
    }
  }
  for (const [name, w] of [['P1', [19, 24, 29, 30, 31, 34, 40, 42]], ['P2', [20, 23, 32, 33, 35, 36, 37, 38, 39, 43, 44]]] as const) {
    for (const k of [0, 8]) {
      const { r, g } = gate(items, new Set(w), k)
      out[`${tag}/${name}/shrink${k}`] = { ranking: g, axes: r.axes.map((a) => `${a.axis} ${a.observed.toFixed(3)} n${a.n}`) }
    }
  }
}
fs.mkdirSync(path.join(ROOT, 'tmp/pilot'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'tmp/pilot/xbias-analyze.json'), JSON.stringify(out, null, 1))
for (const [k, v] of Object.entries(out)) if (k !== 'n' && k !== 'at') console.log(k, JSON.stringify(v))
