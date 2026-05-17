// apps/web/src/lib/library/vocab/queries.ts
//
// 공용 단어장(/library/vocab) Server-only 쿼리.
// - fetchPublishedSets: 게시된 세트 + 실제 단어 수(캐시 stale 보정) 머지
// - fetchUserSubscriptions: 현재 사용자가 구독한 set_id 집합
// - fetchSetSampleWords: 미리보기 단어 N개

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

type DB = Database

export type VocabCategory =
  | 'elementary'
  | 'middle'
  | 'high'
  | 'csat'
  | 'eng_test'
  | 'civil'
  | 'business'
  | 'themed'

export interface PublishedVocabSet {
  id: string
  title: string
  description: string | null
  category: VocabCategory
  cefrLevel: string | null
  coverEmoji: string | null
  sortOrder: number
  /** shared_words 실측 단어 수 (캐시 word_count 가 stale 한 경우 보정). */
  wordCount: number
  createdAt: string
}

export interface SamplePreviewWord {
  word: string
  meaningKo: string
  partOfSpeech: string | null
  cefrLevel: string | null
}

/**
 * 게시된 공용 단어장 전체. RLS 가 anon SELECT 를 허용하므로 로그인 여부 무관.
 * word_count 캐시가 stale 한 경우가 있어 shared_words 실측 count 와 머지.
 */
export async function fetchPublishedSets(
  supabase: SupabaseClient<DB>,
): Promise<PublishedVocabSet[]> {
  const { data: sets, error } = await supabase
    .from('shared_word_sets')
    .select('id, title, description, category, cefr_level, cover_emoji, sort_order, word_count, created_at')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!sets || sets.length === 0) return []

  // 실측 단어 수 보정 — id IN (...) 한 번에 가져와 set_id 별 집계
  const ids = sets.map((s) => s.id)
  const { data: words, error: wErr } = await supabase
    .from('shared_words')
    .select('set_id')
    .in('set_id', ids)

  if (wErr) throw wErr

  const counts = new Map<string, number>()
  for (const row of words ?? []) {
    counts.set(row.set_id, (counts.get(row.set_id) ?? 0) + 1)
  }

  return sets.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    category: s.category as VocabCategory,
    cefrLevel: s.cefr_level,
    coverEmoji: s.cover_emoji,
    sortOrder: s.sort_order ?? 0,
    wordCount: counts.get(s.id) ?? s.word_count ?? 0,
    createdAt: s.created_at ?? new Date(0).toISOString(),
  }))
}

/**
 * 현재 사용자가 구독한 set_id 집합. 비로그인 시 빈 Set.
 */
export async function fetchUserSubscriptions(
  supabase: SupabaseClient<DB>,
  userId: string | null,
): Promise<Set<string>> {
  if (!userId) return new Set()
  const { data, error } = await supabase
    .from('user_word_set_subscriptions')
    .select('set_id')
    .eq('user_id', userId)

  if (error) throw error
  return new Set((data ?? []).map((r) => r.set_id))
}

/**
 * 미리보기용 샘플 단어 N개. RLS 에 의해 게시된 세트의 단어만 SELECT.
 */
export async function fetchSetSampleWords(
  supabase: SupabaseClient<DB>,
  setId: string,
  limit = 10,
): Promise<SamplePreviewWord[]> {
  const { data, error } = await supabase
    .from('shared_words')
    .select('word, meaning_ko, part_of_speech, cefr_level')
    .eq('set_id', setId)
    .order('sort_order', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((r) => ({
    word: r.word,
    meaningKo: r.meaning_ko,
    partOfSpeech: r.part_of_speech,
    cefrLevel: r.cefr_level,
  }))
}
