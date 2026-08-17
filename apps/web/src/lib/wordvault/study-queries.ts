// apps/web/src/lib/wordvault/study-queries.ts
//
// /wordvault/study 풀스크린 세션용 Server-only 쿼리.
// browse 와 달리 "복습이 급한 단어 먼저" — next_review_at 임박순(new/미복습 먼저) + 세션 cap.
// 어댑터(vocabRowToWord)·VocabRow 타입은 browse-queries 재사용 (단일 출처).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import type { VocabRow } from './browse-queries'

/** 한 학습 세션에서 제시할 단어 상한 (Cognitive Load — 한 세션 과부하 방지). */
export const STUDY_SESSION_CAP = 50

/**
 * 학습 세션 단어 — due 우선.
 * 정렬: next_review_at ASC (nullsFirst — 아직 복습 예정이 없는 new/미복습 단어를 먼저),
 *       그 다음 가장 오래 지난(=가장 급한) 단어. cap STUDY_SESSION_CAP.
 *
 * ⚠️ **`due` 로 필터하지 않는다** — "가장 급한 50개" 이지 "오늘 due 인 것" 이 아니다.
 * 그래서 세션 길이는 SRS 상태로 조절되지 않는다: `next_review_at` 을 미래로 밀어도
 * 그 단어는 뒤로 갈 뿐 세션에서 빠지지 않고, 총수가 cap 을 넘으면 언제나 50장이 온다.
 * (`05-learner-loop` 이 "3장만 due 로 만들면 3장 세션" 이라 가정했다가 두 번 죽었다 —
 *  실측 2026-08-17. 길이가 필요하면 라우트의 `?limit=N` 을 쓴다.)
 */
export async function fetchStudyVocabularies(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<VocabRow[]> {
  const { data, error } = await supabase
    .from('vocabularies')
    .select(
      'id, word, meaning, example_sentence, pronunciation, pos, cefr_level, difficulty, stability, last_review_at, next_review_at, module_history, review_count, text_id, shared_set_id, created_at',
    )
    .eq('user_id', userId)
    .order('next_review_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(STUDY_SESSION_CAP)
  if (error) throw error
  return (data ?? []) as VocabRow[]
}
