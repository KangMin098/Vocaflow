// apps/web/src/lib/csat/map/v62/goal-schedule.ts
// Calendar projection of current TASK plans. Dates and budgets never promote evidence or invent later-stage quantities.
import { isHold } from '../v4/definition'
import type { StageKey } from '../v4/workspace'
import type { GoalPlanRow } from './goal-plan'
import type { GoalVersion } from './target-goal'
import { seoulToday } from './target-goal'
import type { ActivityRow } from '../lifecycle-evidence'
import type { GoalBudget } from './goal-budget'

const DAY = 86400000
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`)
const date = (t: number) => new Date(t).toISOString().slice(0, 10)
const monday = (t: number) => t - ((new Date(t).getUTCDay() + 6) % 7) * DAY

export interface ScheduledActivity {
  date: string
  task: string
  workspace: string | null
  stage: StageKey
  amount: number
  unit: '문항' | '지문'
  minutes: number
  /** Actual next link only; later slots do not promise a future item link. */
  action: GoalPlanRow['action']
  criterion: string | null
  evidence: GoalPlanRow['evidence']
  planGate: GoalPlanRow['planGate']
}
export type UnassignedReason = 'time' | 'content' | 'unmeasured' | 'relevance' | 'plan' | 'unknown' | 'maintenance' | 'deadline'
export interface UnassignedTask { task: string; amount: number | null; unit: '문항' | '지문'; reason: UnassignedReason }
export interface GoalSchedule {
  goalVersion: number | null
  status: 'missing_goal' | 'missing_budget' | 'expired' | 'ready'
  today: string
  deadline: string | null
  daysLeft: number | null
  allocations: ScheduledActivity[]
  unassigned: UnassignedTask[]
  weeks: { start: string; minutes: number; capacity: number; reserved: number }[]
  /** Only currently quantified stages. Subsequent learning depends on future independent evidence. */
  laterStagesUnknown: boolean
}

export interface BudgetUsage { date: string; minutes: number }
/** Reserve the learner's adjustable unit allocation for recorded attempts, including retries/help. This is not elapsed-time measurement or independent evidence. */
export function budgetUsage(budget: GoalBudget | null | undefined, activity: readonly ActivityRow[], now: string): BudgetUsage[] {
  if (!budget) return []
  const seen = new Set<string>()
  return activity.flatMap(a => {
    const at = a.receivedAt ?? a.answeredAt
    if (a.synthetic === true || !at || !Number.isFinite(Date.parse(at)) || Date.parse(at) > Date.parse(now)) return []
    const key = a.attemptId ?? [a.taskKey, a.itemRef, a.phase, at].join('|')
    if (seen.has(key)) return []
    seen.add(key)
    return [{ date: seoulToday(new Date(at)), minutes: budget.minutesPerUnit }]
  })
}

/** today is a validated Seoul calendar date supplied by the caller. Weekly/daily caps are never exceeded, even in a partial week. */
export function goalSchedule(goal: GoalVersion | null, rows: readonly GoalPlanRow[], today: string, usage: readonly BudgetUsage[] = []): GoalSchedule {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !Number.isFinite(ms(today)) || date(ms(today)) !== today) throw new Error('Invalid schedule date')
  const base: GoalSchedule = { goalVersion: goal?.id ?? null, status: 'missing_goal', today, deadline: goal?.date ?? null, daysLeft: goal?.date ? Math.round((ms(goal.date) - ms(today)) / DAY) : null, allocations: [], unassigned: [], weeks: [], laterStagesUnknown: false }
  if (!goal?.exam || !goal.date) return base
  if (!Number.isFinite(ms(goal.date)) || date(ms(goal.date)) !== goal.date) throw new Error('Invalid goal deadline')
  if (!goal.budget) return { ...base, status: 'missing_budget' }
  const { budget } = goal
  const expired = goal.date < today
  base.status = expired ? 'expired' : 'ready'
  // Hard bound rejects pathological input instead of silently hiding a tail of unallocated learning.
  if (base.daysLeft! > 3660) throw new Error('목표일은 10년 이내로 정해 주세요')
  const units = Math.floor(budget.weeklyMinutes / budget.minutesPerUnit)
  const daily = budget.dailyMinutes ?? Array.from({ length: 7 }, (_, i) => Math.min(1440, (Math.floor(units / 7) + (i < units % 7 ? 1 : 0)) * budget.minutesPerUnit))
  const slots: { date: string; left: number; week: string }[] = []
  const usedDay = new Map<string, number>(), usedWeek = new Map<string, number>()
  for (const u of usage) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(u.date) || !Number.isFinite(ms(u.date)) || u.date > today || !Number.isFinite(u.minutes) || u.minutes < 0) throw new Error('Invalid budget usage')
    usedDay.set(u.date, (usedDay.get(u.date) ?? 0) + u.minutes)
    const start = date(monday(ms(u.date)))
    usedWeek.set(start, (usedWeek.get(start) ?? 0) + u.minutes)
  }
  const weeks = new Map<string, { start: string; minutes: number; capacity: number; reserved: number }>()
  for (let t = ms(today); t <= ms(goal.date); t += DAY) {
    const day = (new Date(t).getUTCDay() + 6) % 7
    const start = date(monday(t))
    const w = weeks.get(start) ?? { start, minutes: 0, capacity: 0, reserved: usedWeek.get(start) ?? 0 }
    const cap = Math.max(0, Math.min(daily[day] - (usedDay.get(date(t)) ?? 0), budget.weeklyMinutes - w.reserved - w.capacity))
    w.capacity += cap
    weeks.set(start, w)
    slots.push({ date: date(t), left: cap, week: start })
  }
  const priority = (r: GoalPlanRow) => {
    const i = budget.priorities.indexOf(r.task)
    return i >= 0 ? i : budget.priorities.length + r.needRank
  }
  const sorted = [...rows].filter(r => !isHold(r.task)).sort((a, b) => priority(a) - priority(b) || a.needRank - b.needRank)
  const reject = (r: GoalPlanRow, reason: UnassignedReason, amount = r.quantity.remaining) => base.unassigned.push({ task: r.task, amount, unit: r.quantity.unit, reason })
  for (const r of sorted) {
    if (r.need === 'RELEVANCE_UNKNOWN') { reject(r, 'relevance', null); continue }
    if (r.quantity.source === 'unknown') { reject(r, 'unknown', null); continue }
    if (r.blocked === 'maintain_pending') { reject(r, 'maintenance', null); continue }
    if (r.quantity.remaining === null || !r.stage) { reject(r, r.evidence === 'unmeasurable' ? 'unmeasured' : 'content', null); continue }
    if (r.quantity.remaining <= 0) continue
    base.laterStagesUnknown = true
    // Quantities are meaningful only at a currently available, executable stage.
    if (r.planGate || !r.action || r.quantity.source !== 'saved') { reject(r, r.planGate ? 'plan' : 'content'); continue }
    let left = r.quantity.remaining
    for (const slot of slots) {
      const n = Math.min(left, Math.floor(slot.left / budget.minutesPerUnit))
      if (n <= 0) continue
      const minutes = n * budget.minutesPerUnit
      base.allocations.push({ date: slot.date, task: r.task, workspace: r.workspace, stage: r.stage, amount: n, unit: r.quantity.unit, minutes, action: r.action, criterion: r.criterion, evidence: r.evidence, planGate: null })
      slot.left -= minutes
      weeks.get(slot.week)!.minutes += minutes
      left -= n
      if (!left) break
    }
    if (left > 0) reject(r, expired ? 'deadline' : 'time', left)
  }
  base.weeks = [...weeks.values()]
  return base
}

export interface ScheduleChange { task: string; before: number; after: number; reason: 'goal' | 'budget' | 'evidence_or_content' }
/** Compare two projections explicitly; saved PLAN history remains append-only in its existing store. */
export function scheduleChanges(before: GoalSchedule, after: GoalSchedule, budgetChanged: boolean): ScheduleChange[] {
  const amounts = (s: GoalSchedule) => {
    const m = new Map<string, number>()
    for (const a of s.allocations) m.set(a.task, (m.get(a.task) ?? 0) + a.amount)
    return m
  }
  const a = amounts(before), b = amounts(after)
  return [...new Set([...a.keys(), ...b.keys()])].flatMap(task => a.get(task) === b.get(task) ? [] : [{ task, before: a.get(task) ?? 0, after: b.get(task) ?? 0, reason: before.goalVersion !== after.goalVersion ? 'goal' : budgetChanged ? 'budget' : 'evidence_or_content' }])
}
