// apps/web/src/lib/srs/supabase-adapter.ts
// Vocaflow Web — Supabase ↔ SrsCard 변환 어댑터
// CLAUDE.md §17.7 [7] 데이터 축 — vocabularies 테이블 컬럼 정합

import type { SrsCard, ModuleId, ReviewResult } from './index';

/**
 * Supabase `vocabularies` 테이블 row 형태
 * §17.7 데이터 축 신규 컬럼 6개 + 기존 컬럼
 */
export interface VocabularyRow {
  id: string;
  user_id: string;
  text_id: string;
  word: string;
  meaning: string;
  example_sentence: string | null;
  pronunciation: string | null;

  // FSRS 컬럼 (§17.7 신규)
  difficulty: number;
  stability: number;
  last_review_at: string | null; // ISO timestamptz
  next_review_at: string | null;
  module_history: string[];
  review_count: number;

  created_at: string;
}

/**
 * DB row → SrsCard 변환 (조회 시)
 */
export function rowToCard(row: VocabularyRow): SrsCard {
  return {
    id: row.id,
    difficulty: row.difficulty ?? 0,
    stability: row.stability ?? 0,
    lastReviewAt: row.last_review_at ? new Date(row.last_review_at) : null,
    nextReviewAt: row.next_review_at ? new Date(row.next_review_at) : null,
    moduleHistory: (row.module_history ?? []) as ModuleId[],
    reviewCount: row.review_count ?? 0,
  };
}

/**
 * SrsCard → DB UPDATE payload (review 적용 시)
 * vocabularies 테이블 partial update용
 */
export function cardToUpdatePayload(card: SrsCard): Partial<VocabularyRow> {
  return {
    difficulty: card.difficulty,
    stability: card.stability,
    last_review_at: card.lastReviewAt?.toISOString() ?? null,
    next_review_at: card.nextReviewAt?.toISOString() ?? null,
    module_history: card.moduleHistory,
    review_count: card.reviewCount,
  };
}

/**
 * `learning_records` 테이블 INSERT payload
 * §17.7 — module enum에 'dictation' 포함
 */
export interface LearningRecordPayload {
  user_id: string;
  vocabulary_id: string;
  module: ModuleId;
  rating: number; // FSRS 1~4
  is_correct: boolean; // 호환용 — rating ≥ 3이면 true
  attempted_at: string;
  /**
   * 인출 맥락. 지금 담는 것은 `chosen` 하나 — **오답일 때 학습자가 대신 고른 단어**다.
   *
   * 왜 필요한가: 오답 기록이 "무엇을 틀렸나" 만 남기면 남은 것은 난이도뿐이다.
   * "무엇과 헷갈렸나" 가 있어야 그 학습자의 실제 혼동 짝을 만들 수 있고, 그건
   * 인쇄된 단어장이 원리적으로 못 하는 것이다(오답은 인쇄 뒤에 생긴다).
   * 값이 없으면 키 자체를 넣지 않는다 — `{}` 는 "선택지가 없었다" 와 구별되지 않는다.
   */
  metadata?: { chosen: string };
}

/**
 * ReviewResult → learning_records INSERT payload
 *
 * @param result applyReview의 결과
 * @param userId 현재 사용자 ID (RLS auth.uid())
 * @param chosen 오답일 때 학습자가 대신 고른 단어 (선택지가 있는 모듈만)
 */
export function resultToRecordPayload(
  result: ReviewResult,
  userId: string,
  chosen?: string,
): LearningRecordPayload {
  const isCorrect = result.log.rating >= 3; // Good or Easy
  return {
    user_id: userId,
    vocabulary_id: result.log.cardId,
    module: result.log.module,
    rating: result.log.rating,
    is_correct: isCorrect,
    attempted_at: result.log.reviewedAt.toISOString(),
    // 정답일 때의 `chosen` 은 정답 자신이므로 담지 않는다 — 담으면 혼동 짝 집계에서
    // 자기 자신과 짝지어진 행이 절반을 차지한다.
    ...(!isCorrect && chosen && chosen.trim().length > 0
      ? { metadata: { chosen: chosen.trim() } }
      : {}),
  };
}
