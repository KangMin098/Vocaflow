// apps/web/src/lib/csat/map/v62/target-goal.ts
//
// LM-G1.3a — 저장된 목표(csat_map_goal_version)의 점수 · 시험 · 등급 · 목표일을 **저장 · 계산 · 표시**에 같은 값으로 묶는다(순수).
// DB 계약(2026-10-16 읽기 전용 감사): target_score NOT NULL(0–100) · target_grade 1–9 · target_exam ∈ {suneung, kice6, kice9, hakpyeong} · target_date date
//   · csat_map_goal_set(p_user, p_score, p_grade, p_exam, p_date, p_client_key) 가 최신 표 + 이력을 한 트랜잭션에(사용자 잠금 · 요청키 멱등).
//   RPC 는 같은 요청키의 **다른 본문**을 막지 않는다 → 사전 및 저장 후 불변 행 비교로 라우트가 409 를 낸다(SQL 변경 없음).
// 계산에 쓰는 필드: 점수(기존 toBeMap) · 시험(기준 시험 후보 범위). 등급 · 목표일은 저장 · 표시만 — 등급 규칙 · 날짜 기반 학습량을 만들지 않는다.
// 점수 ↔ 등급을 서로 바꿔 채우지 않는다. 점수에서 계산한 등급은 「참고 구간」으로만 따로 말한다.

import type { ExamCandidate } from '../target'

export type GoalExam = 'suneung' | 'kice6' | 'kice9' | 'hakpyeong'
export const GOAL_EXAMS: readonly GoalExam[] = ['suneung', 'kice6', 'kice9', 'hakpyeong']
export const GOAL_EXAM_LABEL: Record<GoalExam, string> = { suneung: '수능', kice6: '6월 모의평가', kice9: '9월 모의평가', hakpyeong: '교육청 학력평가' }

/** 저장된 목표 한 버전(이력 행 그대로) */
export interface GoalVersion {
  id: number
  score: number
  grade: number | null
  exam: GoalExam | null
  date: string | null
  createdAt: string
}

export interface GoalInput {
  score: number
  grade: number | null
  exam: GoalExam | null
  date: string | null
}

/** 요청 본문 → 목표(검증). 점수는 필수(DB NOT NULL — 등급만인 목표는 LM-G1.3b). 모르는 값은 거절(조용히 null 로 바꾸지 않는다) */
export function parseGoalInput(body: unknown, today: string, allowPastReplay = false): { ok: true; goal: GoalInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: '본문이 없어요' }
  const b = body as Record<string, unknown>
  if (!Number.isInteger(b.target) || (b.target as number) < 0 || (b.target as number) > 100) return { ok: false, error: '목표 점수는 0~100 사이 정수예요' }
  const grade = b.grade === undefined || b.grade === null ? null : b.grade
  if (grade !== null && !(Number.isInteger(grade) && (grade as number) >= 1 && (grade as number) <= 9)) return { ok: false, error: '목표 등급은 1~9 등급이에요' }
  const exam = b.exam === undefined || b.exam === null ? null : b.exam
  if (exam !== null && !(GOAL_EXAMS as readonly unknown[]).includes(exam)) return { ok: false, error: '목표 시험을 다시 골라 주세요' }
  const date = b.date === undefined || b.date === null || b.date === '' ? null : b.date
  if (date !== null && !(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date)) return { ok: false, error: '목표일 형식이 맞지 않아요' }
  if (!allowPastReplay && date !== null && date < today) return { ok: false, error: '목표일은 오늘이나 그 뒤여야 해요' }
  return { ok: true, goal: { score: b.target as number, grade: grade as number | null, exam: exam as GoalExam | null, date: date as string | null } }
}

/** Calendar date policy is Asia/Seoul, independent of server/browser timezone. */
export function seoulToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** 같은 요청키로 다시 온 본문이 처음 저장과 같은가(멱등 재전송) — 다르면 409 */
export function sameGoal(a: GoalInput, b: Pick<GoalVersion, 'score' | 'grade' | 'exam' | 'date'>): boolean {
  return a.score === b.score && a.grade === b.grade && a.exam === b.exam && a.date === b.date
}

/**
 * 목표 시험 → 기준 시험 후보 범위. 평가원은 기존 정답표 적격 규칙과 관측/미관측 오답률 계산(splitMust)을 유지한다. 교육청은 일부 오답률만으로 지원하지 않는다.
 *   미지정(null) — 기존 기본(평가원 전체 · 최근 N회) 그대로(점수-only 호환)
 *   suneung — 평가원 kind=suneung(시행 월과 분리). kice6 · kice9 — kind=mock · 해당 월.
 *   hakpyeong — 교육청 학평. 지금 오답률 관측 0 · 검수 보류라 계산 미지원 → 평가원으로 대신하지 않고 unsupported
 */
export interface ScopeCandidate extends ExamCandidate { organizer: string; kind: string; month: number | null; hasRates: boolean }
export type ScopeStatus = 'default' | 'supported' | 'unsupported_content'
export interface ScopeResult { exam: GoalExam | null; status: ScopeStatus; candidates: ExamCandidate[]; reason: string | null }

export function scopeCandidates(exam: GoalExam | null, all: readonly ScopeCandidate[]): ScopeResult {
  const kice = (m?: number) => all.filter((c) => c.organizer === 'kice' && (m === undefined || c.month === m))
  if (exam === null) return { exam, status: 'default', candidates: kice(), reason: null }
  if (exam === 'hakpyeong') {
    const office = all.filter((c) => c.organizer === 'edu_office')
    // A rate observation is not whole-exam teaching/assessment qualification.
    // There is no approved office-exam qualification reader in this contract yet.
    return { exam, status: 'unsupported_content', candidates: [], reason: office.some(c => c.hasRates) ? 'unqualified_rates' : office.length ? 'no_rates' : 'no_exams' }
  }
  const list = exam === 'suneung' ? kice().filter(c => c.kind === 'suneung') : kice(exam === 'kice6' ? 6 : 9).filter(c => c.kind === 'mock')
  return list.length > 0 ? { exam, status: 'supported', candidates: list, reason: null } : { exam, status: 'unsupported_content', candidates: [], reason: 'no_exams' }
}

export const SCOPE_REASON_LABEL: Record<string, string> = {
  unqualified_rates: '일부 오답률 관측만으로 시험 전체의 분석 적격성이 확인되지는 않아요 — 자료 검수 전이며 다른 시험으로 대신하지 않아요',
  no_rates: '이 시험은 문항별 오답률 자료가 아직 없어 목표 기준 분석을 하지 않아요 — 다른 시험으로 대신하지 않아요',
  no_exams: '이 시험의 분석용 회차가 아직 없어요 — 다른 시험으로 대신하지 않아요',
}

/** 등급 셋을 섞지 않는다 — 저장한 목표 등급 · 점수에서 계산한 참고 등급(구간) · 기록된 시험 등급은 다른 값이다 */
export interface GradeView {
  saved: number | null
  /** 목표 점수에서 계산한 참고 등급(절대평가 구간 표 · 검증된 시험 체제 규칙 아님) */
  referenceFromScore: number | null
  /** 저장 등급과 참고 등급이 다르다 — 바꾸지 않고 알린다 */
  mismatch: boolean
}
export function gradeView(score: number | null, saved: number | null, gradeOf: (raw: number) => number): GradeView {
  const ref = score === null ? null : gradeOf(score)
  return { saved, referenceFromScore: ref, mismatch: saved !== null && ref !== null && saved !== ref }
}
