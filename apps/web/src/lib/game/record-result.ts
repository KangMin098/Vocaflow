// apps/web/src/lib/game/record-result.ts
// 게임 공용 결과 레코더 — 단어 인출 결과 → vocabularies FSRS 갱신 + learning_records audit.
// recordWordBlitzResult 를 module 파라미터로 일반화(6종 아케이드 게임 공용).
//
// 정책(WordBlitz 계승):
// - 정답 → Rating.Good · 오답 → Rating.Again
// - 사용자 vocabularies 에 없는 단어(기본 풀·보충 단어) → silent skip
// - learning_records.module / scores.module enum 미확장 시 audit insert 실패는
//   조용히 흡수(카드 SRS 갱신은 유효). enum 확장 마이그레이션 후 audit 완전 활성.

'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { applyReview, Rating } from '@/lib/srs';
import type { ModuleId } from '@/lib/srs';
import { rowToCard, cardToUpdatePayload, resultToRecordPayload } from '@/lib/srs/supabase-adapter';
import type { VocabularyRow } from '@/lib/srs/supabase-adapter';

export interface RecordGameResultInput {
  word: string;
  isCorrect: boolean;
  module: ModuleId;
}

export type RecordResult =
  | { ok: true; updated: boolean }
  | { ok: false; error: string };

export async function recordGameResult(
  input: RecordGameResultInput,
): Promise<RecordResult> {
  const client = (await createClient()) as unknown as SupabaseClient;

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다.' };

  const normalizedWord = input.word.toLowerCase();

  const { data: vocabRow, error: fetchError } = await client
    .from('vocabularies')
    .select(
      'id, user_id, text_id, word, meaning, example_sentence, pronunciation, difficulty, stability, last_review_at, next_review_at, module_history, review_count, created_at',
    )
    .eq('user_id', user.id)
    .eq('word', normalizedWord)
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!vocabRow) return { ok: true, updated: false }; // 사용자 vocab 에 없음 → skip

  const card = rowToCard(vocabRow as VocabularyRow);
  const rating = input.isCorrect ? Rating.Good : Rating.Again;
  const result = applyReview({ card, rating, module: input.module, reviewedAt: new Date() });

  const payload = cardToUpdatePayload(result.card);
  const { error: updateError } = await client
    .from('vocabularies')
    .update(payload)
    .eq('id', (vocabRow as VocabularyRow).id);
  if (updateError) return { ok: false, error: updateError.message };

  // audit 기록 — module enum 미확장 시 실패 가능 → 조용히 흡수(카드 갱신은 이미 유효).
  try {
    const { error: recErr } = await client
      .from('learning_records')
      .insert(resultToRecordPayload(result, user.id));
    if (recErr) return { ok: true, updated: true }; // audit 실패는 비치명
  } catch {
    return { ok: true, updated: true };
  }

  return { ok: true, updated: true };
}
