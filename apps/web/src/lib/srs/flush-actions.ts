// apps/web/src/lib/srs/flush-actions.ts
// 세션 종료 시 sessionStorage SRS 큐 → Supabase 영속화 (server action).
//
// 정책 (§17.4 기억 축):
// - 단어 텍스트로 (user_id, word) vocabularies 조회 — cardId 는 모듈마다 의미가 달라
//   (shared_words.id / vocabularies.id / 정규화 단어) 신뢰 불가 → WordBlitz 패턴 재사용.
// - 서버 권위 재계산: 클라이언트 cardUpdate 무시, 실제 DB row 의 D/S 에 applyReview 적용
//   (scoped 단어는 empty card 로 시작 → 클라 payload 신뢰 시 진행도 리셋됨).
// - 사용자 vocabularies 에 없는 단어(mock/보충) → silent skip.
// - vocabularies.update + learning_records.insert 동시.

'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { applyReview } from '@/lib/srs';
import type { ModuleId, RatingValue, SrsCard } from '@/lib/srs';
import {
  rowToCard,
  cardToUpdatePayload,
  resultToRecordPayload,
} from '@/lib/srs/supabase-adapter';
import type {
  VocabularyRow,
  LearningRecordPayload,
} from '@/lib/srs/supabase-adapter';
import type { FlushItem, FlushResult } from './flush-types';

const VOCAB_COLS =
  'id, user_id, text_id, word, meaning, example_sentence, pronunciation, difficulty, stability, last_review_at, next_review_at, module_history, review_count, created_at';

function clampRating(r: number): RatingValue {
  const n = Math.round(r);
  return (n < 1 ? 1 : n > 4 ? 4 : n) as RatingValue;
}

/**
 * 큐에 쌓인 SRS 평가 결과를 DB 로 일괄 영속화.
 * 멱등하지 않으므로(같은 항목 두 번 보내면 두 번 적용) 호출 측이 성공 후 큐를 비워야 한다.
 */
export async function flushPendingSrsResults(
  items: FlushItem[],
): Promise<FlushResult> {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: true, persisted: 0, skipped: 0 };
  }

  const client = (await createClient()) as unknown as SupabaseClient;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다.' };

  const words = [
    ...new Set(
      items.map((i) => i.word?.toLowerCase()).filter((w): w is string => !!w),
    ),
  ];
  if (words.length === 0) return { ok: true, persisted: 0, skipped: 0 };

  const { data: rowData, error: fetchErr } = await client
    .from('vocabularies')
    .select(VOCAB_COLS)
    .eq('user_id', user.id)
    .in('word', words);
  if (fetchErr) return { ok: false, error: fetchErr.message };

  const byWord = new Map<string, VocabularyRow>();
  for (const r of (rowData ?? []) as VocabularyRow[]) {
    byWord.set(r.word.toLowerCase(), r);
  }

  // 시간순 — 같은 단어를 한 세션에서 여러 번 평가했으면 순서대로 누적 적용.
  const sorted = [...items].sort((a, b) =>
    a.reviewedAt.localeCompare(b.reviewedAt),
  );
  const running = new Map<string, SrsCard>();
  const records: LearningRecordPayload[] = [];
  let persisted = 0;
  let skipped = 0;

  for (const it of sorted) {
    const key = it.word?.toLowerCase();
    if (!key) {
      skipped += 1;
      continue;
    }
    const row = byWord.get(key);
    if (!row) {
      // 사용자 vocabularies 에 없는 단어(mock/챕터 보충) → silent skip.
      skipped += 1;
      continue;
    }
    const card = running.get(key) ?? rowToCard(row);
    const result = applyReview({
      card,
      rating: clampRating(it.rating),
      module: it.module as ModuleId,
      reviewedAt: new Date(it.reviewedAt),
    });
    running.set(key, result.card);
    records.push(resultToRecordPayload(result, user.id));
    persisted += 1;
  }

  // 단어별 최종 카드 1회 update.
  for (const [key, card] of running) {
    const row = byWord.get(key);
    if (!row) continue;
    const { error: upErr } = await client
      .from('vocabularies')
      .update(cardToUpdatePayload(card))
      .eq('id', row.id);
    if (upErr) return { ok: false, error: upErr.message };
  }

  // 학습 기록(audit) 일괄 insert.
  if (records.length > 0) {
    const { error: insErr } = await client
      .from('learning_records')
      .insert(records);
    if (insErr) return { ok: false, error: insErr.message };
  }

  // known_word_count 캐시 재계산 (LingQ형 Implicit Progress · stability>=21).
  // 세션당 1회 · 실패해도 flush 결과에 영향 없음(부가 집계).
  if (persisted > 0) {
    try {
      await client.rpc('refresh_user_known_word_count', { p_user_id: user.id });
    } catch {
      /* known-word 캐시 갱신 실패는 학습 영속화를 막지 않음 */
    }
  }

  return { ok: true, persisted, skipped };
}
