// apps/web/src/lib/csat/map/v62/target-spec.ts
//
// v6.2 §6.1 TargetSpec — 목표의 **논리 계약**. 지금 DB(csat_map_goal_version · target_score NOT NULL)는 점수만 저장한다.
// 그래서 점수 외 필드(등급 · 회차 · 형 · 목표일 · 시간 예산 · 개인 초점)는 받더라도 persisted=false 로 표시하고
// 화면은 그 값을 「저장된 목표」로 보이지 않는다(v6.2 §6.1 · §9.2). 저장 확장은 DB 감사 · 승인 뒤(D-12).
// 순수 함수 — 기존 ToBeGoal{score,set} 을 그대로 입력으로 받는다(호환).

import { CANON_VERSION } from '../v4/definition'
import type { ToBeGoal } from '../v4/to-be'

export type ExamKind = 'csat' | 'mock_kice' | 'mock_office'

export interface TargetSpec {
  /** 목표 시험 범위 — 저장 미지원(현재 기준 시험은 서버 설정 reference_exams 가 정한다) */
  examScope: { kinds: ExamKind[]; persisted: false } | null
  /** 목표 원점수 — 지금 저장되는 유일한 필드 */
  score: { value: number; persisted: true } | null
  grade: { value: number; persisted: false } | null
  targetDate: { value: string; persisted: false } | null
  personalFocus: { tasks: string[]; persisted: false } | null
  timeBudget: { minutesPerWeek: number; persisted: false } | null
  definitionVersion: string
  /** 저장된 목표 버전(csat_map_goal_version 의 버전) — 없으면 null(목표 미설정 또는 버전 이력 이전) */
  goalVersion: number | null
}

export interface TargetSpecDraft {
  grade?: number
  targetDate?: string
  examKinds?: ExamKind[]
  personalFocus?: string[]
  minutesPerWeek?: number
}

/** 기존 점수-only 목표 → TargetSpec. 목표가 정해지지 않았으면 score=null(기본값을 목표로 쓰지 않는다) */
export function targetSpecOf(goal: ToBeGoal | null, goalVersion: number | null, draft: TargetSpecDraft = {}): TargetSpec {
  const score = goal && goal.set && Number.isInteger(goal.score) && goal.score >= 0 && goal.score <= 100 ? { value: goal.score, persisted: true as const } : null
  return {
    examScope: draft.examKinds?.length ? { kinds: [...draft.examKinds], persisted: false } : null,
    score,
    grade: draft.grade !== undefined && Number.isInteger(draft.grade) && draft.grade >= 1 && draft.grade <= 9 ? { value: draft.grade, persisted: false } : null,
    targetDate: draft.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(draft.targetDate) ? { value: draft.targetDate, persisted: false } : null,
    personalFocus: draft.personalFocus?.length ? { tasks: [...draft.personalFocus], persisted: false } : null,
    timeBudget: draft.minutesPerWeek !== undefined && draft.minutesPerWeek > 0 ? { minutesPerWeek: draft.minutesPerWeek, persisted: false } : null,
    definitionVersion: CANON_VERSION,
    goalVersion: score ? goalVersion : null,
  }
}

/** 화면이 「저장된 목표」로 보여도 되는 필드만 */
export function savedTargetFields(spec: TargetSpec): ('score')[] {
  return spec.score?.persisted ? ['score'] : []
}

/** 저장되지 않는(보여 주면 안 되는) 필드 — 화면 · API 가 저장된 것처럼 다루면 안 된다 */
export function unsavedTargetFields(spec: TargetSpec): string[] {
  const out: string[] = []
  if (spec.examScope) out.push('examScope')
  if (spec.grade) out.push('grade')
  if (spec.targetDate) out.push('targetDate')
  if (spec.personalFocus) out.push('personalFocus')
  if (spec.timeBudget) out.push('timeBudget')
  return out
}
