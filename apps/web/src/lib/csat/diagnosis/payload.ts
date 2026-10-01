// apps/web/src/lib/csat/diagnosis/payload.ts
//
// 진단 API 요청 본문 검사. 틀린 모양은 null 을 돌려주고 라우트가 400 으로 답한다.
// 시험 점수·정답 여부는 받지 않는다 — 서버가 정답표로 채점한다.

import type { ResponseConfidence } from './engine/types'

const CONF: ResponseConfidence[] = ['sure', 'unsure', 'guess', 'timeout']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const ITEM_ID = /^[A-Za-z0-9_]{1,16}#[0-9]{1,2}$/

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function validDate(s: unknown, today: string): s is string {
  if (typeof s !== 'string' || !DATE.test(s)) return false
  const t = Date.parse(`${s}T00:00:00Z`)
  return Number.isFinite(t) && s >= '2010-01-01' && s <= today
}

export interface ExamPayload {
  examId: string
  mode: 'live' | 'retake'
  takenAt: string
  totalMinutes: number | null
  clientKey: string
  choices: Record<number, number | null>
  flags: Record<number, ResponseConfidence>
}

/** today = 'YYYY-MM-DD'(서버 기준) — 미래 응시일을 막는다 */
export function parseExamPayload(body: unknown, today: string): ExamPayload | null {
  if (!isObj(body)) return null
  const { examId, mode, takenAt, totalMinutes, clientKey, choices, flags } = body
  if (typeof examId !== 'string' || examId.length > 16) return null
  if (mode !== 'live' && mode !== 'retake') return null
  if (!validDate(takenAt, today)) return null
  if (typeof clientKey !== 'string' || !UUID.test(clientKey)) return null
  if (totalMinutes !== null && totalMinutes !== undefined && !(Number.isInteger(totalMinutes) && (totalMinutes as number) >= 0 && (totalMinutes as number) <= 300)) return null
  if (!isObj(choices)) return null
  const outChoices: Record<number, number | null> = {}
  for (const [k, v] of Object.entries(choices)) {
    const no = Number(k)
    if (!Number.isInteger(no) || no < 1 || no > 45) return null
    if (v !== null && !(Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5)) return null
    outChoices[no] = v as number | null
  }
  const outFlags: Record<number, ResponseConfidence> = {}
  if (flags !== undefined) {
    if (!isObj(flags)) return null
    for (const [k, v] of Object.entries(flags)) {
      const no = Number(k)
      if (!Number.isInteger(no) || no < 1 || no > 45) return null
      if (!CONF.includes(v as ResponseConfidence)) return null
      outFlags[no] = v as ResponseConfidence
    }
  }
  return {
    examId,
    mode,
    takenAt,
    totalMinutes: (totalMinutes as number | null | undefined) ?? null,
    clientKey,
    choices: outChoices,
    flags: outFlags,
  }
}

export interface DiagnosticPayload {
  clientKey: string
  answers: { itemId: string; chosen: number | null; confidence: ResponseConfidence }[]
}

export function parseDiagnosticPayload(body: unknown, maxItems: number): DiagnosticPayload | null {
  if (!isObj(body)) return null
  const { clientKey, answers } = body
  if (typeof clientKey !== 'string' || !UUID.test(clientKey)) return null
  if (!Array.isArray(answers) || answers.length === 0 || answers.length > maxItems) return null
  const out: DiagnosticPayload['answers'] = []
  for (const a of answers) {
    if (!isObj(a) || typeof a.itemId !== 'string' || !ITEM_ID.test(a.itemId)) return null
    if (a.chosen !== null && !(Number.isInteger(a.chosen) && (a.chosen as number) >= 1 && (a.chosen as number) <= 5)) return null
    const confidence = (a.confidence ?? 'sure') as ResponseConfidence
    if (!CONF.includes(confidence)) return null
    out.push({ itemId: a.itemId, chosen: a.chosen as number | null, confidence })
  }
  return { clientKey, answers: out }
}

const GRADE_LEVELS = ['h1', 'h2', 'h3', 'n_su', 'adult']
const GOALS = ['susi_min', 'jeongsi', 'naesin', 'keep']

export interface ProfilePayload {
  gradeLevel: string
  goalType: string
  goalDetail: { min_rule?: string; target_grade?: number }
  background: Record<string, string>
  weeklyHours: number | null
}

export function parseProfilePayload(body: unknown): ProfilePayload | null {
  if (!isObj(body)) return null
  const { gradeLevel, goalType, goalDetail, background, weeklyHours } = body
  if (typeof gradeLevel !== 'string' || !GRADE_LEVELS.includes(gradeLevel)) return null
  if (typeof goalType !== 'string' || !GOALS.includes(goalType)) return null
  const detail: ProfilePayload['goalDetail'] = {}
  if (goalDetail !== undefined) {
    if (!isObj(goalDetail)) return null
    if (goalDetail.min_rule !== undefined) {
      if (typeof goalDetail.min_rule !== 'string' || goalDetail.min_rule.length > 20) return null
      if (goalDetail.min_rule.trim()) detail.min_rule = goalDetail.min_rule.trim()
    }
    if (goalDetail.target_grade !== undefined && goalDetail.target_grade !== null) {
      if (!Number.isInteger(goalDetail.target_grade) || (goalDetail.target_grade as number) < 1 || (goalDetail.target_grade as number) > 9) return null
      detail.target_grade = goalDetail.target_grade as number
    }
  }
  const bg: Record<string, string> = {}
  if (background !== undefined) {
    if (!isObj(background)) return null
    for (const [k, v] of Object.entries(background)) {
      if (k.length > 20 || typeof v !== 'string' || v.length > 20) return null
      bg[k] = v
    }
  }
  if (weeklyHours !== null && weeklyHours !== undefined && !(Number.isInteger(weeklyHours) && (weeklyHours as number) >= 0 && (weeklyHours as number) <= 80)) return null
  return { gradeLevel, goalType, goalDetail: detail, background: bg, weeklyHours: (weeklyHours as number | null | undefined) ?? null }
}

export function todayKst(now: Date): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}
