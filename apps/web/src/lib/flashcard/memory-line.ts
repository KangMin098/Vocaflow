// apps/web/src/lib/flashcard/memory-line.ts
//
// **이 단어의 기억선** — `/flashcard/play` 골격(망각)의 계산부(2026-09-19 · docs/design/compare/flashcard-play.md).
//
// 두 가지를 낸다.
//   ① 지난 복습부터 오늘까지 이 단어가 흐려진 선 — R(t) = 0.9^(t/S). 새 낱말(D/S 미부여)은 선이 없다.
//   ② 네 평가 각각의 **다음 만남 날**과 그 뒤의 곡선 — 세션이 실제로 적용하는 `applyReview`(FSRS)로 계산.
//      평가 버튼이 말하는 날짜와 실제 스케줄이 같은 모형이어야 한다 — 예전 버튼은 SM-2 간격을 보였다.
//
// ⚠️ FSRS 변수(D/S)를 화면에 숫자로 내보내지 않는다(§17 안티패턴 2) — 선의 모양과 "N일 뒤" 말만 쓴다.
// ⚠️ 상태를 저장하지 않는다(`memory_state` 금지). 그릴 때마다 계산한다.

import { applyReview, Rating, type RatingValue, type SrsCard } from '@/lib/srs/fsrs'
import { calculateRetrievability, getMemoryState } from '@/lib/srs/state'
import type { MemoryState } from '@/lib/srs/types'

const DAY_MS = 86_400_000

export type LineRating = 'again' | 'hard' | 'good' | 'easy'

const RATING_VALUE: Record<LineRating, RatingValue> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

export interface LinePoint {
  /** 오늘 기준 일(과거는 음수) */
  d: number
  /** 회상 확률 0..1 */
  r: number
}

export interface RatingPreview {
  rating: LineRating
  /** 다음 만남까지 일(소수 — 분·시간 단위도 담는다) */
  dueInDays: number
  /** 오늘 이 평가를 한 뒤의 곡선(오늘 = 1 에서 시작) */
  curve: LinePoint[]
}

export interface MemoryLine {
  state: MemoryState
  /** 지난 복습 이후 흐른 날 — 새 낱말은 null */
  sinceDays: number | null
  /** 지난 복습 → 오늘 (최대 `pastCap` 일만 그린다) */
  past: LinePoint[]
  previews: RatingPreview[]
  /** 미래 축의 끝(일) — 가장 먼 다음 만남까지, [7, 60] 로 자른다 */
  horizon: number
}

function sample(from: number, to: number, n: number, f: (d: number) => number): LinePoint[] {
  const out: LinePoint[] = []
  for (let i = 0; i <= n; i++) {
    const d = from + ((to - from) * i) / n
    out.push({ d, r: f(d) })
  }
  return out
}

export function buildMemoryLine(card: SrsCard, now: Date = new Date(), pastCap = 30): MemoryLine {
  const state = getMemoryState(card, now)
  const tracked = !!card.lastReviewAt && card.stability > 0
  const sinceDays = tracked ? (now.getTime() - card.lastReviewAt!.getTime()) / DAY_MS : null

  const past =
    tracked && sinceDays !== null
      ? sample(-Math.min(sinceDays, pastCap), 0, 24, (d) =>
          calculateRetrievability(sinceDays + d, card.stability),
        )
      : []

  const raw = (Object.keys(RATING_VALUE) as LineRating[]).map((rating) => {
    const next = applyReview({ card, rating: RATING_VALUE[rating], module: 'flashcard', reviewedAt: now }).card
    const due = next.nextReviewAt ? Math.max(0, (next.nextReviewAt.getTime() - now.getTime()) / DAY_MS) : 0
    return { rating, dueInDays: due, stability: next.stability }
  })
  const horizon = Math.min(60, Math.max(7, Math.ceil(Math.max(...raw.map((p) => p.dueInDays)) * 1.15)))

  return {
    state,
    sinceDays,
    past,
    horizon,
    previews: raw.map((p) => ({
      rating: p.rating,
      dueInDays: p.dueInDays,
      curve: sample(0, horizon, 32, (d) => calculateRetrievability(d, p.stability)),
    })),
  }
}

/**
 * 다음 만남까지를 사람의 말로 — 분 · 시간 · 일 · 개월.
 * 3일 이상에는 「약」 — 스케줄러가 간격에 흔들림(enable_fuzz)을 넣어, 누른 순간 적용되는 날짜가
 * 미리보기와 하루쯤 다를 수 있다. 짧은 간격에는 흔들림이 없다(ts-fsrs 는 2.5일 미만을 흔들지 않는다).
 */
export function formatDue(days: number): string {
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 24 * 60))}분 뒤`
  if (days < 1) return `${Math.round(days * 24)}시간 뒤`
  if (days < 3) return `${Math.round(days)}일 뒤`
  if (days < 45) return `약 ${Math.round(days)}일 뒤`
  return `약 ${Math.round(days / 30)}개월 뒤`
}

/**
 * 세션 완료 — 이 세션에서 다시 본 낱말들의 7일 기억 곡선(허브 골든과 같은 문법).
 * `base` = 오늘 안 봤다면 날마다 기억에 남을 수의 기대값 Σ R, `after` = 오늘 본 뒤(평가가 적용된 카드).
 * 새 낱말은 보기 전 R 이 0 이다(아직 익히지 않았다).
 */
export function sessionCurves(
  pairs: ReadonlyArray<{ before: SrsCard; after: SrsCard }>,
  now: Date = new Date(),
  horizonDays = 7,
): { base: number[]; after: number[] } {
  const r = (c: SrsCard, d: number) =>
    !c.lastReviewAt || c.stability <= 0
      ? 0
      : calculateRetrievability((now.getTime() + d * DAY_MS - c.lastReviewAt.getTime()) / DAY_MS, c.stability)
  const days = Array.from({ length: horizonDays + 1 }, (_, d) => d)
  return {
    base: days.map((d) => pairs.reduce((s, p) => s + r(p.before, d), 0)),
    after: days.map((d) => pairs.reduce((s, p) => s + r(p.after, d), 0)),
  }
}
