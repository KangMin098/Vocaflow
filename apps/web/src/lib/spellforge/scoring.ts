// apps/web/src/lib/spellforge/scoring.ts

import type { ConfirmResult } from '@/types/spellforge'

/**
 * 단어 입력 정확도 계산
 * @param input 사용자 입력
 * @param target 정답 단어
 */
export function evaluateInput(input: string, target: string): ConfirmResult {
  const normalizedInput = input.toLowerCase().trim()
  const normalizedTarget = target.toLowerCase().trim()

  if (normalizedInput === normalizedTarget) {
    return {
      correct: true,
      correctChars: target.length,
      totalChars: target.length,
      accuracy: 100,
      errorPositions: [],
    }
  }

  // 글자별 비교
  let correctChars = 0
  const errorPositions: number[] = []
  const maxLen = Math.max(normalizedInput.length, normalizedTarget.length)

  for (let i = 0; i < maxLen; i++) {
    if (normalizedInput[i] === normalizedTarget[i]) {
      correctChars++
    } else {
      errorPositions.push(i)
    }
  }

  const accuracy = Math.round((correctChars / normalizedTarget.length) * 100)

  return {
    correct: false,
    correctChars,
    totalChars: normalizedTarget.length,
    accuracy,
    errorPositions,
  }
}

/**
 * Reflection 메시지 생성 (오답 후 메타인지 hint)
 */
export function generateReflectionMessage(result: ConfirmResult): string {
  const { accuracy, correctChars, totalChars } = result

  if (accuracy >= 80) {
    return `${correctChars}/${totalChars} 글자 맞췄어요 (${accuracy}%). 거의 다 왔어요. 어디가 다른지 보이시나요?`
  } else if (accuracy >= 50) {
    return '절반 이상 맞췄어요. 천천히 다시 시도해보세요. 발음을 들어보면 도움될 거예요.'
  } else {
    return '이번엔 어려웠네요. 발음을 듣고 다시 시도하거나 힌트를 받아보세요.'
  }
}

/**
 * 세션 평균 정확도 계산
 */
export function calculateSessionAccuracy(totalAttempts: number, totalCorrect: number): number {
  if (totalAttempts === 0) return 0
  return Math.round((totalCorrect / totalAttempts) * 100)
}

/**
 * 세션 시간 계산 (분 단위)
 */
export function calculateSessionMinutes(startedAt: Date): number {
  const elapsed = Date.now() - startedAt.getTime()
  return Math.floor(elapsed / 60_000)
}
