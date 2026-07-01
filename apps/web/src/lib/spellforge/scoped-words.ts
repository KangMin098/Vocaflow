// apps/web/src/lib/spellforge/scoped-words.ts
//
// /spellforge/play?set=… | ?text=… 진입 시 그 자료의 단어를 SpellForgeWord[] 로.
// flashcard/scoped-words 와 동일 — lib/workspace/scoped-words.fetchScopedWords 단일 출처.
// scoped 단어는 자료 기준(SRS 카드 무관)이라 status='new'.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { fetchScopedWords } from '@/lib/workspace/scoped-words'
import type { SpellForgeWord } from '@/types/spellforge'

export interface ScopedSpellForgeResult {
  words: SpellForgeWord[]
  title: string
}

export async function fetchScopedSpellForgeWords(
  client: SupabaseClient,
  scope: { set?: string; text?: string; userId: string | null },
): Promise<ScopedSpellForgeResult | null> {
  const res = await fetchScopedWords(client, scope)
  if (!res) return null

  const words: SpellForgeWord[] = res.words.map((w) => ({
    id: w.id,
    text: w.word,
    meaning: w.meaning,
    pronunciation: w.pronunciation,
    pos: w.pos,
    status: 'new',
    exampleSentence: w.example,
  }))

  return { words, title: res.title }
}
