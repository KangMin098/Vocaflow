// apps/web/src/lib/library/recommend-books.ts
//
// 도서 추천 점수 — isomorphic 순수 함수 (서버/클라 공용, 마이그레이션 없음).
// 이미 fetch 된 출시 도서 집합(수십~수백)에 composite 점수를 매겨 For You 정렬·rail·
// 그리드 "왜 추천?" 칩에 사용한다.
//
// 학습 과학 정합 (CLAUDE.md §학습 모델):
//   - 1순위 = i+1 적합도 (Krashen i+1 · Nation 1990). 임계값은 i-plus-one.ts 단일 출처.
//   - 2순위 = V-level 근접 (book_v − user_v = +1 에서 peak 인 gaussian).
//   - 보조 = 인기 · 길이 fit(cold) · 학습 어포던스(오디오·단어장).
//   - Calm UI: hard tier 는 감점만(비난색/카운터 없음), completed 는 하향.

import type { PublishedBook } from './published-book'
import { judgeIPlusOne } from './i-plus-one'

export type UserMastery = 'cold' | 'warm' | 'hot'

export interface RecommendContext {
  /** VRL 진단 V레벨. 0 = 미진단 → i+1/V근접 비활성, 인기·낮은 부담 fallback. */
  userVLevel: number
  userMastery: UserMastery
}

export interface BookScore {
  score: number
  /** 카드 "왜 추천?" 칩 (우선순위 정렬, 최대 2개 노출 권장) */
  reasons: string[]
}

export interface RankedBook {
  book: PublishedBook
  score: number
  reasons: string[]
}

const SIGMA = 1.5

function gaussian(diff: number, sigma: number): number {
  return Math.exp(-(diff * diff) / (2 * sigma * sigma))
}

/** 단일 도서 점수 + 추천 사유. */
export function scoreBook(book: PublishedBook, ctx: RecommendContext): BookScore {
  let score = 0
  const reasons: string[] = []
  const diagnosed = ctx.userVLevel >= 1

  // 1) i+1 적합도 (최대 비중) — 진단 사용자만.
  if (diagnosed) {
    const fit = judgeIPlusOne(book.lexical_coverage, ctx.userVLevel, book.is_picture_book)
    if (fit) {
      if (fit.tier === 'ideal') {
        score += 50
        reasons.push('딱 맞는 난이도')
      } else if (fit.tier === 'challenge') {
        score += 25
        reasons.push('도전적')
      } else if (fit.tier === 'easy') {
        score += 12
      } else {
        score -= 25 // hard — 좌절 구간
      }
    }
    // 2) V-level 근접 (peak at +1).
    if (book.book_v_level != null) {
      const diff = book.book_v_level - ctx.userVLevel - 1
      score += 18 * gaussian(diff, SIGMA)
    }
  } else {
    // 미진단 fallback — 부담 적은(낮은 V) 책 우선.
    if (book.book_v_level != null) {
      score += Math.max(0, 18 - (book.book_v_level - 1) * 2)
    }
  }

  // 3) 인기 — popularity_rank 작을수록 인기 (지수 감쇠).
  if (book.popularity_rank != null && book.popularity_rank >= 0) {
    score += 15 * Math.exp(-book.popularity_rank / 400)
    if (book.popularity_rank <= 150) reasons.push('인기')
  }

  // 4) 길이 fit — cold 학습자에겐 짧은 책이 진입 장벽 낮음.
  if (book.reading_minutes != null && book.reading_minutes > 0) {
    const short = book.reading_minutes < 60
    if (ctx.userMastery === 'cold') {
      if (short) {
        score += 6
        reasons.push('짧게 읽기')
      } else if (book.reading_minutes > 240) {
        score -= 4
      }
    } else if (short) {
      score += 2
    }
  }

  // 5) 학습 어포던스.
  if (book.has_audio) {
    score += 4
    reasons.push('원어민 음성')
  }
  if ((book.word_set_count ?? 0) > 0) {
    score += 3
    reasons.push('단어장 제공')
  }

  // 6) 패널티 — 완독 도서는 추천에서 하향.
  if (book.enrollment_state === 'completed') score -= 40

  // 사유 우선순위(난이도 > 음성 > 짧게 > 인기 > 단어장)는 push 순서로 보장됨.
  return { score, reasons: reasons.slice(0, 2) }
}

/** 점수 desc 정렬 (동점 시 인기 → 제목). 미리 계산된 점수도 함께 반환. */
export function rankBooks(books: PublishedBook[], ctx: RecommendContext): RankedBook[] {
  return books
    .map((book) => {
      const s = scoreBook(book, ctx)
      return { book, score: s.score, reasons: s.reasons }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const pa = a.book.popularity_rank ?? Number.MAX_SAFE_INTEGER
      const pb = b.book.popularity_rank ?? Number.MAX_SAFE_INTEGER
      if (pa !== pb) return pa - pb
      return a.book.title.localeCompare(b.book.title)
    })
}

/** 상위 N권 (For You 스포트라이트용). */
export function topRecommended(
  books: PublishedBook[],
  ctx: RecommendContext,
  n: number,
): PublishedBook[] {
  return rankBooks(books, ctx)
    .slice(0, n)
    .map((r) => r.book)
}
