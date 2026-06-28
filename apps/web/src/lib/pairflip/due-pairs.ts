// apps/web/src/lib/pairflip/due-pairs.ts
//
// PairFlip play 진입 → 사용자 SRS 큐의 due 단어를 PairFlipMockWord[] 로 (mock 대체).
// 클라이언트 컴포넌트(/pairflip/play)에서 호출 — 브라우저 supabase client 사용.
// pairId = vocabularies.id → 매칭 결과(pairResult.word) flush 시 (user_id, word) lookup 으로 영속화.
//
// 주의: 충분한 due 단어가 없으면(레벨 pairCount 미만) 호출부가 mock 으로 폴백 — 게임 win-condition 보존.

import type { SupabaseClient } from '@supabase/supabase-js'

import type { PairFlipMockWord } from '@/components/pairflip/mock-data'

/** PairFlip 최대 레벨(Master)이 10쌍 — 그 이상 fetch 불필요. */
export const PAIRFLIP_MAX_PAIRS = 10

/**
 * 사용자 vocabularies due 우선(next_review_at 임박순) → PairFlipMockWord[].
 * meaning 이 빈 단어는 매칭 게임에 부적합하므로 제외.
 */
export async function fetchDuePairs(
  client: SupabaseClient,
  userId: string,
  limit: number = PAIRFLIP_MAX_PAIRS,
): Promise<PairFlipMockWord[]> {
  const { data, error } = await client
    .from('vocabularies')
    .select('id, word, meaning, pronunciation, pos, next_review_at, created_at')
    .eq('user_id', userId)
    .not('meaning', 'is', null)
    .neq('meaning', '')
    .order('next_review_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error

  return (data ?? []).map((r) => ({
    pairId: r.id as string,
    word: r.word as string,
    meaning: (r.meaning as string) ?? '',
    partOfSpeech: (r.pos as string) ?? undefined,
    phonetic: (r.pronunciation as string) ?? undefined,
  }))
}
