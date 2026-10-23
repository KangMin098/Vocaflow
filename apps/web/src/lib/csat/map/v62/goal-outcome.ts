// apps/web/src/lib/csat/map/v62/goal-outcome.ts
//
// GOAL-ACHIEVEMENT 3차 — 목표 설정 뒤 **새로 본 실제 시험 기록**으로 목표 대비 위치 · 변화를 판정한다(순수 · 시계 없음).
// 계약(LEARNING_MAP_EXAM_INPUT_CONTRACT §3 · GOAL_ACHIEVEMENT.md):
//   · 원점수 · 등급은 목표 시험과 같은 종류의 시험 기록과만 비교한다. 다른 시험이면 「직접 비교 불가」 — 동등화하지 않는다.
//   · 변화(이전 → 이후)는 같은 시험지(exam_id)끼리만. 다른 시험지면 차이를 만들지 않는다.
//   · 이미 본 시험지를 다시 푼 기록은 새 독립 평가가 아니다(반복 풀이 ≠ 새 근거). 입력 신뢰도를 통과하지 못한 기록도 판정에 쓰지 않는다.
//   · TASK 활동 결과(해소 · 남은 요구)는 목표 점수 판정과 다른 칸이다. 활동 완료로 목표 도달을 말하지 않는다.
//   · 점수 향상 예측 · 목표 달성 확률 · 숙달률을 만들지 않는다. 등급 ↔ 점수를 서로 환산하지 않는다.

import type { AsIsSession } from '../v4/as-is'
import type { TaskPlan } from '../v4/plan'
import type { GoalExam, GoalVersion } from './target-goal'

/** 시험 회차(csat_exams) → 목표 시험 종류. 목표 시험 범위(scopeCandidates)와 같은 규칙 */
export function examScopeOf(e: { organizer: string | null; kind: string | null; month: number | null }): GoalExam | null {
  if (e.organizer === 'kice' && e.kind === 'suneung') return 'suneung'
  if (e.organizer === 'kice' && e.kind === 'mock' && e.month === 6) return 'kice6'
  if (e.organizer === 'kice' && e.kind === 'mock' && e.month === 9) return 'kice9'
  if (e.organizer === 'edu_office') return 'hakpyeong'
  return null
}

export type OutcomeSession = Pick<AsIsSession, 'id' | 'examId' | 'examLabel' | 'takenAt' | 'raw' | 'grade' | 'diagnosable'> & { examScope: GoalExam | null }

export type ScoreStatus =
  | 'no_goal_exam'     // 목표 시험이 없어 어느 척도로 볼지 정할 수 없다
  | 'no_followup'      // 목표를 정한 뒤 본 시험 기록이 없다
  | 'unreliable'       // 뒤 기록이 있지만 입력 신뢰도를 통과하지 못했다
  | 'repeated_paper'   // 뒤 기록이 이미 본 시험지를 다시 푼 것뿐이다
  | 'different_exam'   // 뒤 기록이 목표 시험과 다른 종류다 — 직접 비교 불가
  | 'no_score'         // 기록에 원점수가 없다
  | 'below'
  | 'reached'

/** 학습자에게 보이는 네 상태 — 「충족」은 이번 평가 한 번의 사실이며 최종 목표 달성 · 교육 효과 입증이 아니다 */
export type OutcomeVerdict = 'no_record' | 'not_judgeable' | 'below' | 'met'

export type GradeStatus = 'no_target' | 'no_record_grade' | 'not_judged' | 'below' | 'reached'
export type ChangeStatus = 'no_baseline' | 'no_followup' | 'different_paper' | 'compared'
export type OutcomeNext = 'set_goal_exam' | 'take_followup_exam' | 'replan_new_exam' | 'maintain'

export interface GoalOutcome {
  goalVersion: number
  target: { score: number; grade: number | null; exam: GoalExam | null }
  /** 목표를 정할 때까지의 마지막 신뢰 기록 */
  baseline: OutcomeSession | null
  /** 목표를 정한 뒤의 마지막 판정 가능 기록(새 시험지 · 신뢰 통과) */
  followup: OutcomeSession | null
  score: { status: ScoreStatus; gap: number | null }
  verdict: OutcomeVerdict
  grade: { status: GradeStatus }
  change: { status: ChangeStatus; delta: number | null }
  /** TASK 활동 결과 — 목표 도달 근거가 아니다 */
  activity: { needs: number; resolved: number }
  next: OutcomeNext
}

const day = (iso: string) => iso.slice(0, 10)

export function goalOutcome(goal: GoalVersion, sessions: readonly OutcomeSession[], plans: readonly TaskPlan[]): GoalOutcome {
  const setDay = day(goal.createdAt)
  const byTime = [...sessions].sort((a, b) => a.takenAt.localeCompare(b.takenAt))
  const before = byTime.filter((s) => day(s.takenAt) <= setDay)
  const after = byTime.filter((s) => day(s.takenAt) > setDay)
  const baseline = [...before].reverse().find((s) => s.diagnosable) ?? null

  // 뒤 기록 중 판정 가능한 것 — 신뢰 통과 · 그 전에 본 적 없는 시험지
  const seen = new Set<string>()
  const fresh: OutcomeSession[] = []
  let repeated = false
  for (const s of byTime) {
    if (day(s.takenAt) > setDay && s.diagnosable) {
      if (seen.has(s.examId)) repeated = true
      else fresh.push(s)
    }
    seen.add(s.examId)
  }
  const followup = fresh.at(-1) ?? null

  let score: GoalOutcome['score']
  if (!goal.exam) score = { status: 'no_goal_exam', gap: null }
  else if (!followup) score = { status: after.length === 0 ? 'no_followup' : repeated ? 'repeated_paper' : 'unreliable', gap: null }
  else if (followup.examScope !== goal.exam) score = { status: 'different_exam', gap: null }
  else if (followup.raw === null) score = { status: 'no_score', gap: null }
  else score = { status: followup.raw >= goal.score ? 'reached' : 'below', gap: followup.raw - goal.score }

  // 등급 — 같은 종류 시험의 기록된 등급끼리만(점수에서 등급을 만들지 않는다 · 낮을수록 높은 등급)
  const comparable = score.status === 'below' || score.status === 'reached' || score.status === 'no_score'
  const grade: GoalOutcome['grade'] = goal.grade === null ? { status: 'no_target' }
    : !comparable || !followup ? { status: 'not_judged' }
    : followup.grade === null ? { status: 'no_record_grade' }
    : { status: followup.grade <= goal.grade ? 'reached' : 'below' }

  const change: GoalOutcome['change'] = !baseline ? { status: 'no_baseline', delta: null }
    : !followup ? { status: 'no_followup', delta: null }
    : baseline.examId !== followup.examId || baseline.raw === null || followup.raw === null ? { status: 'different_paper', delta: null }
    : { status: 'compared', delta: followup.raw - baseline.raw }

  const needs = plans.filter((p) => p.need !== null)
  const activity = { needs: needs.length, resolved: plans.filter((p) => p.achievement === 'resolved').length }

  const next: OutcomeNext = score.status === 'no_goal_exam' ? 'set_goal_exam'
    : score.status === 'reached' && grade.status !== 'below' ? 'maintain'
    : score.status === 'reached' ? 'replan_new_exam'
    : score.status === 'below' || score.status === 'no_score' ? 'replan_new_exam'
    : 'take_followup_exam'

  // 목표 등급을 정했으면 기록된 등급도 기준을 넘어야 「충족」(점수만으로 충족이라 하지 않는다)
  const verdict: OutcomeVerdict = score.status === 'no_followup' ? 'no_record'
    : score.status === 'below' || (score.status === 'reached' && grade.status === 'below') ? 'below'
    : score.status === 'reached' && (grade.status === 'reached' || grade.status === 'no_target') ? 'met'
    : 'not_judgeable'
  return { goalVersion: goal.id, target: { score: goal.score, grade: goal.grade, exam: goal.exam }, baseline, followup, score, verdict, grade, change, activity, next }
}

export const SCORE_STATUS_LABEL: Record<ScoreStatus, string> = {
  no_goal_exam: '목표 시험을 정하면 그 시험 기록으로 목표와 비교해요',
  no_followup: '목표를 정한 뒤 본 시험 기록이 아직 없어요 — 목표 대비 위치는 미확인이에요',
  unreliable: '목표를 정한 뒤 기록이 있지만 입력을 확인할 수 없어 판정하지 않았어요',
  repeated_paper: '이미 본 시험지를 다시 푼 기록은 새 평가로 보지 않아요 — 새 회차 기록이 필요해요',
  different_exam: '최근 기록이 목표 시험과 다른 종류라 직접 비교하지 않아요',
  no_score: '최근 기록에 원점수가 없어 비교하지 않았어요',
  below: '최근 목표 시험 기록이 목표 점수보다 낮아요',
  reached: '최근 목표 시험 기록이 목표 점수 이상이에요',
}

export const VERDICT_LABEL: Record<OutcomeVerdict, string> = {
  no_record: '평가 기록 없음',
  not_judgeable: '비교 · 판정 불가',
  below: '현재 평가에서 목표 기준 미달',
  met: '현재 평가에서 목표 기준 충족',
}
/** 「충족」 옆에 늘 붙는 한계 — 최종 목표 달성 확정과 교육 효과 입증은 별도 근거가 필요하다 */
export const MET_LIMIT = '이번 평가 한 번의 결과예요 — 최종 목표 달성이나 학습 효과가 입증된 것은 아니에요'

export const NEXT_LABEL: Record<OutcomeNext, string> = {
  set_goal_exam: '목표 시험 정하기',
  take_followup_exam: '새 회차 시험을 보고 기록하면 목표와 비교해요',
  replan_new_exam: '새 기록을 반영해 계획을 다시 확정해요',
  maintain: '지금 계획으로 유지 확인을 이어가요',
}
