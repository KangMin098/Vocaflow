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
}

/**
 * ReviewResult → learning_records INSERT payload
 *
 * @param result applyReview의 결과
 * @param userId 현재 사용자 ID (RLS auth.uid())
 */
export function resultToRecordPayload(
  result: ReviewResult,
  userId: string,
): LearningRecordPayload {
  return {
    user_id: userId,
    vocabulary_id: result.log.cardId,
    module: result.log.module,
    rating: result.log.rating,
    is_correct: result.log.rating >= 3, // Good or Easy
    attempted_at: result.log.reviewedAt.toISOString(),
  };
}
