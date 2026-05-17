// apps/web/src/lib/library/reader-queries.ts
// LCP v2.0 Phase 12.5 — Reader 컴포넌트가 사용할 chapter content lazy fetch
//
// 사용 패턴:
//   const chapterList = await listChapters(client, bookId);
//   const content = await getChapterContent(client, bookId, chapterIdx);

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ChapterListItem {
  chapter_idx: number
  chapter_title: string | null
  word_count: number
  paragraph_count: number
}

export interface ChapterContent {
  chapter_idx: number
  chapter_title: string | null
  content: string
  word_count: number
  paragraph_offsets: number[]
  sentence_offsets: number[]
}

export interface SampleWord {
  word: string
  base_learning_value: number
  first_sentence: string | null
  cefr_level: string | null
}

/**
 * 책의 모든 chapter list (메타만 — content 제외).
 * Reader 사이드바용.
 */
export async function listChapters(
  client: SupabaseClient,
  libraryBookId: string
): Promise<ChapterListItem[]> {
  const { data, error } = await client
    .from('library_chapters_master')
    .select('chapter_idx, chapter_title, word_count, paragraph_offsets')
    .eq('library_book_id', libraryBookId)
    .order('chapter_idx', { ascending: true })

  if (error) throw new Error(`listChapters failed: ${error.message}`)
  return (data ?? []).map((row) => {
    const r = row as {
      chapter_idx: number
      chapter_title: string | null
      word_count: number
      paragraph_offsets: number[] | null
    }
    return {
      chapter_idx: r.chapter_idx,
      chapter_title: r.chapter_title,
      word_count: r.word_count,
      paragraph_count: r.paragraph_offsets?.length ?? 0,
    }
  })
}

/**
 * 단일 chapter의 본문 + offset.
 * Reader pane이 chapter 클릭 시 호출.
 */
export async function getChapterContent(
  client: SupabaseClient,
  libraryBookId: string,
  chapterIdx: number
): Promise<ChapterContent | null> {
  // chapter master + content chunk JOIN
  const { data: master, error: masterError } = await client
    .from('library_chapters_master')
    .select(
      'chapter_idx, chapter_title, word_count, paragraph_offsets, sentence_offsets, content_hash'
    )
    .eq('library_book_id', libraryBookId)
    .eq('chapter_idx', chapterIdx)
    .maybeSingle()

  if (masterError) throw new Error(`getChapterContent master failed: ${masterError.message}`)
  if (!master) return null

  const m = master as {
    chapter_idx: number
    chapter_title: string | null
    word_count: number
    paragraph_offsets: number[]
    sentence_offsets: number[]
    content_hash: string
  }

  const { data: chunk, error: chunkError } = await client
    .from('content_chunks')
    .select('content')
    .eq('hash', m.content_hash)
    .maybeSingle()

  if (chunkError) throw new Error(`getChapterContent chunk failed: ${chunkError.message}`)
  if (!chunk) return null

  return {
    chapter_idx: m.chapter_idx,
    chapter_title: m.chapter_title,
    content: (chunk as { content: string }).content,
    word_count: m.word_count,
    paragraph_offsets: m.paragraph_offsets,
    sentence_offsets: m.sentence_offsets,
  }
}

/**
 * chapter의 LV 상위 N개 sample words.
 * admin-review 모드의 하이라이트 토글용.
 */
export async function getSampleWords(
  client: SupabaseClient,
  libraryBookId: string,
  chapterIdx: number,
  limit = 10
): Promise<SampleWord[]> {
  const { data, error } = await client
    .from('library_book_vocabularies')
    .select('word, base_learning_value, first_sentence')
    .eq('library_book_id', libraryBookId)
    .eq('chapter_idx', chapterIdx)
    .order('base_learning_value', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getSampleWords failed: ${error.message}`)

  // shared_dictionary lookup (CEFR level)
  const words = (data ?? []).map((r) => (r as { word: string }).word)
  if (words.length === 0) return []

  const { data: dict } = await client
    .from('shared_dictionary')
    .select('word, cefr_level')
    .in('word', words)

  const cefrMap = new Map<string, string | null>(
    (dict ?? []).map((d) => [
      (d as { word: string }).word,
      (d as { cefr_level: string | null }).cefr_level,
    ])
  )

  return (data ?? []).map((r) => {
    const row = r as {
      word: string
      base_learning_value: number
      first_sentence: string | null
    }
    return {
      word: row.word,
      base_learning_value: row.base_learning_value,
      first_sentence: row.first_sentence,
      cefr_level: cefrMap.get(row.word) ?? null,
    }
  })
}
