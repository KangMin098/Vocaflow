// apps/web/src/lib/flashcard/scoped-words.ts
//
// 워크스페이스 "카드" pill → /flashcard/play?set=… | ?text=… 진입 시
// 현재 자료의 단어를 FlashcardWord[] 로 변환 (mock 대체).
// 쿼리는 lib/workspace/scoped-words.fetchScopedWords 단일 출처 — 여기선 adapt 만.

import type { SupabaseClient } from '@supabase/supabase-js'

import { createNewCard } from '@/lib/srs'
import { createInitialSRS } from '@/lib/srs/sm2'
import { fetchScopedWords } from '@/lib/workspace/scoped-words'
import { blankSurface } from '@/lib/text/surface-match'
import { fetchDictExtras } from '@/lib/flashcard/dict-extras'
import type { FlashcardWord } from '@/types/flashcard'

export interface ScopedFlashcardResult {
  words: FlashcardWord[]
  title: string
  subtitle: string
}

/** 예문에서 학습 단어를 ___ 로 치환 (사전 굴절형 + 규칙 인식 · 첫 1회). */
function withBlank(example: string, word: string, forms?: string[]): string {
  if (!example || !word) return example
  // 예문이 원문 문장이라 굴절형(running·was·went 등)이 올 수 있어 inflection-aware 치환.
  return blankSurface(example, word, forms)
}

export async function fetchScopedFlashcardWords(
  client: SupabaseClient,
  scope: { set?: string; text?: string; chapter?: number | null; userId: string | null },
): Promise<ScopedFlashcardResult | null> {
  const res = await fetchScopedWords(client, scope)
  if (!res) return null

  // 사전 부가정보(연어+다의어+어원) 배치 보강 — hub-words 와 공용 헬퍼. 실패해도 렌더 무영향.
  const extras = await fetchDictExtras(
    client,
    res.words.map((w) => w.word),
  )

  const words: FlashcardWord[] = res.words.map((w) => {
    const ex = extras.get(w.word.toLowerCase())
    return {
      id: w.id,
      text: w.word,
      meaning: w.meaning,
      pronunciation: w.pronunciation,
      pos: w.pos,
      exampleSentence: w.example,
      exampleSentenceWithBlank: withBlank(w.example, w.word, w.inflectedForms),
      inflectedForms: w.inflectedForms,
      collocations: ex?.collocations,
      senses: ex?.senses,
      roots: ex?.roots,
      mnemonic: ex?.mnemonic,
      textId: w.id,
      textTitle: res.title,
      textChapter: res.chapterLabel,
      ...(w.illustrationUrl ? { illustrationUrl: w.illustrationUrl } : {}),
      srs: createInitialSRS(),
      srsV2: createNewCard(w.id),
    }
  })

  return { words, title: res.title, subtitle: res.subtitle }
}
