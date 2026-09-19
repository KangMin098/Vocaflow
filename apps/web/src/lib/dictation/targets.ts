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
  /**
   * **채점이 성립했는가.**
   *
   * 타깃이 그 문장에 실제로 없으면(데이터 불일치) 학습자의 잘못이 아니다. 그런데 예전에는
   * 그 경우에도 `rating: 2` 를 돌려주고 주석에는 "등급을 매기지 않는다" 고 적혀 있었다 —
   * 주석과 코드가 서로 다른 말을 하고 있었다. 실측 2026-09-05: 정답 문장을 **100% 그대로**
   * 입력해도 79,764문장 중 **898(1.13%)** 이 `hit=false, rating=2` 였고, 화면은 주황 칩으로
   * 「N개는 놓쳤어요」라 말하면서 같은 화면의 문장 정확도는 100% 로 떴다. 그 rating 2 가
   * `flushPendingSrsResults` 로 `vocabularies` 에 실려 **복습 간격까지 줄였다.**
   *
   * 이제 그런 항목은 `graded: false` 로 표시하고, 놓친 것으로도 세지 않고 FSRS 에도 안 보낸다.
   * 원인(세트 경로가 문장에 없는 lemma 를 타깃으로 심는 것)은 `source.ts` 쪽 별건이다.
   */
  graded: boolean
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
      return { word, hit: false, partial: false, rating: 1 as const, graded: true }
    }
    // 정답을 열어 봤다면 인출이 일어나지 않았다 — 맞게 적혔더라도 Again.
    if (maxHintLevel >= 4) {
      return { word, hit: false, partial: false, rating: 1 as const, graded: true }
    }

    const forms = targetForms[word] ?? []
    const surface = matchSurface(expected, word, forms)?.surface ?? word
    const key = normalize(surface)

    // 정렬 결과에서 그 토큰 찾기 — 표면형 우선, 없으면 **그 토큰이 실제로 이 낱말의 굴절형일
    // 때만** 받는다.
    //
    // ⚠️ 예전 폴백은 `lemma.slice(0, max(3, len-2))` 접두사였다 — 5자 이하 lemma 는 앞 3글자만
    //    비교한다. 실측 2026-09-05: 79,764문장 중 **1,516(1.90%)** 이 타깃의 굴절형이 아닌
    //    토큰으로 채점됐다 — `wax`→`waxen` · `prim`→`primness` · `tardy`→`tardiness` ·
    //    `savor`→`savour`. 칩은 `✓ savor` 라고 뜨는데 판정 근거는 학습자가 쓴 **다른 낱말**이다.
    //    그래서 토큰을 통째로 `matchSurface` 에 넣어, 규칙형·사전 굴절형으로 설명될 때만 받는다.
    const wr =
      wordResults.find((w) => normalize(w.expected) === key) ??
      wordResults.find((w) => {
        const m = matchSurface(w.expected, word, forms)
        return m != null && normalize(m.surface) === normalize(w.expected)
      })

    if (!wr) {
      // 정답 문장에 없는 타깃(데이터 불일치) — **채점하지 않는다.** 놓친 것으로도 안 세고
      // FSRS 에도 안 보낸다(`graded: false`). 학습자가 틀린 것이 아니다.
      return { word, hit: false, partial: false, rating: 2 as const, graded: false }
    }

    const hit = wr.status === 'correct'
    const partial = wr.status === 'misspelled'

    let rating: 1 | 2 | 3 | 4
    if (hit && hintsUsed === 0 && replayCount <= 1) rating = 4
    else if (hit && hintsUsed === 0) rating = 3
    else if (hit || partial) rating = 2
    else rating = 1

    return { word, hit, partial, rating, graded: true }
  })
}

/** 세션 전체 타깃 결과 → 단어별 최종 등급 (같은 단어가 여러 문장에 나오면 최저 등급 채택). */
export function reduceTargetRatings(
  outcomes: Array<{ word: string; rating: 1 | 2 | 3 | 4; graded?: boolean }>,
): Map<string, 1 | 2 | 3 | 4> {
  const map = new Map<string, 1 | 2 | 3 | 4>()
  for (const o of outcomes) {
    // 채점이 성립하지 않은 항목은 FSRS 에 보내지 않는다 — 데이터 불일치를 학습자 탓으로 돌리지 않는다
    if (o.graded === false) continue
    const prev = map.get(o.word)
    // 한 번이라도 놓쳤으면 놓친 것으로 — 관대한 쪽으로 평균 내면 복습이 늦어진다.
    if (prev == null || o.rating < prev) map.set(o.word, o.rating)
  }
  return map
}
