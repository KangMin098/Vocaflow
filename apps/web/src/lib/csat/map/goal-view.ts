// apps/web/src/lib/csat/map/goal-view.ts
//
// 학습 지도 첫 화면의 「목표 → 현재 위치 → 필요한 능력」 계산(순수 · 2026-10-08 목표 중심 재설계).
// 원칙(사용자 지시 · LEARNING_MAP 계약):
//   · 목표는 학습자가 정한다 — 정하지 않았으면 기본값을 「정한 목표」처럼 보이지 않는다(goalSet)
//   · 현재 위치는 실제 기록만 — 시험상(원점수 · 등급 · 회차) / 학습상(여정 단계) / 진단상(근거 상태)을 하나로 합치지 않는다
//   · 목표 달성률 · 숙달도 역산 · 「이 단계를 하면 몇 점 오른다」는 만들지 않는다
//   · 단계와 목표의 관계는 사실만 — 목표 계산에 쓰는 기준 시험(평가원 최근 N회)에서 그 단계에 이어진 문항 수 · 배점
import type { LearnerRecord } from './load'
import type { MapModel } from './model'
import type { StepEvidence, StepView } from './learner-path'

/** 영어 절대평가 등급(수능 · 평가원 모의평가 · 학력평가 공통): 원점수 10점 구간. 90 이상 1등급 … 20 미만 9등급 */
export function gradeOf(raw: number): number {
  if (!Number.isFinite(raw)) throw new Error('점수가 수가 아니다')
  const s = Math.max(0, Math.min(100, raw))
  return s >= 90 ? 1 : Math.min(9, 10 - Math.floor(s / 10))
}
/** 그 등급의 원점수 구간(「80~89점」) — 1등급은 「90점 이상」 */
export function gradeBand(grade: number): string {
  if (grade === 1) return '90점 이상'
  if (grade === 9) return '20점 미만'
  const lo = (10 - grade) * 10
  return `${lo}~${lo + 9}점`
}

export interface RecordPoint {
  label: string
  takenAt: string
  raw: number
  grade: number
}

export interface GoalSummary {
  goalSet: boolean
  goal: number
  goalGrade: number
  goalBand: string
  /** 원점수가 있는 기록 수 */
  recordCount: number
  latest: RecordPoint | null
  /** 바로 앞 기록 — 두 회 이상일 때만(변화 확인 · 상태 F) */
  previous: RecordPoint | null
  /** 목표 − 최근 원점수(0 이상). 목표를 정했고 기록이 있을 때만 — 그 밖에는 null(가상의 위치를 만들지 않는다) */
  gap: number | null
}

export function goalSummary(model: Pick<MapModel, 'goal' | 'goalSet'>, records: readonly LearnerRecord[]): GoalSummary {
  const points: RecordPoint[] = records
    .filter((r): r is LearnerRecord & { raw: number } => typeof r.raw === 'number' && Number.isFinite(r.raw))
    .map((r) => ({ label: r.label, takenAt: r.takenAt, raw: r.raw, grade: r.grade ?? gradeOf(r.raw) }))
  const latest = points.at(-1) ?? null
  const previous = points.length >= 2 ? points[points.length - 2] : null
  const goalGrade = gradeOf(model.goal)
  return {
    goalSet: model.goalSet,
    goal: model.goal,
    goalGrade,
    goalBand: gradeBand(goalGrade),
    recordCount: points.length,
    latest,
    previous,
    gap: model.goalSet && latest ? Math.max(0, model.goal - latest.raw) : null,
  }
}

export interface StepGoalLink {
  /** 기준 시험 회수 */
  exams: number
  /** 기준 시험 1회 평균 — 이 단계(라인 묶음)에 이어진 서로 다른 문항 수 · 배점 합 */
  itemsPerExam: number
  pointsPerExam: number
}

/** 단계와 목표의 관계 — 목표 계산에 쓰는 기준 시험에서 이 단계가 걸린 문항 · 배점(사실). 연결 문항이 없으면 null */
export function stepGoalLink(step: Pick<StepView, 'lines'>, model: Pick<MapModel, 'lineRefItems' | 'reference'>): StepGoalLink | null {
  const exams = model.reference.exams.length
  if (exams === 0) return null
  const seen = new Map<string, number>()
  for (const line of step.lines) {
    for (const it of model.lineRefItems[line] ?? []) seen.set(`${it.examId}#${it.no}`, it.points)
  }
  if (seen.size === 0) return null
  const points = [...seen.values()].reduce((s, p) => s + p, 0)
  return { exams, itemsPerExam: Math.round((seen.size / exams) * 10) / 10, pointsPerExam: Math.round((points / exams) * 10) / 10 }
}

/** 진단상 위치 — 단계 근거 상태를 학생 말 네 갈래로(합치지 않고 센다) */
export type EvidenceGroup = 'observed' | 'check' | 'thin' | 'verified'
export const EVIDENCE_GROUP_LABEL: Record<EvidenceGroup, string> = {
  observed: '기출에서 관찰됨',
  check: '먼저 확인할 것',
  thin: '근거 부족',
  verified: '직접 확인됨',
}
export function evidenceGroup(e: StepEvidence): EvidenceGroup {
  return e === 'verified' ? 'verified' : e === 'focus' ? 'check' : e === 'observed' ? 'observed' : 'thin'
}
export function evidenceCounts(steps: readonly Pick<StepView, 'evidence'>[]): Record<EvidenceGroup, number> {
  const out: Record<EvidenceGroup, number> = { observed: 0, check: 0, thin: 0, verified: 0 }
  for (const s of steps) out[evidenceGroup(s.evidence)]++
  return out
}
