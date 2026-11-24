// apps/web/src/lib/csat/map/v62/replan.ts
//
// GOAL-ACHIEVEMENT 재처방 — 새 독립 수행 · 시험 기록으로 지금 PLAN 이 저장 PLAN 과 달라졌을 때(goalPlanRows.planGate='replan'),
// 「저장 계획 그대로의 일정」과 「바뀐 단계 · 수량을 확정했을 때의 일정」을 같은 goalSchedule 로 투영해 scheduleChanges 로 비교한다(순수).
// 하지 않는 것: 저장 · 자동 확정(확정은 Workspace 계획 탭의 기존 명시적 확정 · 버전 보존 그대로) · 판정 변경 · 새 수량 생성.
// 수정안의 수량은 지금 PLAN 이 낸 값(가용 문항 기준)뿐이고, 시간 배분은 goalSchedule 의 같은 예산 규칙을 쓴다.

import type { StageKey } from '../v4/workspace'
import type { TaskPlan } from '../v4/plan'
import type { SavedPlans } from '../v4/plan-store'
import { REASON_LABEL, type PlanReason } from '../v4/plan-commit'
import type { GoalPlanRow } from './goal-plan'
import { goalSchedule, scheduleChanges, type BudgetUsage, type GoalSchedule, type ScheduleChange } from './goal-schedule'
import type { GoalVersion } from './target-goal'
import { sameBudget } from './goal-budget'

export type ReplanReason = PlanReason

export interface TaskShift {
  task: string
  workspace: string | null
  from: { stage: StageKey | null; planned: number | null }
  to: { stage: StageKey | null; remaining: number | null }
  evidence: GoalPlanRow['evidence']
}

export interface ReplanProposal {
  /** 다시 확정이 필요한 TASK 가 없다 */
  none: boolean
  /** 다시 확정이 필요하지만 일정 · 단계 · 수량이 실제로는 같다 */
  unchanged: boolean
  reasons: ReplanReason[]
  shifts: TaskShift[]
  changes: ScheduleChange[]
  before: GoalSchedule | null
  after: GoalSchedule | null
  /** 이번 주 배정 분(저장 계획 → 수정안) */
  /** 이번 주 배정 분 — current = 지금 실제 일정(재확정 전 TASK 는 배정되지 않는다) · before = 저장 계획대로 · after = 수정안 */
  thisWeek: { current: number; before: number; after: number } | null
  /** TASK 별 이번 주 배정 분(같은 세 열) — 다시 확정이 필요한 TASK 만 */
  weekRows: { task: string; current: number; before: number; after: number }[]
  /** 다음 주 우선 TASK(수정안 배정 순서) */
  nextWeek: string[]
  /** 수정안의 다음 확인 · 다시 확인 배정일 */
  nextCheck: string | null
  /** 확정하러 갈 Workspace(계획 탭) */
  workspaces: string[]
}

const asStage = (s: string | null | undefined): StageKey | null => (s === 'check' || s === 'repair' || s === 'transfer' || s === 'recheck' ? s : null)

export interface ReplanInput {
  goal: GoalVersion | null
  rows: readonly GoalPlanRow[]
  plans: readonly TaskPlan[]
  saved: SavedPlans | null
  today: string
  usage?: readonly BudgetUsage[]
  /** Classified once by goalLearning using the existing replanOf / planDrift contract. */
  revisions: readonly { workspace: string; reason: PlanReason | null; newExam: boolean }[]
  usageForGoal?: (goal: GoalVersion) => readonly BudgetUsage[]
}

/** 첫 주(오늘이 든 주) 안의 그 TASK 배정 분 */
function weekMinutes(s: GoalSchedule | null, task: string): number {
  const end = s?.weeks[1]?.start ?? null
  return (s?.allocations ?? []).filter((a) => a.task === task && (!end || a.date < end)).reduce((n, a) => n + a.minutes, 0)
}

export function replanProposal({ goal, rows, plans, saved, today, usage = [], revisions, usageForGoal }: ReplanInput): ReplanProposal {
  const gated = rows.filter((r) => r.planGate === 'replan' && r.workspace)
  const empty: ReplanProposal = { none: true, unchanged: false, reasons: [], shifts: [], changes: [], before: null, after: null, thisWeek: null, weekRows: [], nextWeek: [], nextCheck: null, workspaces: [] }
  if (!gated.length || !saved || saved.error || saved.status !== 'installed') return empty

  const next = new Map(plans.map((p) => [p.task, p.next]))
  // 수정안 투영에는 실행 링크가 필요하다 — 관문 때문에 비운 action 대신 지금 PLAN 의 실제 다음 활동(없으면 null 그대로 · 링크를 만들지 않는다)
  const actionOf = (r: GoalPlanRow): GoalPlanRow['action'] => r.action ?? (next.get(r.task) ? { rank: r.needRank, href: next.get(r.task)!.href, label: next.get(r.task)!.label } : null)
  const savedTask = (r: GoalPlanRow) => saved.byTemplate[r.workspace!]?.latest.plan.tasks.find((t) => t.task === r.task) ?? null

  const shifts: TaskShift[] = []
  const beforeRows: GoalPlanRow[] = []
  const afterRows: GoalPlanRow[] = []
  for (const r of rows) {
    if (r.planGate !== 'replan' || !r.workspace) { beforeRows.push(r); afterRows.push(r); continue }
    const st = savedTask(r)
    const fromStage = asStage(st?.stage)
    const fromPlanned = st?.planned ?? null
    // 저장 계획 그대로: 저장 단계 · 저장 계획량(같은 단계면 이미 한 만큼 뺀다)
    if (st && fromStage && fromPlanned !== null) {
      const remaining = fromStage === r.stage ? Math.max(0, fromPlanned - r.quantity.done) : fromPlanned
      // A previous stage must never borrow the current stage's executable URL.
      beforeRows.push({ ...r, stage: fromStage, planGate: null, action: null, quantity: { ...r.quantity, planned: fromPlanned, remaining, source: 'saved' } })
    }
    // 수정안: 지금 단계 · 지금 남은 양을 확정했다고 보고 투영(실제 확정은 Workspace)
    afterRows.push({ ...r, planGate: null, action: actionOf(r), quantity: { ...r.quantity, source: r.quantity.remaining === null ? r.quantity.source : 'saved' } })
    if (fromStage !== r.stage || fromPlanned !== r.quantity.planned) shifts.push({ task: r.task, workspace: r.workspace, from: { stage: fromStage, planned: fromPlanned }, to: { stage: r.stage, remaining: r.quantity.remaining }, evidence: r.evidence })
  }

  let before: GoalSchedule | null = null
  let after: GoalSchedule | null = null
  let current: GoalSchedule | null = null
  const savedIds = [...new Set(gated.map(r => saved.byTemplate[r.workspace!]?.latest.goalVersionId ?? null))]
  const beforeGoal = savedIds.length === 1 ? (goal?.id === savedIds[0] ? goal : saved.goalHistory?.find(g => g.id === savedIds[0]) ?? null) : null
  try {
    const oldUsageKnown = !usage.length || sameBudget(beforeGoal?.budget, goal?.budget) || !!usageForGoal
    before = beforeGoal && oldUsageKnown ? goalSchedule(beforeGoal, beforeRows, today, usageForGoal?.(beforeGoal) ?? usage, true) : null
    after = goalSchedule(goal, afterRows, today, usage)
    // 지금 실제 일정 — 입력 행 그대로(재확정 관문이 걸린 TASK 는 goalSchedule 이 배정하지 않는다)
    current = goalSchedule(goal, rows, today, usage)
  } catch {
    before = after = current = null // 목표일 · 사용량이 유효하지 않으면 일정 비교를 하지 않는다(단계 변화는 그대로 보인다)
  }
  const comparable = before?.status === 'ready' && after?.status === 'ready'
  const changes = comparable ? scheduleChanges(before!, after!, !sameBudget(beforeGoal?.budget, goal?.budget)) : []
  const reasons = new Set<ReplanReason>()
  for (const revision of revisions.filter(v => gated.some(r => r.workspace === v.workspace))) {
    if (revision.reason) reasons.add(revision.reason)
    if (revision.newExam) reasons.add('new_exam')
  }

  const week2 = after?.weeks[1]?.start ?? null
  const week3 = after?.weeks[2]?.start ?? null
  const nextWeek = after && week2 ? [...new Set(after.allocations.filter((a) => a.date >= week2 && (!week3 || a.date < week3)).map((a) => a.task))] : []
  const sameAllocation = comparable && before!.allocations.length === after!.allocations.length && before!.allocations.every((a, i) => {
    const b = after!.allocations[i]
    return a.task === b.task && a.stage === b.stage && a.date === b.date && a.amount === b.amount && a.minutes === b.minutes && a.unit === b.unit
  })
  return {
    none: false,
    unchanged: sameAllocation && sameBudget(beforeGoal?.budget, goal?.budget) && beforeGoal?.id === goal?.id && shifts.length === 0 && changes.length === 0,
    reasons: [...reasons],
    shifts,
    changes,
    before,
    after,
    thisWeek: comparable ? { current: current?.weeks[0]?.minutes ?? 0, before: before!.weeks[0]?.minutes ?? 0, after: after!.weeks[0]?.minutes ?? 0 } : null,
    weekRows: comparable ? [...new Set(gated.map((r) => r.task))].map((task) => ({ task, current: weekMinutes(current, task), before: weekMinutes(before, task), after: weekMinutes(after, task) })) : [],
    nextWeek,
    nextCheck: after?.allocations.find((a) => a.stage === 'check' || a.stage === 'recheck')?.date ?? null,
    workspaces: [...new Set(gated.map((r) => r.workspace!))],
  }
}

export const REPLAN_REASON_LABEL = REASON_LABEL
