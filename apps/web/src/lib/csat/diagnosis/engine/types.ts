// apps/web/src/lib/csat/diagnosis/engine/types.ts
//
// 진단 엔진의 입력·출력 계약. 엔진은 DB·시계·UI 를 모른다 — 서버가 표를 읽어 이 모양으로 넘기고,
// 결과를 csat_dx_snapshot 한 행으로 저장한다. 규칙 기반(rule-v1)을 통계 모델로 바꿀 때는
// `DiagnosisEngine` 구현체만 갈아 끼운다.

export const ATTRIBUTE_CODES = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'] as const
export type AttributeCode = (typeof ATTRIBUTE_CODES)[number]

export const TRAP_FAMILIES = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'] as const
export type TrapFamily = (typeof TRAP_FAMILIES)[number]

export type ResponseConfidence = 'sure' | 'unsure' | 'guess' | 'timeout'
export type SessionMode = 'live' | 'retake' | 'app' | 'diagnostic'
export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface EngineSettings {
  grade_cuts: number[]
  half_life_days: number
  credit: Record<ResponseConfidence, number>
  retake_weight: number
  min_observations: number
  listening: { attribute: AttributeCode; weight: number }
  trap: { min_exposure: number; vulnerable_ratio: number }
  habits: {
    time_collapse: { from_no: number; to_no: number; ratio: number; timeout_count: number }
    guessing: { guess_ratio: number; easy_error_rate: number; easy_wrong_count: number }
    word_reuse: { family: TrapFamily; ratio: number }
    cutline_90: { sessions: number; lo: number; hi: number }
    ebs: { gap: number }
    listening: { to_no: number; wrong_count: number; consecutive: number }
  }
  reference_exam: string | null
  scenario_exams: { hard: string | null; normal: string | null; easy: string | null }
  confidence: { high: { exams: number; responses: number }; medium: { exams: number; responses: number } }
  recommend: { weak_attributes: number; vulnerable_traps: number; max_lines: number }
  diagnostic_test: { size: number }
}

/** 시험 한 회의 정답·배점 한 줄(1~45) */
export interface KeyRow {
  no: number
  answers: number[]
  points: number
}

/** 18~45 처럼 csat_items 에 있는 문항의 진단 메타 */
export interface ItemMeta {
  itemId: string
  examId: string
  no: number
  errorRate: number | null
  ebsLinked: boolean | null
  attributes: Partial<Record<AttributeCode, number>>
  /** 선지 번호 → 함정 라벨(원래 이름). 계열은 trapFamily 로 푼다 */
  optionTraps: Partial<Record<number, string>>
}

export interface ExamMeta {
  id: string
  ready: boolean
  key: KeyRow[]
  /** 문항 번호 → 메타. 듣기처럼 없는 번호는 비어 있다 */
  items: Record<number, ItemMeta>
}

export interface ResponseIn {
  itemNo: number
  itemId: string | null
  chosen: number | null
  isCorrect: boolean
  confidence: ResponseConfidence
}

export interface SessionIn {
  id: string
  examId: string | null
  mode: SessionMode
  /** YYYY-MM-DD */
  takenAt: string
  rawScore: number | null
  responses: ResponseIn[]
}

export interface EngineInput {
  now: Date
  settings: EngineSettings
  sessions: SessionIn[]
  exams: Record<string, ExamMeta>
  /** 진단 테스트 문항 조회용(itemId → 메타) */
  items: Record<string, ItemMeta>
  trapFamily: Record<string, string | null>
  target: { grade: number } | null
}

export interface AttributeMastery {
  value: number | null
  n: number
  status: 'ok' | 'insufficient'
}

export interface TrapVulnerability {
  exposure: number
  picked: number
  ratio: number
  vulnerable: boolean
  items: string[]
}

export interface HabitFlag {
  code: 'time_collapse' | 'guessing' | 'word_reuse' | 'cutline_90' | 'ebs' | 'listening'
  evidence: Record<string, number>
}

export interface ScenarioForecast {
  examId: string | null
  expected: number | null
  grade: number | null
  meetsTarget: boolean | null
  adjusted: boolean
}

export interface RecommendedLine {
  code: string
  reason: { kind: 'attribute' | 'trap' | 'habit'; ref: string; value: number | null }
}

export interface DiagnosisResult {
  engineVersion: string
  rawScore: number | null
  ability: number | null
  /** 시험 난이도 보정이 실제로 됐는가(공식 오답률이 없으면 false) */
  adjusted: boolean
  gradeEst: number | null
  attributeMastery: Record<AttributeCode, AttributeMastery>
  trapVulnerability: Partial<Record<TrapFamily, TrapVulnerability>>
  habitFlags: HabitFlag[]
  forecast: { hard: ScenarioForecast; normal: ScenarioForecast; easy: ScenarioForecast }
  confidence: ConfidenceLevel
  recommendedLines: RecommendedLine[]
  evidence: {
    examSessions: number
    diagnosticSessions: number
    responses: number
    diagnosedResponses: number
    scoreOnlySessions: number
  }
  /** 점수 흐름 그래프용 — 회차별 원점수·보정 점수 */
  trend: { sessionId: string; takenAt: string; mode: SessionMode; raw: number | null; adjusted: number | null }[]
}

export interface DiagnosisEngine {
  version: string
  diagnose(input: EngineInput): DiagnosisResult
}
