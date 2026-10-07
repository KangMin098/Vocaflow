// apps/web/src/lib/csat/map/axis-routing.ts
//
// 축 관측 특성 기반 routing(2026-10-08 · 사용자 지시) — 순위(ranking: 무엇이 의심되는가)와 행동(routing: 학생이 무엇을 하는가)을 나눈다.
//   ranking candidate → 축의 기출 관측 특성 → routing 결정 → 학생 행동 하나.
// 관측 특성은 observability-audit(평가원 29회 · docs/csat-learner/pilot-runs/observability-audit-20261008.md)에서 온 계약이다:
//   exam_observable  R · E — 기출에 단독 근거 문항이 있다 → RANKING_GATE 를 통과하면 그 단계로
//   exam_assisted    V · X — 신호는 보이지만 다른 축과 섞인다(V: 단독 문항 0 · X: 장문 5문항) → 단독 약점 추천 금지, 구분 확인으로
//   direct_diagnostic S    — 기출로 관측되지 않는 핵심 단계 → 순위 경쟁 밖 · 다른 행동이 없을 때 직접 확인
//   out_of_scope     L     — 문항 태그 없음(NO_DATA 정책)
// 순위 수식 · 태깅은 바꾸지 않는다. 학생 화면에는 이 낱말들을 내지 않는다.

import type { CoreCode, CoreSummary } from './core'

export type ExamEvidence = 'exam_observable' | 'exam_assisted' | 'direct_diagnostic' | 'out_of_scope'
export const AXIS_EXAM_EVIDENCE: Readonly<Record<CoreCode, ExamEvidence>> = {
  R: 'exam_observable',
  E: 'exam_observable',
  V: 'exam_assisted',
  X: 'exam_assisted',
  S: 'direct_diagnostic',
  L: 'out_of_scope',
}

export interface VOverlapIn { wrongV: number; R: number; E: number; X: number }

export type Routing =
  /** 그 축 단계 「먼저 확인」 — exam_observable 축이 안정적 1위(확신 provisional 은 그대로 전달) */
  | { kind: 'step'; axis: CoreCode; next: CoreCode | null; provisional: boolean }
  /** 두 축을 가르는 확인 하나 — 순위가 불안정하거나(RANKING_GATE) 1위가 exam_assisted 축 */
  | { kind: 'distinguish'; axis: CoreCode; rival: CoreCode; also: CoreCode | null; reason: 'unstable' | 'assisted_v' | 'assisted_x' }
  /** 기출로 관측되지 않는 핵심 축의 직접 확인 */
  | { kind: 'direct'; axis: CoreCode }
  | { kind: 'none' }

/**
 * V 를 무엇과 가를지 — 학생의 틀린 V 문항이 R · E 와 겹친 수(vOverlap)로 고른다. 같으면 R · E 둘 다(공통 구분 활동).
 * vOverlap 이 없으면(옛 스냅샷) 순위 추정값이 더 낮은(더 의심되는) 쪽 — 그것도 없으면 둘 다.
 */
export function vPartner(overlap: VOverlapIn | null | undefined, est: Partial<Record<CoreCode, number | null>>): { rival: CoreCode; also: CoreCode | null } {
  if (overlap && overlap.wrongV > 0 && overlap.R !== overlap.E) return overlap.R > overlap.E ? { rival: 'R', also: null } : { rival: 'E', also: null }
  if (!overlap || overlap.wrongV === 0) {
    const r = est.R ?? null
    const e = est.E ?? null
    if (r !== null && e !== null && r !== e) return r < e ? { rival: 'R', also: null } : { rival: 'E', also: null }
    if (r !== null && e === null) return { rival: 'R', also: null }
    if (e !== null && r === null) return { rival: 'E', also: null }
  }
  return { rival: 'R', also: 'E' }
}

/**
 * 행동 결정 — 우선순위(사용자 지시 §9): ① verified(아직 없음 — 지금은 전부 rule_proxy) ② exam_observable 안정 1위 ③ exam_assisted 구분 확인
 * ④ direct_diagnostic 직접 확인(다른 행동이 없고 그 축이 관측되지 않았을 때) ⑤ 없음(기록 · 추가 진단 안내는 learner-path 가 한다).
 */
export function routeAction(summary: Pick<CoreSummary, 'ranking' | 'candidates' | 'axes'>, overlap: VOverlapIn | null | undefined, opts: { analyzable: boolean; watch?: number }): Routing {
  const r = summary.ranking
  const est = Object.fromEntries(summary.axes.map((a) => [a.code, a.rankingEstimate])) as Partial<Record<CoreCode, number | null>>
  if (r.kind === 'unstable' && r.top && r.rival) return { kind: 'distinguish', axis: r.top, rival: r.rival, also: null, reason: 'unstable' }
  if (r.kind === 'clear' && r.top) {
    const ev = AXIS_EXAM_EVIDENCE[r.top]
    if (ev === 'exam_observable') {
      const next = summary.candidates.find((c) => c !== r.top) ?? null
      return { kind: 'step', axis: r.top, next, provisional: r.confidence === 'provisional' }
    }
    if (r.top === 'V') {
      const p = vPartner(overlap, est)
      return { kind: 'distinguish', axis: 'V', rival: p.rival, also: p.also, reason: 'assisted_v' }
    }
    if (r.top === 'X') {
      // 「내용 이해」 쪽 = 관찰값이 있는 다른 축 중 순위 추정이 가장 낮은 축
      const other = summary.axes
        .filter((a) => a.code !== 'X' && a.code !== 'L' && a.rankingEstimate !== null)
        .sort((a, b) => (a.rankingEstimate as number) - (b.rankingEstimate as number))[0]?.code ?? 'R'
      return { kind: 'distinguish', axis: 'X', rival: other, also: null, reason: 'assisted_x' }
    }
  }
  // 다른 행동이 없을 때 — 관측되지 않은 direct_diagnostic 축(S)
  const s = summary.axes.find((a) => a.code === 'S')
  // 관찰된 축이 하나도 없으면(기록이 얇다) 직접 확인보다 「기록 더」가 먼저다(learner-path 가 고른다).
  // 확인할 가치 — 관찰된 축 중 하나라도 「관찰 높음」 선(core.watch) 아래일 때만: 설명되지 않은 오답이 있다. 모두 높으면 S 를 띄우지 않는다
  // (모든 학생에게 S 진단부터 시키지 않는다 — 사용자 지시 2026-10-08 §7).
  const seen = summary.axes.filter((a) => a.code !== 'S' && a.code !== 'L' && a.observed !== null)
  const worth = seen.some((a) => (a.rankingEstimate ?? a.observed ?? 1) < (opts.watch ?? 0.8))
  if (opts.analyzable && seen.length > 0 && worth && s && s.observed === null) return { kind: 'direct', axis: 'S' }
  return { kind: 'none' }
}
