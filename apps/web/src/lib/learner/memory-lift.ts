// apps/web/src/lib/learner/memory-lift.ts
//
// **오늘 N개를 다시 보면 기억 곡선이 얼마나 들어 올려지나** — `/hub` 골격(망각)의 계산부.
//
// 무엇을 그리나: 곡선 아래 놓인 낱말들에 대해 날마다 **기억에 남아 있을 단어 수의 기대값**
//   Σ R(t) = Σ exp(ln(0.9)·t/S). 새 낱말(D/S 미부여)은 아직 익히지 않았으므로 0 이다.
//
// 왜 "버티는 단어 수"(stable+shaky 문턱 개수)가 아닌가 — 2026-09-19 첫 캡처에서 곡선이 **직사각형**이었다.
//   새 낱말 8개에 Good 한 번을 주면 7일 내내 R ≥ 0.7 이라 문턱 개수는 8 에서 움직이지 않는다.
//   망각이 보이지 않는 망각 곡선이다. R(t) 는 연속이라 기대값은 늘 내려가는 선이 된다.
//
// 왜 예보(`memory-forecast`)만으로는 안 되나 (DB 실측 2026-09-19, 집계 SELECT):
//   추적 단어가 있는 학습자 둘 모두 추적 단어 전부가 이미 risk 였고(98/98 · 136/136) 7일 안에
//   새로 흐려질 것은 0 이었다. "안 하면 내려간다" 는 이미 다 내려간 뒤다 — 곡선은 **"하면 올라간다"** 를 그린다.
//
// 계산: 같은 카드에 "오늘 Good 한 번" 을 FSRS(`applyReview`, 세션과 같은 스케줄러)로 적용하고
//   그 뒤 7일의 R 을 다시 푼다. 입력은 전부 이 학습자의 카드다 — 지어낸 학습자·평균 모형은 없다.
//
// 범위: 기준선도 **이 낱말들만으로** 센다(전체 단어장이 아니다) — 화면이 "이 N개 중" 이라고 밝힌다.
// 클라이언트로는 날짜별 R 값만 보낸다. 슬라이더가 N 을 바꿀 때 브라우저가 하는 일은 앞 N개의
// 차이를 더하는 것뿐이다 — `ts-fsrs` 를 번들에 싣지 않는다.
//
// ⚠️ 상태를 저장하지 않는다(`memory_state` 금지). 이 값은 요청마다 새로 계산된다.

import { applyReview, Rating, type SrsCard } from '@/lib/srs/fsrs'
import { calculateRetrievability, getMemoryState } from '@/lib/srs/state'
import type { MemoryState } from '@/lib/srs/types'

const DAY_MS = 86_400_000

export interface LiftWord {
  id: string
  word: string
  /** 오늘의 상태 — 밑줄 두께(3/2/1px · new dotted)가 이것을 그린다 */
  state: MemoryState
  /** 그대로 둘 때 d일 뒤의 회상 확률 R (새 낱말은 0) — 길이 horizonDays + 1 */
  before: number[]
  /** 오늘 한 번 다시 보면(Good) d일 뒤의 R */
  after: number[]
}

export interface MemoryLift {
  horizonDays: number
  /** 세션 큐와 **같은 순서**(`fetchStudyVocabularies`) — 앞에서 N개가 곧 `/flashcard/play?limit=N` 이다 */
  words: LiftWord[]
}

export interface LiftCardInput extends SrsCard {
  word: string
}

function recallOver(card: SrsCard, now: Date, horizon: number): number[] {
  const out: number[] = []
  for (let d = 0; d <= horizon; d++) {
    if (!card.lastReviewAt || card.stability <= 0) {
      out.push(0)
      continue
    }
    const elapsed = (now.getTime() + d * DAY_MS - card.lastReviewAt.getTime()) / DAY_MS
    // 소수 셋째 자리 — 화면은 정수로 반올림하고, 직렬화 크기를 줄인다
    out.push(Math.round(calculateRetrievability(elapsed, card.stability) * 1000) / 1000)
  }
  return out
}

export function buildMemoryLift(
  cards: readonly LiftCardInput[],
  now: Date = new Date(),
  horizonDays = 7,
): MemoryLift {
  const horizon = Math.max(1, Math.floor(horizonDays))
  return {
    horizonDays: horizon,
    words: cards.map((c) => {
      const reviewed = applyReview({ card: c, rating: Rating.Good, module: 'flashcard', reviewedAt: now }).card
      return {
        id: c.id,
        word: c.word,
        state: getMemoryState(c, now),
        before: recallOver(c, now, horizon),
        after: recallOver(reviewed, now, horizon),
      }
    }),
  }
}

/** 그대로 둘 때 날마다 기억에 남을 단어 수의 기대값(이 낱말들 기준). */
export function baseCurve(lift: MemoryLift): number[] {
  return Array.from({ length: lift.horizonDays + 1 }, (_, d) =>
    lift.words.reduce((s, w) => s + w.before[d], 0),
  )
}

/** 앞에서 `count` 개를 오늘 다시 볼 때 날마다 기억에 남을 단어 수의 기대값. 슬라이더마다 부른다. */
export function planCurve(lift: MemoryLift, count: number): number[] {
  const n = Math.max(0, Math.min(Math.floor(count), lift.words.length))
  return baseCurve(lift).map((b, d) => {
    let v = b
    for (let i = 0; i < n; i++) v += lift.words[i].after[d] - lift.words[i].before[d]
    return v
  })
}
