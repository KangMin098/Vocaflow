// apps/web/src/lib/csat/map/v62/goal-budget.ts
// Scheduling inputs are user allocations, never predictions of learning time or score gain.
import { tasks, type TaskId } from '../v4/definition'

export interface GoalBudget {
  weeklyMinutes: number
  /** Monday through Sunday. null distributes the weekly cap evenly. */
  dailyMinutes: number[] | null
  minutesPerUnit: number
  priorities: TaskId[]
}

export const DEFAULT_UNIT_MINUTES = 10

export function goalBudgetSource(goal: { budget?: GoalBudget | null } | null, profileWeeklyMinutes: number | null) {
  if (goal?.budget) return { source: 'goal' as const, budget: goal.budget, weeklyMinutes: goal.budget.weeklyMinutes }
  if (profileWeeklyMinutes !== null && Number.isInteger(profileWeeklyMinutes) && profileWeeklyMinutes >= 0 && profileWeeklyMinutes <= 4800) return { source: 'profile' as const, budget: null, weeklyMinutes: profileWeeklyMinutes }
  return { source: 'none' as const, budget: null, weeklyMinutes: null }
}

export function parseGoalBudget(raw: unknown): { ok: true; budget: GoalBudget | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, budget: null }
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: '학습 시간 입력을 확인해 주세요' }
  const b = raw as Record<string, unknown>
  if (Object.keys(b).some(k => !['weeklyMinutes', 'dailyMinutes', 'minutesPerUnit', 'priorities'].includes(k))) return { ok: false, error: '알 수 없는 시간 예산 항목이에요' }
  if (!Number.isInteger(b.weeklyMinutes) || (b.weeklyMinutes as number) < 0 || (b.weeklyMinutes as number) > 10080) return { ok: false, error: '주간 학습 시간은 0~10080분 사이 정수예요' }
  const per = b.minutesPerUnit ?? DEFAULT_UNIT_MINUTES
  if (!Number.isInteger(per) || (per as number) < 1 || (per as number) > 240) return { ok: false, error: '문항·지문당 배분은 1~240분 사이 정수예요' }
  const daily = b.dailyMinutes ?? null
  if (daily !== null && (!Array.isArray(daily) || daily.length !== 7 || !daily.every(n => Number.isInteger(n) && n >= 0 && n <= 1440))) return { ok: false, error: '요일별 시간은 월~일 7개, 각각 0~1440분이에요' }
  if (daily && daily.reduce((s: number, n: number) => s + n, 0) > (b.weeklyMinutes as number)) return { ok: false, error: '요일별 시간의 합이 주간 예산을 넘어요' }
  const priorities = b.priorities ?? []
  const active = new Set(tasks().filter(t => t.status !== 'hold').map(t => t.id))
  if (!Array.isArray(priorities) || priorities.length > active.size || new Set(priorities).size !== priorities.length || priorities.some(t => !active.has(t))) return { ok: false, error: '우선 TASK는 보류되지 않은 항목을 중복 없이 골라 주세요' }
  return { ok: true, budget: { weeklyMinutes: b.weeklyMinutes as number, dailyMinutes: daily, minutesPerUnit: per as number, priorities } }
}

export function sameBudget(a: GoalBudget | null | undefined, b: GoalBudget | null | undefined): boolean {
  if (!a || !b) return !a && !b
  return a.weeklyMinutes === b.weeklyMinutes && a.minutesPerUnit === b.minutesPerUnit &&
    (a.dailyMinutes === null ? b.dailyMinutes === null : b.dailyMinutes !== null && a.dailyMinutes.every((n, i) => n === b.dailyMinutes![i])) &&
    a.priorities.length === b.priorities.length && a.priorities.every((t, i) => t === b.priorities[i])
}
