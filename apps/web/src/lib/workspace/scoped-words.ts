// apps/web/src/lib/workspace/scoped-words.ts
//
// 워크스페이스 ModePills(카드·블리츠 …) → 모듈 진입 시 현재 자료의 단어를 fetch.
// 모듈 무관 neutral shape — 각 모듈(Flashcard / WordBlitz)이 자기 타입으로 adapt.
//   · set  : 도서 챕터 shared_word_sets.id → shared_words (canonical · "단어" pill 과 동일 소스)
//   · text : 사용자 스크립트 texts.id      → vocabularies WHERE text_id (사용자 어휘 자산)
//
// 스코프 규칙은 page.tsx 의 wordsHref 와 정합 — 도서면 챕터 단어장, 스크립트면 그 텍스트.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ScopedWord {
  id: string
  word: string
  meaning: string
  pronunciation: string
  pos: string
  example: string
}

export interface ScopedWordsResult {
  words: ScopedWord[]
  /** ResourceContext / 빈 상태 라벨 */
  title: string
  subtitle: string
  /** 도서 챕터면 "Chapter N", 스크립트면 '' */
  chapterLabel: string
}

export async function fetchScopedWords(
  client: SupabaseClient,
  scope: { set?: string; text?: string; userId: string | null },
): Promise<ScopedWordsResult | null> {
  if (scope.set) return fetchBySet(client, scope.set)
  if (scope.text && scope.userId) return fetchByText(client, scope.text, scope.userId)
  return null
}

async function fetchBySet(
  client: SupabaseClient,
  setId: string,
): Promise<ScopedWordsResult | null> {
  const { data: setRow } = await client
    .from('shared_word_sets')
    .select('id, title, curation_query')
    .eq('id', setId)
    .maybeSingle()
  const set = setRow as {
    id: string
    title: string
    curation_query: Record<string, unknown> | null
  } | null
  if (!set) return null

  const { data, error } = await client
    .from('shared_words')
    .select('id, word, meaning_ko, example_en, pronunciation, part_of_speech')
    .eq('set_id', setId)
    .order('sort_order', { ascending: true })
  if (error) return null

  const rows = (data ?? []) as Array<{
    id: string
    word: string
    meaning_ko: string | null
    example_en: string | null
    pronunciation: string | null
    part_of_speech: string | null
  }>

  const chapterIdx = Number(set.curation_query?.['chapter_idx'] ?? 0)
  const words: ScopedWord[] = rows.map((r) => ({
    id: r.id,
    word: r.word,
    meaning: r.meaning_ko ?? '',
    pronunciation: r.pronunciation ?? '',
    pos: r.part_of_speech ?? '',
    example: r.example_en ?? '',
  }))

  return {
    words,
    title: set.title,
    subtitle: `${words.length}개 단어`,
    chapterLabel: chapterIdx > 0 ? `Chapter ${chapterIdx}` : '',
  }
}

async function fetchByText(
  client: SupabaseClient,
  textId: string,
  userId: string,
): Promise<ScopedWordsResult | null> {
  const { data: textRow } = await client
    .from('texts')
    .select('id, title')
    .eq('id', textId)
    .maybeSingle()
  const text = textRow as { id: string; title: string } | null

  const { data, error } = await client
    .from('vocabularies')
    .select('id, word, meaning, example_sentence, pronunciation, pos')
    .eq('user_id', userId)
    .eq('text_id', textId)
    .order('created_at', { ascending: true })
  if (error) return null

  const rows = (data ?? []) as Array<{
    id: string
    word: string
    meaning: string | null
    example_sentence: string | null
    pronunciation: string | null
    pos: string | null
  }>

  const title = text?.title ?? '내 스크립트'
  const words: ScopedWord[] = rows.map((r) => ({
    id: r.id,
    word: r.word,
    meaning: r.meaning ?? '',
    pronunciation: r.pronunciation ?? '',
    pos: r.pos ?? '',
    example: r.example_sentence ?? '',
  }))

  return { words, title, subtitle: `${words.length}개 단어`, chapterLabel: '' }
}
