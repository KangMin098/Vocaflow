// apps/web/src/lib/wordblitz/record-result.ts
// Phase 11.9 B — WordBlitz 결과 → vocabularies SRS 업데이트 (server action)
//
// 정책:
// - 정답 → Rating.Good
// - 오답 → Rating.Again
// - module_history에 'wordblitz' 추가
// - 사용자 vocabularies에 없는 단어 (chapter LV 보충 단어) → skip (silent)
// - FSRS applyReview 활용 (lib/srs/fsrs.ts)

'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { applyReview, Rating } from '@/lib/srs';
import { rowToCard, cardToUpdatePayload, resultToRecordPayload } from '@/lib/srs/supabase-adapter';
import type { VocabularyRow } from '@/lib/srs/supabase-adapter';

export interface RecordWordBlitzInput {
  word: string;
  isCorrect: boolean;
}

export type RecordResult =
  | { ok: true; updated: boolean }
  | { ok: false; error: string };

export async function recordWordBlitzResult(
  input: RecordWordBlitzInput,
): Promise<RecordResult> {
  const client = (await createClient()) as unknown as SupabaseClient;

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { ok: false, error: '로그인이 필요합니다.' };
  }

  const normalizedWord = input.word.toLowerCase();

  const { data: vocabRow, error: fetchError } = await client
    .from('vocabularies')
    .select(
      'id, user_id, text_id, word, meaning, example_sentence, pronunciation, difficulty, stability, last_review_at, next_review_at, module_history, review_count, created_at',
    )
    .eq('user_id', user.id)
    .eq('word', normalizedWord)
    .maybeSingle();

  if (fetchError) {
    console.error('[recordWordBlitzResult] fetch failed:', fetchError.message);
    return { ok: false, error: fetchError.message };
  }

  if (!vocabRow) {
    // 사용자 vocabularies에 없는 단어 (chapter LV 보충) → silent skip
    return { ok: true, updated: false };
  }

  const card = rowToCard(vocabRow as VocabularyRow);
  const rating = input.isCorrect ? Rating.Good : Rating.Again;
  const result = applyReview({
    card,
    rating,
    module: 'wordblitz',
    reviewedAt: new Date(),
  });

  const payload = cardToUpdatePayload(result.card);
  const { error: updateError } = await client
    .from('vocabularies')
    .update(payload)
    .eq('id', (vocabRow as VocabularyRow).id);

  if (updateError) {
    console.error('[recordWordBlitzResult] update failed:', updateError.message);
    return { ok: false, error: updateError.message };
  }

  // 학습 기록(audit) — Hub/Dashboard 통계 토대. 다른 모듈(flush 경로)과 일관되게 적재.
  //   resultToRecordPayload: vocabulary_id = result.log.cardId = rowToCard(vocabRow).id = vocab row id.
  const { error: recordError } = await client
    .from('learning_records')
    .insert(resultToRecordPayload(result, user.id));

  if (recordError) {
    console.error('[recordWordBlitzResult] record insert failed:', recordError.message);
    return { ok: false, error: recordError.message };
  }

  return { ok: true, updated: true };
}
