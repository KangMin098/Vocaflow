// apps/web/src/lib/csat/binding/answers.ts
// 정답 집합 — csat_items.answers(배열)가 정본이다. 단일 answer 열만 읽으면 복수 정답(2015#25: ④·⑤)이
// 하나로 줄어든다. 분석이 정답 집합 전부를 다루는지도 여기서 본다.
import type { AnswerCoverage, AnswerSet } from './types'

export function answerSetOf(row: { answer: number | null; answers: number[] | null }): AnswerSet {
  const fromArray = Array.isArray(row.answers) ? [...new Set(row.answers.filter((n) => Number.isInteger(n) && n >= 1 && n <= 5))].sort((a, b) => a - b) : []
  const answers = fromArray.length ? fromArray : row.answer ? [row.answer] : []
  return {
    answers,
    multiple: answers.length > 1,
    // 단일 열이 집합 밖이면 어긋난 것 — 복수 정답일 때 단일 열이 그중 하나인 것은 어긋남이 아니다
    legacyMismatch: row.answer != null && answers.length > 0 && !answers.includes(row.answer),
  }
}

type ChoiceVerdict = { n: number; verdict?: string }

/** 분석의 정답 판정(verdict=correct)과 정답 집합을 대조한다 */
export function answerCoverage(set: AnswerSet, choiceAnalysis: ChoiceVerdict[] | null | undefined): AnswerCoverage {
  if (!Array.isArray(choiceAnalysis) || !choiceAnalysis.length) return { status: 'no_analysis' }
  const correct = choiceAnalysis.filter((c) => c.verdict === 'correct').map((c) => c.n)
  const missing = set.answers.filter((n) => !correct.includes(n))
  const extra = correct.filter((n) => !set.answers.includes(n))
  return missing.length || extra.length ? { status: 'partial', missing, extra } : { status: 'covered' }
}
