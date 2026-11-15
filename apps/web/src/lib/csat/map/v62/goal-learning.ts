// apps/web/src/lib/csat/map/v62/goal-learning.ts
// Single projection joining goal/PLAN versions, existing diagnosis, calendar and exam outcomes. Writes/confirmations remain in the existing PLAN API.
import type { ActivityRow } from '../lifecycle-evidence'
import type { TaskPlan, WorkspacePlanView } from '../v4/plan'
import { planDrift, type PlanReason } from '../v4/plan-commit'
import type { SavedPlans } from '../v4/plan-store'
import { replanOf, type ReplanChange } from '../v4/replan'
import type { AsIsSession } from '../v4/as-is'
import { STAGE_LABEL, type StageKey } from '../v4/workspace'
import { goalBudgetSource, sameBudget } from './goal-budget'
import { finalAttainment, type FinalAttainment, type FinalBindingRead } from './final-assessment'
import { goalOutcome, type GoalOutcome } from './goal-outcome'
import type { GoalPlanSummaryData } from './goal-plan'
import { budgetUsage, goalSchedule, scheduleChanges, type GoalSchedule, type ScheduleChange } from './goal-schedule'
import { seoulToday, type GoalVersion } from './target-goal'
import { replanProposal, type ReplanProposal } from './replan'

export interface GoalLearning {
  goal: GoalVersion | null
  summary: GoalPlanSummaryData
  saved: SavedPlans | null
  asOf: string
  budget: ReturnType<typeof goalBudgetSource>
  schedule: GoalSchedule | null
  outcome: GoalOutcome | null
  /** Final goal attainment against the learner-declared final assessment of this goal version. */
  final: FinalAttainment | null
  replan: ReplanProposal
  /** Current browser projection comparison; not a persisted calendar history. */
  allocationChanges: ScheduleChange[] | null
  nextReview: string | null
  revisions: { workspace: string; fromVersion: number | null; goalVersion: number | null; reason: PlanReason | null; changes: ReplanChange[]; contentChanged: boolean; newExam: boolean }[]
}

export function goalLearning(input: {
  summary: GoalPlanSummaryData; saved: SavedPlans | null; plans: Record<string, WorkspacePlanView>; taskPlans: readonly TaskPlan[]; sessions: readonly AsIsSession[];
  activity: readonly ActivityRow[]; asOf: string; profileWeeklyMinutes?: number | null; previous?: GoalLearning | null; finalAssessment?: FinalBindingRead
}): GoalLearning {
  const { summary, saved, plans, taskPlans, sessions, activity, asOf, previous } = input
  const goal = saved?.error ? null : saved?.goal ?? null
  const budget = goalBudgetSource(goal, input.profileWeeklyMinutes ?? null)
  const today = seoulToday(new Date(asOf))
  const usage = budgetUsage(goal?.budget, activity, asOf)
  const schedule = goal ? goalSchedule(goal, summary.rows, today, usage) : null
  const outcomeSessions = sessions.map(s => ({ ...s, examScope: s.examScope ?? null }))
  const outcome = goal ? goalOutcome(goal, outcomeSessions, taskPlans, asOf) : null
  // An older response without the reader is treated as not installed — never as an unbound or judged final assessment.
  const final = goal ? finalAttainment(goal, input.finalAssessment ?? { status: 'not_installed' }, outcomeSessions, taskPlans, asOf) : null
  const revisions = Object.values(plans).filter(p => !saved?.error && (p.core.some(t => summary.rows.some(r => r.task === t)) || !!saved?.byTemplate[p.workspace])).map(p => {
    const old = saved?.byTemplate[p.workspace]?.latest ?? null
    const oldTasks = (old?.plan.tasks ?? []).flatMap(t => t.stage && Object.prototype.hasOwnProperty.call(STAGE_LABEL, t.stage) ? [{ task: t.task, stage: t.stage as StageKey }] : [])
    const replan = replanOf({ tasks: oldTasks, goalVersion: old?.goalVersionId ?? null }, p.tasks, goal?.id ?? null)
    const drift = planDrift(old, p)
    const contentChanged = !!drift && (!!drift.content.length || !!drift.overAvailable.length)
    const newExam = !!outcome?.followup?.enteredAt && !!old && Date.parse(outcome.followup.enteredAt) > Date.parse(old.createdAt)
    const reason: PlanReason | null = !old ? 'initial' : replan.reason ?? (drift?.definition ? 'definition_change' : contentChanged ? 'content_change' : newExam ? 'new_exam' : null)
    return { workspace: p.workspace, fromVersion: old?.version ?? null, goalVersion: goal?.id ?? null, reason, changes: replan.changes, contentChanged, newExam }
  })
  const replan = replanProposal({ goal, rows: summary.rows, plans: taskPlans, saved, today, usage, revisions, usageForGoal: g => budgetUsage(g.budget, activity, asOf) })
  const allocationChanges = previous?.schedule && schedule ? scheduleChanges(previous.schedule, schedule, !sameBudget(previous.goal?.budget, goal?.budget)) : null
  const weekEnd = schedule?.weeks[0] ? new Date(Date.parse(`${schedule.weeks[0].start}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10) : null
  const checkDate = schedule?.allocations.find(a => a.stage === 'check' || a.stage === 'recheck')?.date ?? null
  const dates = [weekEnd, goal?.date ?? null, checkDate].filter((d): d is string => !!d && d >= today).sort()
  return { goal, summary, saved, asOf, budget, schedule, outcome, final, replan, allocationChanges, nextReview: dates[0] ?? null, revisions }
}
