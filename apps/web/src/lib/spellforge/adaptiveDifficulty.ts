// apps/web/src/lib/spellforge/adaptiveDifficulty.ts

import type { SpellForgeMode, SpellForgeRating } from '@/types/spellforge'

/**
 * 사용자 학습 기록 기반 모드 추천
 *
 * Bjork's Desirable Difficulty:
 * - 정답률 70~85%: 최적 (현재 모드 유지)
 * - 정답률 < 60%: 너무 어려움 → 쉬운 모드로
 * - 정답률 > 90%: 너무 쉬움 → 어려운 모드로
 */
export function recommendMode(
  recentRatings: SpellForgeRating[],
  currentMode: SpellForgeMode
): SpellForgeMode {
  if (recentRatings.length < 5) return currentMode

  const last10 = recentRatings.slice(-10)
  const correctCount = last10.filter((r) => r.finalCorrect).length
  const accuracy = (correctCount / last10.length) * 100

  if (accuracy < 60) {
    // 너무 어려움 → 쉬운 모드로
    if (currentMode === 'blind') return 'delayed'
    if (currentMode === 'delayed') return 'realtime'
    return currentMode
  }

  if (accuracy > 90) {
    // 너무 쉬움 → 어려운 모드로
    if (currentMode === 'realtime') return 'delayed'
    if (currentMode === 'delayed') return 'blind'
    return currentMode
  }

  return currentMode
}

/**
 * 적절한 어려움 메시지
 */
export function getDifficultyMessage(currentAccuracy: number): string | null {
  if (currentAccuracy < 50) {
    return '연속으로 어려운 단어들이네요. 잠시 쉬어가도 좋아요.'
  }
  if (currentAccuracy > 95) {
    return '너무 쉽나요? 도전 모드를 시도해보세요.'
  }
  return null // 적절한 난이도
}

/**
 * 학습 효과 추정 (학술 근거 기반)
 */
export const MODE_EFFICACY: Record<SpellForgeMode, number> = {
  realtime: 30, // 즉시 피드백 - Generation Effect 약함
  delayed: 60, // Generation Effect 활성화
  blind: 80, // 최강 (Spelling Bee 훈련 방식)
}
