// apps/web/src/lib/dictation/targets.ts
//
// 타깃 단어 적중 판정 → FSRS 등급.
//
// 이 파일이 받아쓰기를 Vocaflow 에 붙인다. 여태 받아쓰기는 `learning_records` 0행 —
// 아무리 받아써도 단어 기억에 아무 흔적을 남기지 않는 섬이었다. 문장 안의 타깃 단어를
// 맞췄는지로 등급을 매기면, 받아쓰기가 **가장 어려운 형태의 인출**(단서 없이 소리만
// 듣고 철자까지 복원)로서 복습 곡선에 정당하게 기여한다.
//
// 등급 기준 — "얼마나 힘들게 맞췄나"를 반영한다(§학습원칙3 Desirable Difficulty).
//   4 Easy  : 한 번 듣고 힌트 없이 정확히
//   3 Good  : 힌트 없이 정확히 (여러 번 들음)
//   2 Hard  : 철자가 흔들렸거나 약한 힌트(1~3단계)를 씀
//   1 Again : 못 씀 / 건너뜀 / **정답 보기(4단계)를 씀**
//
// 정답을 열어 보고 옮겨 적은 것을 '맞혔다'로 세면 복습 간격이 늘어나 그 단어는 다시
// 안 나온다 — 정작 가장 모르는 단어인데. 인출이 없었으므로 Again 으로 취급한다.

import { matchSurface } from '@/lib/text/surface-match'

import type { WordResult } from './types'

export interface TargetEvalInput {
  /** 이 문항의 정답 문장 */
  expected: string
  /** 훈련 대상 단어(원형) */
  targetWords: string[]
  /** 단어별 사전 굴절형 */
  targetForms: Record<string, string[]>
  /** 채점 정렬 결과 */
  wordResults: WordResult[]
  hintsUsed: number
  /** 사용한 가장 강한 힌트 단계 (0=없음 … 4=정답 보기) */
  maxHintLevel: number
  replayCount: number
  skipped: boolean
}

export interface TargetOutcome {
  word: string
  /** 정확히 받아썼는가 */
  hit: boolean
  /** 철자만 흔들림 (부분 인정) */
  partial: boolean
  /** FSRS 1~4 */
  rating: 1 | 2 | 3 | 4
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9']/g, '')
}

/**
 * 타깃 단어가 문장에서 어떤 표면형으로 등장하는지 찾고, 그 토큰의 채점 상태로 판정.
 * 표면형을 못 찾으면(불규칙 미수록 등) 정렬 결과 전체에서 원형 근사 매칭으로 폴백한다.
 */
export function evaluateTargets(input: TargetEvalInput): TargetOutcome[] {
  const {
    expected,
    targetWords,
    targetForms,
    wordResults,
    hintsUsed,
    maxHintLevel,
    replayCount,
    skipped,
  } = input

  return targetWords.map((word) => {
    if (skipped) {
      return { word, hit: false, partial: false, rating: 1 as const }
    }
    // 정답을 열어 봤다면 인출이 일어나지 않았다 — 맞게 적혔더라도 Again.
    if (maxHintLevel >= 4) {
      return { word, hit: false, partial: false, rating: 1 as const }
    }

    const surface = matchSurface(expected, word, targetForms[word] ?? [])?.surface ?? word
    const key = normalize(surface)
    const lemmaKey = normalize(word)

    // 정렬 결과에서 그 토큰 찾기 — 표면형 우선, 없으면 원형으로 근사.
    const wr =
      wordResults.find((w) => normalize(w.expected) === key) ??
      wordResults.find((w) => normalize(w.expected).startsWith(lemmaKey.slice(0, Math.max(3, lemmaKey.length - 2))))

    if (!wr) {
      // 정답 문장에 없는 타깃(데이터 불일치) — 등급을 매기지 않는다.
      return { word, hit: false, partial: false, rating: 2 as const }
    }

    const hit = wr.status === 'correct'
    const partial = wr.status === 'misspelled'

    let rating: 1 | 2 | 3 | 4
    if (hit && hintsUsed === 0 && replayCount <= 1) rating = 4
    else if (hit && hintsUsed === 0) rating = 3
    else if (hit || partial) rating = 2
    else rating = 1

    return { word, hit, partial, rating }
  })
}

/** 세션 전체 타깃 결과 → 단어별 최종 등급 (같은 단어가 여러 문장에 나오면 최저 등급 채택). */
export function reduceTargetRatings(
  outcomes: Array<{ word: string; rating: 1 | 2 | 3 | 4 }>,
): Map<string, 1 | 2 | 3 | 4> {
  const map = new Map<string, 1 | 2 | 3 | 4>()
  for (const o of outcomes) {
    const prev = map.get(o.word)
    // 한 번이라도 놓쳤으면 놓친 것으로 — 관대한 쪽으로 평균 내면 복습이 늦어진다.
    if (prev == null || o.rating < prev) map.set(o.word, o.rating)
  }
  return map
}
