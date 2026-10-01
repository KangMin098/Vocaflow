// apps/web/src/lib/csat/diagnosis/payload.ts
//
// 진단 API 요청 본문 검사. 틀린 모양은 null 을 돌려주고 라우트가 400 으로 답한다.
// 시험 점수·정답 여부는 받지 않는다 — 서버가 정답표로 채점한다.

import type { ResponseConfidence } from './engine/types'

const CONF: ResponseConfidence[] = ['sure', 'unsure', 'guess', 'timeout']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

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

export function todayKst(now: Date): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}
