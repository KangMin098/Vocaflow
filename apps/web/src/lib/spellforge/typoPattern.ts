// apps/web/src/lib/spellforge/typoPattern.ts

import type { TypoPattern } from '@/types/spellforge'

/**
 * 사용자 입력 vs 정답에서 자주 틀리는 패턴 추출
 */
export function extractTypoPattern(
  input: string,
  target: string
): { wrong: string; correct: string }[] {
  const patterns: { wrong: string; correct: string }[] = []

  const minLen = Math.min(input.length, target.length)
  for (let i = 0; i < minLen; i++) {
    if (input[i] !== target[i]) {
      patterns.push({
        wrong: input[i],
        correct: target[i],
      })
    }
  }

  return patterns
}

/**
 * 패턴 통계 누적
 */
export function aggregatePatterns(
  existingPatterns: TypoPattern[],
  newPatterns: { wrong: string; correct: string }[],
  exampleWord: string
): TypoPattern[] {
  const patternMap = new Map<string, TypoPattern>()

  // 기존 패턴 로드
  existingPatterns.forEach((p) => {
    patternMap.set(`${p.wrong}->${p.correct}`, { ...p })
  })

  // 새 패턴 누적
  newPatterns.forEach((np) => {
    const key = `${np.wrong}->${np.correct}`
    const existing = patternMap.get(key)

    if (existing) {
      existing.count++
      if (!existing.examples.includes(exampleWord)) {
        existing.examples.push(exampleWord)
        if (existing.examples.length > 5) {
          existing.examples.shift()
        }
      }
    } else {
      patternMap.set(key, {
        wrong: np.wrong,
        correct: np.correct,
        count: 1,
        examples: [exampleWord],
      })
    }
  })

  return Array.from(patternMap.values()).sort((a, b) => b.count - a.count)
}

/**
 * Top N 패턴만 반환
 */
export function getTopPatterns(patterns: TypoPattern[], n = 5): TypoPattern[] {
  return patterns.slice(0, n)
}
