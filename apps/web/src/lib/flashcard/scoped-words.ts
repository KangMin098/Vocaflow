// apps/web/src/lib/flashcard/scoped-words.ts
//
// 워크스페이스 "카드" pill → /flashcard/play?set=… | ?text=… 진입 시
// 현재 자료의 단어를 FlashcardWord[] 로 변환 (mock 대체).
// 쿼리는 lib/workspace/scoped-words.fetchScopedWords 단일 출처 — 여기선 adapt 만.

import type { SupabaseClient } from '@supabase/supabase-js'

import { createNewCard } from '@/lib/srs'
import { createInitialSRS } from '@/lib/srs/sm2'
import { fetchScopedWords } from '@/lib/workspace/scoped-words'
import type { FlashcardWord } from '@/types/flashcard'

export interface ScopedFlashcardResult {
  words: FlashcardWord[]
  title: string
  subtitle: string
}

/** 예문에서 학습 단어를 ___ 로 치환 (대소문자 무시, 첫 1회). */
function withBlank(example: string, word: string): string {
  if (!example || !word) return example
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return example.replace(new RegExp(`\\b${esc}\\b`, 'i'), '___')
}

export async function fetchScopedFlashcardWords(
  client: SupabaseClient,
  scope: { set?: string; text?: string; userId: string | null },
): Promise<ScopedFlashcardResult | null> {
  const res = await fetchScopedWords(client, scope)
  if (!res) return null

  const words: FlashcardWord[] = res.words.map((w) => ({
    id: w.id,
    text: w.word,
    meaning: w.meaning,
    pronunciation: w.pronunciation,
    pos: w.pos,
    exampleSentence: w.example,
    exampleSentenceWithBlank: withBlank(w.example, w.word),
    textId: w.id,
    textTitle: res.title,
    textChapter: res.chapterLabel,
    srs: createInitialSRS(),
    srsV2: createNewCard(w.id),
  }))

  return { words, title: res.title, subtitle: res.subtitle }
}
