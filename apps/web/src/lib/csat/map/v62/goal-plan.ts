// apps/web/src/lib/csat/map/v62/goal-plan.ts
//
// T-0070 — 목표 → TASK 별 현재 근거 → 이번 단계 학습량 · 도달 조건 → 같은 Workspace 계획 · 활동을 한 줄씩 잇는 요약 행.
// 새 판정 · 새 순위를 만들지 않는다 — V4View(To-Be 요구 · As-Is 근거 · TaskPlan) · Ranks(NeedRank · ActionRank) · 저장 계획을 그대로 읽는다.
// 계획량은 PLAN 편집기와 같은 값: applySaved(Workspace 계획 보기, quantityBasis(최신 저장본)). 같은 단계로 저장된 행만 「저장한 계획」이다.
// 만들지 않는 숫자: 목표 점수까지 필요한 총 학습량 · 기간 · 점수 상승 · 숙달률(문항과 지문도 합산하지 않는다).

import type { V4View } from '../v4/compose'
import type { TaskId } from '../v4/definition'
import { applySaved } from '../v4/plan-commit'
import type { TaskPlan } from '../v4/plan'
import type { SavedPlans } from '../v4/plan-store'
import type { StageKey } from '../v4/workspace'
import type { NeedRankEntry, NotActionableReason, Ranks } from './rank'
import { quantityBasis } from './saved-plan'

export type QuantitySource =
  /** 같은 단계로 저장한 계획량 */
  | 'saved'
  /** 저장 전 — 지금 자료로 제안한 계획량 */
  | 'proposed'
  /** 계획할 수 있는 자료가 없다(null) — 이유는 unresolved */
  | 'none'
  /** 저장 계획을 읽지 못했다 — 제안값으로 대신하지 않는다 */
  | 'unknown'

export interface GoalPlanRow {
  task: TaskId
  /** NeedRank(교육적으로 먼저 볼 순서) */
  needRank: number
  need: NeedRankEntry['need']
  /** As-Is 근거 상태 그대로 */
  evidence: NeedRankEntry['evidence']
  /** 직접 확인 근거인가(시험 기록 관찰 · 연습 · 자기 평가는 아니다) */
  basis: TaskPlan['basis'] | null
  /** 판정에 쓴 유효 독립 첫 시도 문항 수(직접 확인 과제가 있을 때만) */
  independentItems: number | null
  /** 목표 관련도 — 사실(문항 수 · 배점)만. 관련성 미확인이면 null */
  relevance: { items: number; pointsPerExam: number } | null
  stage: StageKey | null
  /** 이 TASK 를 계획하는 Workspace(중심 우선) — 없으면 null */
  workspace: string | null
  quantity: { unit: '문항' | '지문'; planned: number | null; done: number; remaining: number | null; source: QuantitySource }
  /** 도달 조건(코드북 learner_criterion) — 목표 점수 달성이 아니다 */
  criterion: string | null
  achievement: TaskPlan['achievement'] | null
  /** ActionRank — 지금 실제로 할 수 있으면 실행 순서 · 링크 */
  action: { rank: number; href: string; label: string } | null
  /** 지금 못 하는 이유(학생 결손이 아니라 자료 · 단계 상태) */
  blocked: NotActionableReason | null
  /** 계획량이 없는 이유(needs_direct_check 제외) */
  unresolved: TaskPlan['unresolved']
}

export interface GoalPlanSummaryData {
  rows: GoalPlanRow[]
  /** 기록한 시험 수 · 직접 확인 근거가 있는 TASK 수 — 「시험 기록 없음」과 「TASK 근거 없음」을 나눠 보인다 */
  examSessions: number
  directTasks: number
  actionable: number
}

function homePlan(view: V4View, task: TaskId) {
  const all = Object.values(view.plans)
  return all.find((pv) => pv.core.includes(task)) ?? all.find((pv) => pv.tasks.some((t) => t.task === task)) ?? null
}

export function goalPlanRows(view: V4View, ranks: Ranks | null, saved: SavedPlans | null | undefined): GoalPlanSummaryData {
  const plans = new Map(view.taskPlans.map((p) => [p.task, p]))
  const actions = new Map((ranks?.actionRank ?? []).map((a) => [a.task, a]))
  const blocked = new Map((ranks?.notActionable ?? []).map((b) => [b.task, b.reason]))
  const needs = new Map((view.toBe?.needs ?? []).map((n) => [n.task, n]))
  const store = saved?.status === 'installed' ? saved : null
  const rows = (ranks?.needRank ?? []).map((e): GoalPlanRow => {
    const p = plans.get(e.task) ?? null
    const pv = homePlan(view, e.task)
    const latest = store && !store.error && pv ? store.byTemplate[pv.workspace]?.latest ?? null : null
    const shown = pv ? (latest ? applySaved(pv, quantityBasis(latest)) : pv).tasks.find((t) => t.task === e.task) ?? p : p
    const q = shown?.quantity ?? null
    const sameStageSaved = !!latest && !!shown && latest.plan.tasks.some((t) => t.task === e.task && t.stage === shown.stage && t.planned !== null)
    const source: QuantitySource = store?.error ? 'unknown' : !q || q.planned === null ? 'none' : sameStageSaved ? 'saved' : 'proposed'
    const a = actions.get(e.task)
    const t = view.asIs.tasks[e.task]
    return {
      task: e.task,
      needRank: e.rank,
      need: e.need,
      evidence: e.evidence,
      basis: t?.basis ?? null,
      independentItems: t?.check ? t.check.independentItems : null,
      relevance: needs.get(e.task)?.relevance ?? null,
      stage: shown?.stage ?? null,
      workspace: pv?.workspace ?? null,
      quantity: { unit: q?.unit ?? '문항', planned: source === 'unknown' ? null : q?.planned ?? null, done: q?.done ?? 0, remaining: source === 'unknown' ? null : q?.remaining ?? null, source },
      criterion: shown?.criterion ?? null,
      achievement: shown?.achievement ?? null,
      action: a ? { rank: a.rank, href: a.href, label: a.label } : null,
      blocked: a ? null : blocked.get(e.task) ?? null,
      unresolved: (shown?.unresolved ?? []).filter((u) => u !== 'needs_direct_check'),
    }
  })
  return {
    rows,
    examSessions: view.asIs.sessions.length,
    directTasks: Object.values(view.asIs.tasks).filter((t) => t?.basis === 'direct_check').length,
    actionable: rows.filter((r) => r.action).length,
  }
}
