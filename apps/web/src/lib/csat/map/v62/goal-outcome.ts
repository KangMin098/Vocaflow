// apps/web/src/lib/csat/map/v62/goal-outcome.ts
// Observed exam criteria, independent eligibility, descriptive repeats and final attainment are separate decisions.
import type { AsIsSession } from '../v4/as-is'
import type { TaskPlan } from '../v4/plan'
import { seoulToday, type GoalExam, type GoalVersion } from './target-goal'

export function examScopeOf(e: { organizer: string | null; kind: string | null; month: number | null }): GoalExam | null {
  if (e.organizer === 'kice' && e.kind === 'suneung') return 'suneung'
  if (e.organizer === 'kice' && e.kind === 'mock' && e.month === 6) return 'kice6'
  if (e.organizer === 'kice' && e.kind === 'mock' && e.month === 9) return 'kice9'
  return e.organizer === 'edu_office' ? 'hakpyeong' : null
}

export type OutcomeSession = Pick<AsIsSession, 'id' | 'examId' | 'examLabel' | 'takenAt' | 'raw' | 'grade' | 'diagnosable'> & {
  examScope: GoalExam | null
  enteredAt?: string
  examReady?: boolean
  mode?: 'live' | 'retake' | 'app' | 'diagnostic' | null
  firstExposure?: 'unseen' | 'exposed' | 'unknown'
}
export type ScoreStatus = 'no_goal_exam' | 'no_followup' | 'unreliable' | 'repeated_paper' | 'different_exam' | 'no_score' | 'timing_unknown' | 'exposure_unknown' | 'mode_unknown' | 'not_live' | 'below' | 'reached'
export type GradeStatus = 'no_target' | 'no_record_grade' | 'not_judged' | 'below' | 'reached'
export type ChangeStatus = 'no_baseline' | 'no_followup' | 'different_paper' | 'repeat_observation'
export type OutcomeNext = 'set_goal_exam' | 'take_followup_exam' | 'replan_new_exam' | 'review_goal_evidence'
export interface GoalOutcome {
  goalVersion: number
  target: { score: number; grade: number | null; exam: GoalExam | null }
  baseline: OutcomeSession | null
  /** Latest in-scope recorded result, including an explicitly ineligible record. */
  latest: OutcomeSession | null
  followup: OutcomeSession | null
  score: { status: ScoreStatus; gap: number | null }
  grade: { status: GradeStatus }
  change: { status: ChangeStatus; delta: number | null; before: OutcomeSession | null; after: OutcomeSession | null }
  attainment: { status: 'unconfirmed'; reason: 'target_assessment_not_bound' }
  activity: { needs: number; resolved: number }
  next: OutcomeNext
}
const validScore = (s: OutcomeSession) => Number.isInteger(s.raw) && s.raw! >= 0 && s.raw! <= 100
const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d
const ordered = (sessions: readonly OutcomeSession[], asOf: string) => sessions.filter(s => validDate(s.takenAt) && s.takenAt <= seoulToday(new Date(asOf)) && !!s.enteredAt && Number.isFinite(Date.parse(s.enteredAt)) && Date.parse(s.enteredAt) <= Date.parse(asOf)).sort((a, b) => a.takenAt.localeCompare(b.takenAt) || a.enteredAt!.localeCompare(b.enteredAt!) || a.id.localeCompare(b.id))

/** Shared selection policy for the temporal exposure reader and the outcome projection. A different exam cannot hide the latest in-scope record. */
export function outcomeCandidateOf(goal: GoalVersion, sessions: readonly OutcomeSession[], asOf: string): OutcomeSession | null {
  const goalDay = seoulToday(new Date(goal.createdAt))
  const after = ordered(sessions, asOf).filter(s => s.takenAt >= goalDay)
  return after.filter(s => s.examScope === goal.exam).at(-1) ?? after.at(-1) ?? null
}

export function goalOutcome(goal: GoalVersion, sessions: readonly OutcomeSession[], plans: readonly TaskPlan[], asOf: string): GoalOutcome {
  const goalDay = seoulToday(new Date(goal.createdAt))
  const all = ordered(sessions, asOf)
  const before = all.filter(s => s.takenAt < goalDay && s.examScope === goal.exam && (s.mode === 'live' || s.mode === 'retake') && s.diagnosable && s.examReady === true && validScore(s))
  const baseline = before.at(-1) ?? null
  const latest = outcomeCandidateOf(goal, all, asOf)
  const repeated = !!latest && all.some(s => s.id !== latest.id && s.examId === latest.examId && (s.takenAt < latest.takenAt || s.takenAt === latest.takenAt && s.enteredAt! <= latest.enteredAt!))
  let status: ScoreStatus
  if (!goal.exam) status = 'no_goal_exam'
  else if (!latest) status = 'no_followup'
  else if (latest.takenAt === goalDay) status = 'timing_unknown'
  else if (latest.examScope !== goal.exam) status = 'different_exam'
  else if (!latest.diagnosable || latest.examReady !== true) status = 'unreliable'
  else if (latest.mode === 'retake' || repeated || latest.firstExposure === 'exposed') status = 'repeated_paper'
  else if (latest.mode === 'app' || latest.mode === 'diagnostic') status = 'not_live'
  else if (latest.mode !== 'live') status = 'mode_unknown'
  else if (latest.firstExposure !== 'unseen') status = 'exposure_unknown'
  else if (!validScore(latest)) status = 'no_score'
  else status = latest.raw! >= goal.score ? 'reached' : 'below'
  const eligible = status === 'reached' || status === 'below' || status === 'no_score'
  const followup = eligible ? latest : null
  const grade: GoalOutcome['grade'] = goal.grade === null ? { status: 'no_target' }
    : !followup ? { status: 'not_judged' }
    : !Number.isInteger(followup.grade) || followup.grade! < 1 || followup.grade! > 9 ? { status: 'no_record_grade' }
    : { status: followup.grade! <= goal.grade ? 'reached' : 'below' }
  // Retakes have descriptive raw results; never independent improvement or a causal effect estimate.
  const observed = latest && (latest.mode === 'live' || latest.mode === 'retake') && latest.takenAt > goalDay && latest.examScope === goal.exam && latest.diagnosable && latest.examReady === true && validScore(latest) ? latest : null
  const samePaper = observed ? before.filter(s => s.examId === observed.examId).at(-1) ?? null : null
  const change: GoalOutcome['change'] = !baseline ? { status: 'no_baseline', delta: null, before: null, after: observed }
    : !observed ? { status: 'no_followup', delta: null, before: baseline, after: null }
    : !samePaper ? { status: 'different_paper', delta: null, before: baseline, after: observed }
    : { status: 'repeat_observation', delta: observed.raw! - samePaper.raw!, before: samePaper, after: observed }
  const unique = [...new Map(plans.map(p => [p.task, p])).values()].filter(p => p.need !== null)
  const next: OutcomeNext = status === 'no_goal_exam' ? 'set_goal_exam'
    : status === 'below' || status === 'no_score' || (status === 'reached' && grade.status === 'below') ? 'replan_new_exam'
    : status === 'reached' ? 'review_goal_evidence' : 'take_followup_exam'
  return { goalVersion: goal.id, target: { score: goal.score, grade: goal.grade, exam: goal.exam }, baseline, latest, followup,
    score: { status, gap: (status === 'reached' || status === 'below') ? latest!.raw! - goal.score : null }, grade, change,
    attainment: { status: 'unconfirmed', reason: 'target_assessment_not_bound' }, activity: { needs: unique.length, resolved: unique.filter(p => p.achievement === 'resolved').length }, next }
}

export const SCORE_STATUS_LABEL: Record<ScoreStatus, string> = {
  no_goal_exam: '목표 시험을 정하면 해당 종류의 시험 기록을 확인해요',
  no_followup: '목표를 정한 뒤의 유효한 후속 시험 기록이 아직 없어요 — 미확인이에요',
  unreliable: '시험 분석 적격성 또는 입력 신뢰도를 확인하지 못해 미확인이에요',
  repeated_paper: '재풀이·기존 문항 노출은 새 독립 평가로 보지 않아요',
  different_exam: '기록이 목표 시험과 다른 종류라 목표 기준을 판정하지 않아요',
  timing_unknown: '목표를 정한 날의 기록은 선후 시각을 알 수 없어 후속 평가로 판정하지 않아요',
  exposure_unknown: '기존 문항·지문 노출 이력을 충분히 확인하지 못해 미확인이에요',
  mode_unknown: '응시 모드를 확인하지 못해 미확인이에요',
  not_live: '앱 연습·진단 모드의 기록은 실제 시험 응시 결과로 판정하지 않아요',
  no_score: '기록에 유효한 원점수가 없어 점수 기준은 미확인이에요',
  below: '이 시험 기록의 점수가 설정한 목표 점수 기준보다 낮아요',
  reached: '이 시험 기록은 설정한 목표 점수 기준을 충족했어요. 최종 목표 달성 판정은 아니에요',
}
export const NEXT_LABEL: Record<OutcomeNext, string> = {
  set_goal_exam: '목표 시험 정하기', take_followup_exam: '미노출 새 회차의 응시 조건과 기록을 확인해요',
  replan_new_exam: '새 기록과 직접 TASK 근거를 확인하고 계획 수정안을 검토해요',
  review_goal_evidence: '최종 평가 대상·시점·조건과 필요한 후속 근거를 확인해요',
}
