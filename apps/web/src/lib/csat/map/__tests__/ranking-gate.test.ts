// apps/web/src/lib/csat/map/__tests__/ranking-gate.test.ts
//
// 「먼저 확인」 1위 안정 판정 회귀(2026-10-08) — RANKING_GATE(margin · headroom · minLineN) 세 조건 · 근거 부족 축은 순위 밖 ·
// 불안정하면 두 후보를 가르는 확인 하나(행동 하나) · M2409 파일럿 P1/P2 · 합성 학습자 300명 안정성.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { applyPerturbation, lcg, rank, singlePerturbations, type TaggedItem, type Weights } from '../../diagnosis/seed-rules'
import { ATTRIBUTE_CODES, type AttributeCode } from '../../diagnosis/engine/types'
import { RANKING_GATE, RANKING_SHRINK, coreSummary, rankingOf, type CoreAxisView } from '../core'
import { DISTINGUISH, distinguishActivity } from '../distinguish'
import { learnerPath } from '../learner-path'
import type { NodeValue } from '../model'

const SETTINGS = { core: { weak: 0.6, watch: 0.8 }, min_coverage: 0.5 }
const ax = (code: CoreAxisView['code'], observed: number | null, minLineN: number | null = 10): Pick<CoreAxisView, 'code' | 'status' | 'observed' | 'minLineN'> => ({
  code, observed, minLineN, status: observed === null ? 'insufficient' : observed < 0.6 ? 'obs_low' : observed < 0.8 ? 'obs_mid' : 'obs_high',
})

describe('rankingOf — 세 조건', () => {
  it('충분한 근거 + 명확한 1위 → clear', () => {
    expect(rankingOf([ax('R', 0.45), ax('E', 0.6), ax('V', 0.8)], 0.6)).toEqual({ kind: 'clear', top: 'R', rival: null, reasons: [], confidence: 'stable', unobserved: [] })
  })
  it('사실상 동률(margin < 0.05) → unstable · near_tie · 경쟁 축 = 2위', () => {
    expect(rankingOf([ax('V', 0.37), ax('S', 0.385), ax('R', 0.65)], 0.6)).toMatchObject({ kind: 'unstable', top: 'V', rival: 'S', reasons: ['near_tie'] })
  })
  it('2위가 「관찰 낮음」이 아니어도 가까우면 동률이다(0.57 vs 0.61)', () => {
    expect(rankingOf([ax('R', 0.5), ax('E', 0.53)], 0.6).reasons).toContain('near_tie')
    expect(rankingOf([ax('R', 0.57), ax('E', 0.61), ax('V', 0.9)], 0.6)).toMatchObject({ kind: 'unstable', reasons: expect.arrayContaining(['near_tie', 'near_line']) })
  })
  it('선 바로 아래(headroom < 0.05) → near_line', () => {
    expect(rankingOf([ax('X', 0.57), ax('V', 0.9)], 0.6)).toMatchObject({ kind: 'unstable', top: 'X', rival: 'V', reasons: ['near_line'] })
  })
  it('관측이 최소 관측 바로 위(minLineN < 6) → thin_evidence', () => {
    expect(rankingOf([ax('S', 0.3, 5), ax('R', 0.7)], 0.6)).toMatchObject({ kind: 'unstable', reasons: ['thin_evidence'] })
    expect(rankingOf([ax('S', 0.3, RANKING_GATE.minLineN), ax('R', 0.7)], 0.6).kind).toBe('clear')
  })
  it('근거 부족 축(관찰값 없음)은 순위 · 경쟁 축에 들어오지 않는다 — 「문제 없음」으로 읽지 않는다', () => {
    const r = rankingOf([ax('V', 0.3), ax('S', null), ax('R', 0.9)], 0.6)
    expect(r).toEqual({ kind: 'clear', top: 'V', rival: null, reasons: [], confidence: 'provisional', unobserved: ['S'] })
  })
  it('단독 우선 후보 — 비교할 축이 근거 부족이면 clear 여도 확신은 provisional(근거가 강해서 1위가 아니다) · 듣기(L)는 세지 않는다', () => {
    expect(rankingOf([ax('V', 0.3), ax('R', 0.9), ax('L', null)], 0.6).confidence).toBe('stable')
    expect(rankingOf([ax('V', 0.3), ax('S', null), ax('R', 0.9)], 0.6).confidence).toBe('provisional')
    expect(rankingOf([ax('V', 0.3)], 0.6).confidence).toBe('provisional') // 비교할 축 자체가 없다
    expect(rankingOf([ax('V', 0.37), ax('S', 0.385)], 0.6).confidence).toBeNull() // unstable
  })
  it('후보 없음 → none', () => {
    expect(rankingOf([ax('V', 0.7), ax('S', 0.9)], 0.6).kind).toBe('none')
    expect(rankingOf([], 0.6).kind).toBe('none')
  })
})

describe('학습자 길 — 불안정하면 구분 확인 하나', () => {
  const v = (achieved: number | null, n = 8): NodeValue => ({ target: 1, achieved, status: 'short', coverage: null, n, points: 10 } as unknown as NodeValue)
  it('V ≈ S 동률 → focus distinguish(어휘·표현 ↔ 문장 이해) · 두 단계 모두 「먼저 확인」 · 행동 하나', () => {
    const p = learnerPath({ nodes: { A1: v(0.37), A2: v(0.385), A8: v(0.385), A3: v(0.65), A6: v(0.65), A4: v(0.7), A5: v(0.9), A9: v(0.88) }, currentScore: 70 }, SETTINGS)
    expect(p.focus).toMatchObject({ kind: 'distinguish', step: 'vocab', rival: 'sentence', title: '어휘·표현 때문인지 문장 이해 때문인지 먼저 확인해 볼게요' })
    expect(p.read.filter((s) => s.evidence === 'focus').map((s) => s.key)).toEqual(['vocab', 'sentence'])
    expect(p.journey).toBe('diagnostic_need')
  })
  it('단독 우선 후보 — 행동은 그 단계 하나, 비교 못 한 단계를 함께 알린다', () => {
    const p = learnerPath({ nodes: { A1: v(0.3), A3: v(0.9), A6: v(0.9), A4: v(0.85), A5: v(0.85), A9: v(0.9) }, currentScore: 70 }, SETTINGS)
    expect(p.focus).toMatchObject({ kind: 'step', step: 'vocab', provisional: { unobserved: ['sentence'] } })
  })
  it('명확하면 지금처럼 단계 하나', () => {
    const p = learnerPath({ nodes: { A1: v(0.9), A2: v(0.9), A8: v(0.9), A3: v(0.4), A6: v(0.4), A4: v(0.75), A5: v(0.75), A9: v(0.9) }, currentScore: 70 }, SETTINGS)
    expect(p.focus).toMatchObject({ kind: 'step', step: 'relation' })
  })
  it('구분 활동은 듣기를 뺀 모든 축 쌍에 하나씩 · 학생 화면 금지어 없음', () => {
    const axes = ['V', 'S', 'R', 'E', 'X'] as const
    for (const a of axes) for (const b of axes) if (a !== b) expect(distinguishActivity(a, b)).not.toBeNull()
    expect(distinguishActivity('L', 'V')).toBeNull()
    for (const d of DISTINGUISH) expect(`${d.how.join(' ')} ${d.read}`).not.toMatch(/숙달|취약|약점|부족 역량|병목/)
  })
})

// ── M2409 파일럿 · 합성 학습자(오프라인 근사 = 실제 엔진 — seed-rules.test 가 검산) ──
const ROOT = path.resolve(__dirname, '../../../../../../..')
const pilot = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/csat/diagnosis/pilot', f), 'utf8'))
const meta = pilot('M2409-items.json') as { items: { no: number; points: number }[] }
const review = pilot('M2409-review.json') as { items: { no: number; w: Weights }[] }
const ITEMS: TaggedItem[] = meta.items.map((m) => ({ no: m.no, points: m.points, weights: review.items.find((r) => r.no === m.no)!.w }))
const AXES = { V: ['A1'], S: ['A2', 'A8'], R: ['A3', 'A6'], E: ['A4', 'A5'], X: ['A9'] } as const
const gateOf = (items: TaggedItem[], wrong: Set<number>) => {
  const r = rank(items, wrong)
  const views = (Object.entries(AXES) as [CoreAxisView['code'], readonly AttributeCode[]][]).map(([code, lines]) => {
    const a = r.axes.find((x) => x.axis === code)
    const ns = lines.filter((c) => r.attr[c] !== undefined).map((c) => r.attrN[c] ?? 0)
    return ax(code, a ? a.observed : null, ns.length ? Math.min(...ns) : null)
  })
  return rankingOf(views, 0.6)
}

describe('M2409 파일럿 회귀', () => {
  it('P1(어휘 · 문장 수준) — 1·2위 0.014 차 → 확정하지 않고 어휘·표현 ↔ 문장 이해 구분 확인', () => {
    expect(gateOf(ITEMS, new Set([19, 24, 29, 30, 31, 34, 40, 42]))).toMatchObject({ kind: 'unstable', top: 'V', rival: 'S', reasons: expect.arrayContaining(['near_tie']) })
  })
  it('P2(흐름 · 선지) — 문장 관계 1위 확정(차 0.14)', () => {
    expect(gateOf(ITEMS, new Set([20, 23, 32, 33, 35, 36, 37, 38, 39, 43, 44]))).toMatchObject({ kind: 'clear', top: 'R' })
  })
})

describe('M2409 최종 태그(Claude Code · Codex 이중 검수 · 둘 다 붙인 태그만)', () => {
  const fin = pilot('M2409-review-final.json') as { items: { no: number; w: Weights }[] }
  const F: TaggedItem[] = meta.items.map((m) => ({ no: m.no, points: m.points, weights: fin.items.find((r) => r.no === m.no)!.w }))
  it('A2 연결 1문항 · A6 0문항 → 이 시험만으로는 문장 이해(S) 축을 관찰하지 않는다', () => {
    expect(F.filter((i) => i.weights.A2 > 0).length).toBe(1)
    expect(F.filter((i) => i.weights.A6 > 0).length).toBe(0)
  })
  it('P1 — 어휘·표현 단독 우선 후보(provisional · 문장 이해 미관찰) / P2 — 문장 관계', () => {
    expect(gateOf(F, new Set([19, 24, 29, 30, 31, 34, 40, 42]))).toMatchObject({ kind: 'clear', top: 'V', confidence: 'provisional', unobserved: ['S'] })
    expect(gateOf(F, new Set([20, 23, 32, 33, 35, 36, 37, 38, 39, 43, 44]))).toMatchObject({ top: 'R' })
  })
})

describe('합성 학습자 300명 — 확정한 1위는 태그 하나에 잘 뒤집히지 않는다', () => {
  // seed-compare 의 기준선 표본과 같은 생성기 · 시드(20261008): 후보 137명 중 보조 태그 하나로 1위가 바뀌는 학습자 82명(60%)
  const rnd = lcg(20261008)
  const CODES = ATTRIBUTE_CODES.filter((c) => c !== 'A7')
  const students = Array.from({ length: 300 }, () => {
    const k = rnd() < 0.5 ? 1 : 2
    const weak = new Set<AttributeCode>()
    while (weak.size < k) weak.add(CODES[Math.floor(rnd() * CODES.length)])
    const wrong = new Set<number>()
    for (const it of ITEMS) {
      const tot = CODES.reduce((s, c) => s + it.weights[c], 0)
      const share = tot ? [...weak].reduce((s, c) => s + it.weights[c], 0) / tot : 0
      if (rnd() < 0.12 + 0.7 * share) wrong.add(it.no)
    }
    return wrong
  })
  const secondary = singlePerturbations(ITEMS).filter((p) => p.kind !== 'core_change')
  const top = (items: TaggedItem[], w: Set<number>) => rank(items, w).candidates[0] ?? null
  it('기준선 60% → 확정(clear)한 학습자 중 보조 태그 하나로 1위가 바뀌는 비율 ≤ 기준선의 절반', () => {
    const withCand = students.filter((w) => top(ITEMS, w) !== null)
    const flipped = (w: Set<number>) => secondary.some((p) => top(applyPerturbation(ITEMS, p), w) !== top(ITEMS, w))
    const before = withCand.filter(flipped).length / withCand.length
    const clear = withCand.filter((w) => gateOf(ITEMS, w).kind === 'clear')
    const after = clear.filter(flipped).length / clear.length
    expect(withCand.length).toBe(137)
    expect(Math.round(before * 100)).toBe(60)
    expect(after).toBeLessThanOrEqual(before / 2)
  })
})

describe('축소 추정 RANKING_SHRINK(ranking calibration v1 · k=8) — 순위에만', () => {
  const nv = (achieved: number | null, n: number, den: number | null, points = 10): NodeValue => ({ target: 1, achieved, status: 'short', coverage: null, n, den, points } as unknown as NodeValue)
  it('k=8 · 버전 표기(교육 기준이 아닌 내부 안정성 파라미터)', () => {
    expect(RANKING_SHRINK).toEqual({ k: 8, version: 'ranking-calibration-v1' })
  })
  it('관찰값(observed)은 그대로 · 순위 추정만 학습자 전체 값 쪽으로 당겨진다', () => {
    const s = coreSummary({ nodes: { A1: nv(0.3, 10, 20), A3: nv(0.8, 20, 40), A4: nv(0.8, 15, 30), A5: nv(0.8, 8, 15), A9: nv(0.8, 8, 15) } }, SETTINGS)
    const V = s.axes.find((a) => a.code === 'V')!
    expect(V.observed).toBeCloseTo(0.3, 6)
    // 전체 값 = (0.3·20 + 0.8·(40+30+15+15)) / 120 = 0.7167 → V 추정 = (0.3·20 + 8·0.7167) / 28
    expect(V.rankingEstimate).toBeCloseTo((0.3 * 20 + 8 * (86 / 120)) / 28, 6)
  })
  it('관측(분모)이 적은 축일수록 더 당겨진다 — 벌점이 아니라 극단값 신뢰 조정', () => {
    const s = coreSummary({ nodes: { A1: nv(0.3, 6, 10), A3: nv(0.3, 30, 60), A4: nv(0.9, 15, 30), A5: nv(0.9, 8, 15), A9: nv(0.9, 8, 15) } }, SETTINGS)
    const V = s.axes.find((a) => a.code === 'V')!
    const R = s.axes.find((a) => a.code === 'R')!
    expect((V.rankingEstimate as number) - 0.3).toBeGreaterThan((R.rankingEstimate as number) - 0.3)
    expect(s.candidates[0]).toBe('R') // 같은 관찰값 0.3 이면 관측이 많은 쪽을 먼저
  })
  it('분모가 없는 옛 스냅샷 라인은 관찰값 그대로(추정 = 관찰)', () => {
    const s = coreSummary({ nodes: { A1: nv(0.3, 10, null), A3: nv(0.8, 20, null) } }, SETTINGS)
    for (const a of s.axes.filter((x) => x.observed !== null)) expect(a.rankingEstimate).toBeCloseTo(a.observed as number, 9)
  })
  it('기존 게이트는 그대로 — 관측 적음(thin_evidence) · 근거 부족 축 · provisional', () => {
    const thin = coreSummary({ nodes: { A1: nv(0.2, 5, 10), A3: nv(0.9, 20, 40), A4: nv(0.9, 15, 30) } }, SETTINGS)
    expect(thin.ranking).toMatchObject({ kind: 'unstable', top: 'V', reasons: expect.arrayContaining(['thin_evidence']) })
    const prov = coreSummary({ nodes: { A1: nv(0.2, 10, 20), A3: nv(0.9, 20, 40), A4: nv(0.9, 15, 30), A5: nv(0.9, 8, 15), A9: nv(0.9, 8, 15) } }, SETTINGS)
    expect(prov.ranking).toMatchObject({ kind: 'clear', top: 'V', confidence: 'provisional', unobserved: ['S'] })
  })
})

describe('M2409 최종 태그 + k=8 회귀(오프라인 근사 · 제품 정의와 같다)', () => {
  const fin = pilot('M2409-review-final.json') as { items: { no: number; w: Weights }[] }
  const F: TaggedItem[] = meta.items.map((m) => ({ no: m.no, points: m.points, weights: fin.items.find((r) => r.no === m.no)!.w }))
  it('P1 어휘·표현 · P2 문장 관계 — 둘 다 1위 유지(축소 후에도) · 2위와 차 0.17 이상', () => {
    const p1 = rank(F, new Set([19, 24, 29, 30, 31, 34, 40, 42]), 0.6, 5, false, RANKING_SHRINK.k)
    const p2 = rank(F, new Set([20, 23, 32, 33, 35, 36, 37, 38, 39, 43, 44]), 0.6, 5, false, RANKING_SHRINK.k)
    expect(p1.candidates[0]).toBe('V')
    expect(p2.candidates[0]).toBe('R')
    expect(p1.gap as number).toBeGreaterThan(0.17)
    expect(p2.gap as number).toBeGreaterThan(0.17)
  })
})

describe('M2409 tri-model 태그(존재가 갈린 22칸 블라인드 3차 판정 · human verified 아님)', () => {
  type Cell = { no: number; code: string; claude: { value: number }; codex: { value: number }; third: { value: number; q: string[]; why: string }; exists: boolean; final: number; taxonomy_ambiguous: boolean }
  const tri = pilot('M2409-review-tri.json') as { status: string; items: { no: number; w: Weights; claude: Weights; codex: Weights; cells: Cell[] }[] }
  const cells = tri.items.flatMap((i) => i.cells)
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[1]
  it('대상은 Claude · Codex 의 존재 판단이 갈린 칸 전부(22) · 출처 완전', () => {
    const disputed = tri.items.flatMap((i) => ATTRIBUTE_CODES.filter((c) => (i.claude[c] > 0) !== (i.codex[c] > 0)).map((c) => `${i.no}${c}`))
    expect(cells.map((c) => `${c.no}${c.code}`).sort()).toEqual(disputed.sort())
    expect(cells).toHaveLength(22)
    for (const c of cells) {
      expect(c.third.q).toHaveLength(3)
      expect(c.third.why.length).toBeGreaterThan(10)
      expect(typeof c.taxonomy_ambiguous).toBe('boolean')
    }
    expect(tri.status).toMatch(/human verified 아님/)
  })
  it('합성 규칙 재현 — 존재 = 3 중 2 이상 > 0 · 값 = 중앙값 · 최종 태그에 그대로 반영', () => {
    for (const c of cells) {
      const vals = [c.claude.value, c.codex.value, c.third.value]
      expect(c.exists).toBe(vals.filter((v) => v > 0).length >= 2)
      expect(c.final).toBe(c.exists ? med(vals) : 0)
      expect(tri.items.find((i) => i.no === c.no)!.w[c.code as AttributeCode]).toBe(c.final)
    }
  })
  it('정의 해석 칸(taxonomy_ambiguous)은 A6 · A9 뿐 — 다수결 값은 taxonomy 결정 근거가 아니다', () => {
    const amb = cells.filter((c) => c.taxonomy_ambiguous)
    expect(amb.length).toBe(10)
    expect(new Set(amb.map((c) => c.code))).toEqual(new Set(['A6', 'A9']))
  })
  it('A2 1 · A6 0 · A9 5 — 3차 판정 뒤에도 문장 이해(S) 축은 이 시험만으로 관찰하지 않는다', () => {
    const n = (c: AttributeCode) => tri.items.filter((i) => i.w[c] > 0).length
    expect([n('A2'), n('A6'), n('A9')]).toEqual([1, 0, 5])
  })
})
