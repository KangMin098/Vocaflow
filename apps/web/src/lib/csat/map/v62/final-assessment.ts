// apps/web/src/lib/csat/map/v62/final-assessment.ts
// Final goal attainment = the learner-declared final assessment bound to this goal version (goal exam kind on one date).
// Eligibility · exposure · grade reuse goalOutcome on the records up to that date — no second judgment ladder.
// Never inferred from exam kind or target date alone; a new goal version starts unbound. Not a learning-effect claim.
import type { TaskPlan } from '../v4/plan'
import { goalOutcome, type GoalOutcome, type OutcomeSession } from './goal-outcome'
import { seoulToday, type GoalVersion } from './target-goal'

export interface FinalAssessmentBinding { id: number; goalVersionId: number; date: string; createdAt: string }
export type FinalBindingRead = { status: 'not_installed' } | { status: 'error' } | { status: 'ok'; binding: FinalAssessmentBinding | null }

export type FinalStatus = 'not_installed' | 'read_error' | 'no_goal_exam' | 'unbound' | 'scheduled' | 'awaiting_record' | 'not_judgeable' | 'not_met' | 'met'
export interface FinalAttainment {
  status: FinalStatus
  binding: FinalAssessmentBinding | null
  /** Inclusive date window a binding may take (after the goal day, up to the goal date). */
  window: { min: string; max: string } | null
  /** goalOutcome over records up to the bound date; null before that date or without a record on it. */
  judged: GoalOutcome | null
}

const addDay = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

export function bindWindow(goal: GoalVersion): FinalAttainment['window'] {
  if (!goal.exam || !goal.date) return null
  const min = addDay(seoulToday(new Date(goal.createdAt)), 1)
  return min <= goal.date ? { min, max: goal.date } : null
}

/** Request body → binding input. The same window rules as the SQL writer. */
export function parseFinalBinding(body: unknown, goal: GoalVersion | null): { ok: true; date: string; goalVersionId: number } | { ok: false; error: string; code?: 'goal_changed' } {
  if (!body || typeof body !== 'object') return { ok: false, error: '본문이 없어요' }
  const b = body as Record<string, unknown>
  if (!goal) return { ok: false, error: '먼저 목표를 저장해 주세요' }
  if (b.goalVersionId !== goal.id) return { ok: false, error: '목표가 다른 화면에서 바뀌었어요 — 새로고침한 뒤 다시 확인해 주세요', code: 'goal_changed' }
  const w = bindWindow(goal)
  if (!w) return { ok: false, error: '목표 시험과 목표일(목표를 정한 다음 날 이후)이 있어야 최종 평가를 정할 수 있어요' }
  const d = b.date
  if (!(typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d)) return { ok: false, error: '응시일 형식이 맞지 않아요' }
  if (d < w.min || d > w.max) return { ok: false, error: `응시일은 ${w.min} ~ ${w.max} 사이여야 해요` }
  return { ok: true, date: d, goalVersionId: goal.id }
}

export function finalAttainment(goal: GoalVersion, read: FinalBindingRead, sessions: readonly OutcomeSession[], plans: readonly TaskPlan[], asOf: string): FinalAttainment {
  const window = bindWindow(goal)
  if (read.status === 'not_installed') return { status: 'not_installed', binding: null, window, judged: null }
  if (read.status === 'error') return { status: 'read_error', binding: null, window, judged: null }
  const binding = read.binding && read.binding.goalVersionId === goal.id ? read.binding : null
  if (!goal.exam || !goal.date) return { status: 'no_goal_exam', binding, window, judged: null }
  if (!binding) return { status: 'unbound', binding: null, window, judged: null }
  if (seoulToday(new Date(asOf)) < binding.date) return { status: 'scheduled', binding, window, judged: null }
  // Later records cannot stand in for the bound date; earlier ones stay visible for repeat/exposure checks.
  const upTo = sessions.filter(s => s.takenAt <= binding.date)
  const judged = goalOutcome(goal, upTo, plans, asOf)
  if (!judged.latest || judged.latest.takenAt !== binding.date || judged.latest.examScope !== goal.exam) return { status: 'awaiting_record', binding, window, judged: null }
  const status: FinalStatus = judged.verdict === 'met' ? 'met' : judged.verdict === 'below' ? 'not_met' : 'not_judgeable'
  return { status, binding, window, judged }
}

export const FINAL_STATUS_LABEL: Record<FinalStatus, string> = {
  not_installed: '최종 평가를 정하는 저장 구조가 아직 적용되지 않았어요 — 최종 목표 달성은 미확인이에요',
  read_error: '최종 평가 설정을 불러오지 못했어요 — 최종 목표 달성은 미확인이에요',
  no_goal_exam: '목표 시험과 목표일을 정하면 최종 평가를 정할 수 있어요',
  unbound: '어느 날의 시험을 최종 평가로 볼지 아직 정하지 않았어요 — 최종 목표 달성은 미확인이에요',
  scheduled: '최종 평가 응시일 전이에요',
  awaiting_record: '최종 평가 응시일의 목표 시험 기록이 아직 없어요',
  not_judgeable: '최종 평가 기록이 판정 조건을 충족하지 않아 최종 목표 달성은 미확인이에요',
  not_met: '최종 평가 기록이 목표 기준에 못 미쳤어요',
  met: '최종 평가 기록이 목표 기준을 충족했어요',
}
export const FINAL_MET_LIMIT = '정해 둔 최종 평가 한 번의 결과예요 — 학습 효과나 다른 시험의 결과를 보장하지 않아요'
