// apps/web/src/lib/pairflip/scoped-pairs.ts
//
// /pairflip/play?set=… | ?text=… (계획 launch) 진입 시 그 자료의 단어를 PairFlipMockWord[] 로.
// due-pairs 와 동일 형태 — lib/workspace/scoped-words.fetchScopedWords 단일 출처.
// meaning 빈 단어는 매칭 게임 부적합이라 제외(due-pairs 정합). 클라이언트에서 호출(browser client).

import type { SupabaseClient } from '@supabase/supabase-js'

import type { PairFlipMockWord } from '@/components/pairflip/mock-data'
import { fetchScopedWords } from '@/lib/workspace/scoped-words'

export async function fetchScopedPairs(
  client: SupabaseClient,
  scope: { set?: string; text?: string; userId: string | null },
): Promise<PairFlipMockWord[]> {
  const res = await fetchScopedWords(client, scope)
  if (!res) return []

  return res.words
    .filter((w) => w.meaning && w.meaning.trim().length > 0)
    .map((w) => ({
      pairId: w.id,
      word: w.word,
      meaning: w.meaning,
      partOfSpeech: w.pos || undefined,
      phonetic: w.pronunciation || undefined,
    }))
}
