// apps/web/src/lib/game/record-result.ts
// 게임 공용 결과 레코더 — 단어 인출 결과 → vocabularies FSRS 갱신 + learning_records audit.
// recordWordBlitzResult 를 module 파라미터로 일반화(6종 아케이드 게임 공용).
//
// 정책(WordBlitz 계승):
// - 정답 → Rating.Good · 오답 → Rating.Again
// - 사용자 vocabularies 에 없는 단어(기본 풀·보충 단어) → 카드 갱신 없음.
//   **더 이상 silent 하지 않다** — `reason: 'not-mine'` 을 반환한다(v08.5).
//   실측 97.9% 가 이 경로였고, 이유를 뭉쳐 두는 동안 팀이 게임별로 각자 우회했다.
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
  /**
   * 정답을 이미 보여준 뒤의 입력인가(힌트 구매 · 리빌 직후 재출제 · 자동 pass 등).
   * true 면 **카드를 갱신하지 않는다** — 인출이 아니라 재인이므로 FSRS 에 올리면 거짓 신호다.
   *
   * v07.8 적대적 감사에서 이 경로가 여러 게임에서 실제로 열려 있었다:
   * ghost-race 는 오답 단어를 리빌 직후 3칸 뒤에 되돌려주고 그 정답을 onCorrect 로 올렸고,
   * letter-forge 는 힌트로 산 정답에 콤보·크레딧을 줬다.
   */
  assisted?: boolean;
}

/**
 * 같은 카드를 이 시간 안에 다시 채점하지 않는다.
 *
 * FSRS 는 "독립적 인출 1회"를 전제로 stability 를 갱신한다. 그런데 아케이드 게임은
 * 한 세션(2~4분) 안에 같은 단어를 여러 번 낸다 — 적대적 감사 실측: ghost-race 는
 * 레이스당 36회 채점(풀 6개면 단어당 평균 6회), word-economy 는 방치만 해도 90초에
 * 같은 카드 2장에 lapse 7회. 전부 진짜 인출로 기록돼 스케줄이 망가진다.
 *
 * 세션 길이 + 연속 플레이를 덮도록 10분. 이 창 안의 재출제는 게임 안에서는 정상적인
 * 반복 학습이되(점수·콤보는 그대로), **학습 스케줄에는 반영하지 않는다**.
 */
const REGRADE_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * 카드를 갱신하지 **않은** 이유. 셋은 성격이 전혀 다르다.
 *
 *   not-mine  학습자 vocabularies 에 없는 단어 — **결합 실패**. 실측 97.9%
 *             (내 단어 225개 vs 세트 단어 56,079개 · 628세트 기준 겹침 2.1%).
 *             세트로 들어와 플레이했는데 복습 일정에는 아무것도 남지 않는다.
 *   assisted  정답을 보여준 뒤의 입력 — 인출이 아니므로 올리면 거짓 신호다(v07.8 가드).
 *   cooldown  10분 안의 재채점 — 독립 인출이 아니다(v07.8 가드).
 *
 * 뒤의 둘은 **의도된 무결성 가드**이고 앞의 하나만 결함이다. 이전에는 셋이 모두
 * `{ ok: true, updated: false }` 로 뭉쳐 있어서 구별할 방법이 없었고, 그래서 팀이
 * 게임별로 각자 우회했다(morpheme-bank.ts · morph-bank.ts · due-words.ts · catalog.tsx 의
 * 주석들이 같은 문제를 따로 적고 있다). 중앙에서 이유를 말하면 우회가 필요 없다.
 */
export type RecordSkipReason = 'not-mine' | 'assisted' | 'cooldown';

export type RecordResult =
  | { ok: true; updated: true }
  | { ok: true; updated: false; reason: RecordSkipReason }
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
  if (!vocabRow) return { ok: true, updated: false, reason: 'not-mine' };

  // ── FSRS 무결성 가드 (v07.8) ──────────────────────────────────────────
  // 게임 점수·콤보는 게임이 알아서 하되, **학습 스케줄에 올릴 자격**은 여기서 판정한다.
  // 게임마다 각자 판단하게 두면 19가지 기준이 생기고, 실제로 그래서 새고 있었다.

  // ① 정답을 보여준 뒤의 입력은 인출이 아니다.
  if (input.assisted) return { ok: true, updated: false, reason: 'assisted' };

  // ② 같은 카드를 방금 채점했다면 이번 것은 독립 인출이 아니다.
  const lastAt = (vocabRow as VocabularyRow).last_review_at;
  if (lastAt) {
    const since = Date.now() - new Date(lastAt).getTime();
    if (since >= 0 && since < REGRADE_COOLDOWN_MS) return { ok: true, updated: false, reason: 'cooldown' };
  }

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
