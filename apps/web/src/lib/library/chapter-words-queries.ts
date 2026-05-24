// apps/web/src/lib/library/chapter-words-queries.ts
// Phase 11.7 — chapter 단어 enrichment 데이터 fetch
//
// library_book_vocabularies + shared_dictionary LEFT JOIN
// LV 상위 N개만 (default 30, 성능 + 학습 집중)

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ChapterWord {
  word: string;
  meaning: string | null;
  pos: string | null;
  cefrLevel: string | null;
  /** VRL v3 V-Level 0~11 (한국 학습자 로드맵). null = 미분류. */
  vLevel: number | null;
  exampleSentence: string | null;
  baseLearningValue: number;
  frequencyInChapter: number;
}

export async function getChapterWords(
  client: SupabaseClient,
  libraryBookId: string,
  chapterIdx: number,
  limit = 30,
): Promise<ChapterWord[]> {
  const { data: lbvData, error: lbvError } = await client
    .from('library_book_vocabularies')
    .select('word, first_sentence, base_learning_value, frequency_in_chapter')
    .eq('library_book_id', libraryBookId)
    .eq('chapter_idx', chapterIdx)
    .order('base_learning_value', { ascending: false })
    .limit(limit);

  if (lbvError) {
    console.error('[getChapterWords] lbv fetch failed:', lbvError.message);
    return [];
  }

  const lbvRows = (lbvData ?? []) as Array<{
    word: string;
    first_sentence: string | null;
    base_learning_value: number;
    frequency_in_chapter: number;
  }>;

  if (lbvRows.length === 0) return [];

  const words = lbvRows.map((r) => r.word);
  const { data: dictData } = await client
    .from('shared_dictionary')
    .select('word, meaning_ko, pos, cefr_level, v_level')
    .in('word', words);

  const dictMap = new Map<
    string,
    {
      meaning: string | null;
      pos: string | null;
      cefr_level: string | null;
      v_level: number | null;
    }
  >();
  for (const d of (dictData ?? []) as Array<{
    word: string;
    meaning_ko: string | null;
    pos: string | null;
    cefr_level: string | null;
    v_level: number | null;
  }>) {
    dictMap.set(d.word, {
      meaning: d.meaning_ko,
      pos: d.pos,
      cefr_level: d.cefr_level,
      v_level: d.v_level,
    });
  }

  return lbvRows.map((r) => {
    const dict = dictMap.get(r.word);
    return {
      word: r.word,
      meaning: dict?.meaning ?? null,
      pos: dict?.pos ?? null,
      cefrLevel: dict?.cefr_level ?? null,
      vLevel: dict?.v_level ?? null,
      exampleSentence: r.first_sentence,
      baseLearningValue: r.base_learning_value,
      frequencyInChapter: r.frequency_in_chapter,
    };
  });
}
