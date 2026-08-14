// apps/web/src/lib/game/record-result.ts
// 게임 공용 결과 레코더 — 단어 인출 결과 → vocabularies FSRS 갱신 + learning_records audit.
// recordWordBlitzResult 를 module 파라미터로 일반화(6종 아케이드 게임 공용).
//
// 정책(WordBlitz 계승):
// - 정답 → Rating.Good · 오답 → Rating.Again
// - 사용자 vocabularies 에 없는 단어 → **먼저 담아 본다**(lazy 승격 · 결정 3 A안).
//   `content` 가 지금 놀고 있는 세트를 가리키고 그 세트에 그 단어가 실재하면 담고 이어간다.
//   담을 수 없으면(뱅크 단어·뜻 없음) 그때 `reason: 'not-mine'` — v08.5 의 B안(노출)은
//   사실을 알려주기만 하고 학습자에게 한 걸음을 더 요구했다. 실측 97.9% 가 이 경로였다.
// - learning_records.module / scores.module enum 미확장 시 audit insert 실패는
//   조용히 흡수(카드 SRS 갱신은 유효). enum 확장 마이그레이션 후 audit 완전 활성.

'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { applyReview, Rating } from '@/lib/srs';
import type { ModuleId } from '@/lib/srs';
import { rowToCard, cardToUpdatePayload, resultToRecordPayload } from '@/lib/srs/supabase-adapter';
import type { VocabularyRow } from '@/lib/srs/supabase-adapter';
import type { ContentRef } from '@/lib/content/content-ref';

export interface RecordGameResultInput {
  word: string;
  isCorrect: boolean;
  module: ModuleId;
  /**
   * 이 단어가 **어느 자료에서 왔는가** — lazy 승격의 자격 근거(결정 3 · A안).
   *
   * 없으면 승격하지 않는다. 게임 내장 뱅크(morpheme-bank·morph-bank 등)로 논 단어까지
   * 승격하면 학습자 단어장이 자기가 고른 적 없는 단어로 오염된다 — 그건 결합이 아니라 사고다.
   * `set` 스코프일 때만 그 세트 안에 실재하는 단어를 승격한다.
   */
  content?: ContentRef;
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
  /** promoted=true 면 이번 호출이 그 단어를 학습자 단어장에 **새로 담았다**(lazy 승격). */
  | { ok: true; updated: true; promoted?: boolean }
  // 승격했는데 가드(assisted·cooldown)에 걸려 카드는 안 올린 경우가 있다 —
  // 단어장에는 이미 담겼으므로 그 사실은 잃지 않는다.
  | { ok: true; updated: false; reason: RecordSkipReason; promoted?: boolean }
  | { ok: false; error: string };

/**
 * lazy 승격 — 플레이한 단어를 그 자리에서 내 단어로 담는다 (결정 3 · A안).
 *
 * 왜 A 인가: 세트와 학습자 단어가 실측 97.9% 어긋난다. 학습자는 공용 단어장을 열어
 * 게임을 하고 나면 "이 세트로 놀았으니 내 단어가 됐다" 를 기대하는데, 실제로는 복습
 * 일정에 아무것도 남지 않았다. B안(스킵 노출)은 그 사실을 **알려주기만** 하고 학습자에게
 * 한 걸음을 더 요구한다.
 *
 * 자격은 좁게 본다 — **지금 열어서 놀고 있는 그 세트 안에 실재하는 단어**만.
 *   · 구독 중인 전체 세트로 넓히지 않는다: 우연히 이름이 겹친 뱅크 단어가 딸려 들어온다.
 *   · meaning 이 없으면 담지 않는다: `vocabularies.meaning` 은 NOT NULL 이고, 뜻 없는
 *     카드는 복습에서 아무 의미가 없다(있으나 마나 한 카드를 만드는 게 더 나쁘다).
 *
 * 경합은 UNIQUE(user_id, word) 가 잡는다 — 같은 세션에서 같은 단어가 동시에 두 번
 * 들어오면 뒤엣것이 23505 로 실패하고, 호출부는 그 다음 조회에서 정상 경로를 탄다.
 */
async function promoteFromSet(
  client: SupabaseClient,
  userId: string,
  normalizedWord: string,
  setId: string,
): Promise<VocabularyRow | null> {
  const { data } = await client
    .from('shared_words')
    .select('word, lemma, meaning_ko, example_en, source_sentence, pronunciation, part_of_speech, cefr_level')
    .eq('set_id', setId)
    .ilike('word', normalizedWord)
    .limit(1)
    .maybeSingle();

  const src = data as {
    word: string;
    lemma: string | null;
    meaning_ko: string | null;
    example_en: string | null;
    source_sentence: string | null;
    pronunciation: string | null;
    part_of_speech: string | null;
    cefr_level: string | null;
  } | null;
  if (!src) return null;

  const meaning = (src.meaning_ko ?? '').trim();
  if (!meaning) return null;

  const base = {
    user_id: userId,
    word: normalizedWord,
    meaning,
    example_sentence: src.source_sentence ?? src.example_en ?? null,
    pronunciation: src.pronunciation ?? null,
    pos: src.part_of_speech ?? null,
    cefr_level: src.cefr_level ?? null,
    shared_set_id: setId,
    // 출처를 남긴다 — unenroll·정리 시 사용자가 직접 담은 단어와 구분되어야 한다
    // (unenroll_library_book 이 origin='shared_set' 만 지운다).
    origin: 'shared_set',
  };

  const insert = (row: Record<string, unknown>) =>
    client.from('vocabularies').insert(row).select(VOCAB_COLUMNS).single();

  // `vocabularies.lemma` 는 `shared_dictionary(word)` FK 다. 세트의 lemma 가 사전에
  // 없으면 INSERT 전체가 23503 으로 죽는다 — 부가 정보 하나 때문에 승격을 통째로 잃는다.
  // 그래서 붙여 보고, 실패하면 **lemma 없이 다시** 담는다(결합 키는 어차피 소문자 word 다).
  const first = await insert(src.lemma ? { ...base, lemma: src.lemma } : base);
  if (!first.error && first.data) return first.data as VocabularyRow;
  if (!src.lemma) return null;

  const retry = await insert(base);
  if (retry.error || !retry.data) return null;
  return retry.data as VocabularyRow;
}

const VOCAB_COLUMNS =
  'id, user_id, text_id, word, meaning, example_sentence, pronunciation, difficulty, stability, last_review_at, next_review_at, module_history, review_count, created_at';

export async function recordGameResult(
  input: RecordGameResultInput,
): Promise<RecordResult> {
  const client = (await createClient()) as unknown as SupabaseClient;

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다.' };

  const normalizedWord = input.word.toLowerCase();

  const { data: existing, error: fetchError } = await client
    .from('vocabularies')
    .select(VOCAB_COLUMNS)
    .eq('user_id', user.id)
    .eq('word', normalizedWord)
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };

  // 내 단어가 아니면 — 지금 놀고 있는 세트에서 담아 온다(lazy 승격). 담지 못하면 그때 not-mine.
  let vocabRow = existing as VocabularyRow | null;
  let promoted = false;
  if (!vocabRow) {
    const setId = input.content?.type === 'set' ? input.content.id : undefined;
    if (!setId) return { ok: true, updated: false, reason: 'not-mine' };
    vocabRow = await promoteFromSet(client, user.id, normalizedWord, setId);
    if (!vocabRow) return { ok: true, updated: false, reason: 'not-mine' };
    promoted = true;
  }

  // ── FSRS 무결성 가드 (v07.8) ──────────────────────────────────────────
  // 게임 점수·콤보는 게임이 알아서 하되, **학습 스케줄에 올릴 자격**은 여기서 판정한다.
  // 게임마다 각자 판단하게 두면 19가지 기준이 생기고, 실제로 그래서 새고 있었다.

  // ① 정답을 보여준 뒤의 입력은 인출이 아니다.
  if (input.assisted) return { ok: true, updated: false, reason: 'assisted', promoted };

  // ② 같은 카드를 방금 채점했다면 이번 것은 독립 인출이 아니다.
  const lastAt = vocabRow.last_review_at;
  if (lastAt) {
    const since = Date.now() - new Date(lastAt).getTime();
    if (since >= 0 && since < REGRADE_COOLDOWN_MS)
      return { ok: true, updated: false, reason: 'cooldown', promoted };
  }

  const card = rowToCard(vocabRow);
  const rating = input.isCorrect ? Rating.Good : Rating.Again;
  const result = applyReview({ card, rating, module: input.module, reviewedAt: new Date() });

  const payload = cardToUpdatePayload(result.card);
  const { error: updateError } = await client
    .from('vocabularies')
    .update(payload)
    .eq('id', vocabRow.id);
  if (updateError) return { ok: false, error: updateError.message };

  // audit 기록 — module enum 미확장 시 실패 가능 → 조용히 흡수(카드 갱신은 이미 유효).
  try {
    const { error: recErr } = await client
      .from('learning_records')
      .insert(resultToRecordPayload(result, user.id));
    if (recErr) return { ok: true, updated: true, promoted }; // audit 실패는 비치명
  } catch {
    return { ok: true, updated: true, promoted };
  }

  return { ok: true, updated: true, promoted };
}
