// apps/web/src/lib/csat/diagnosis/engine/scoring.ts
//
// 채점 · 등급 · 시험 기대점수(난이도 보정의 바탕). 진단(역량·함정)과 분리돼 있다 —
// 태깅이 안 된 시험도 여기까지는 계산된다.

import type { ExamMeta, KeyRow, ResponseConfidence } from './types'

export interface ScoredAnswer {
  itemNo: number
  chosen: number | null
  isCorrect: boolean
  confidence: ResponseConfidence
}

/** 고른 답을 정답표로 채점한다. 비운 문항은 오답. 표시(헷갈림 등)는 점수를 바꾸지 않는다. */
export function scoreAnswers(
  key: KeyRow[],
  choices: Record<number, number | null | undefined>,
  flags: Record<number, ResponseConfidence | undefined> = {},
): { raw: number; max: number; answers: ScoredAnswer[] } {
  let raw = 0
  let max = 0
  const answers: ScoredAnswer[] = []
  for (const row of [...key].sort((a, b) => a.no - b.no)) {
    const chosen = choices[row.no] ?? null
    const isCorrect = chosen !== null && row.answers.includes(chosen)
    max += row.points
    if (isCorrect) raw += row.points
    answers.push({ itemNo: row.no, chosen, isCorrect, confidence: flags[row.no] ?? 'sure' })
  }
  return { raw, max, answers }
}

/** 영어 절대평가 고정 컷. cuts = [90, 80, …, 20] → 90 이상 1등급 … 20 미만 9등급 */
export function gradeOf(score: number | null, cuts: number[]): number | null {
  if (score === null || !Number.isFinite(score)) return null
  const sorted = [...cuts].sort((a, b) => b - a)
  const idx = sorted.findIndex((c) => score >= c)
  return idx === -1 ? sorted.length + 1 : idx + 1
}

/**
 * 시험 기대점수 E = Σ 배점 × (1 − 오답률).
 * 오답률이 없는 문항(듣기 포함)은 그 시험에서 오답률이 있는 문항의 평균으로 채운다.
 * 오답률이 하나도 없으면 null — 보정하지 않는다(가짜 오답률을 만들지 않는다).
 */
export function expectedScore(exam: ExamMeta | undefined): number | null {
  if (!exam || exam.key.length === 0) return null
  const known = exam.key
    .map((k) => exam.items[k.no]?.errorRate)
    .filter((r): r is number => typeof r === 'number' && Number.isFinite(r))
  if (known.length === 0) return null
  const avg = known.reduce((s, r) => s + r, 0) / known.length
  return exam.key.reduce((s, k) => {
    const r = exam.items[k.no]?.errorRate
    return s + k.points * (1 - (typeof r === 'number' && Number.isFinite(r) ? r : avg))
  }, 0)
}

/** 보정 점수 = 원점수 − E(그 시험) + E(기준 시험). 둘 중 하나라도 없으면 원점수 그대로(adjusted=false). */
export function adjustScore(
  raw: number,
  exam: ExamMeta | undefined,
  reference: ExamMeta | undefined,
): { value: number; adjusted: boolean } {
  const e = expectedScore(exam)
  const eRef = expectedScore(reference)
  if (e === null || eRef === null) return { value: raw, adjusted: false }
  return { value: clampScore(raw - e + eRef), adjusted: true }
}

export function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v * 10) / 10))
}
