// apps/web/src/lib/spellforge/hub-words.ts
//
// /spellforge/play hub 진입 → 사용자 SRS 큐의 due 단어를 SpellForgeWord[] 로 (mock 대체).
// flashcard hub-words 와 동일 패턴 — study-queries(due 우선 + cap) 재사용.
// status(메모리 4색)는 rowToCard → getMemoryState SSoT 로 계산.
// 영속화는 SpellForge 컴포넌트가 pushPendingResult → flushPendingSession 으로 처리.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { getMemoryState } from '@/lib/srs/state'
import { rowToCard, type VocabularyRow } from '@/lib/srs/supabase-adapter'
import { fetchStudyVocabularies } from '@/lib/wordvault/study-queries'
import type { SpellForgeWord } from '@/types/spellforge'

/**
 * hub 진입 SpellForge 단어 — 사용자 vocabularies due 우선.
 * 빈 배열이면 호출부에서 빈 상태 안내(mock 폴백 금지).
 */
export async function fetchDueSpellForgeWords(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<SpellForgeWord[]> {
  const rows = await fetchStudyVocabularies(client, userId)

  return rows.map((r) => {
    const card = rowToCard(r as unknown as VocabularyRow)
    return {
      id: r.id,
      text: r.word,
      meaning: r.meaning ?? '',
      pronunciation: r.pronunciation ?? '',
      pos: r.pos ?? '',
      status: getMemoryState(card),
      exampleSentence: r.example_sentence ?? '',
    } satisfies SpellForgeWord
  })
}
