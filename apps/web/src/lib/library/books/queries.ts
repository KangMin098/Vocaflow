// apps/web/src/lib/library/books/queries.ts
//
// 도서 컨텍스트 챕터 단어장 Server 쿼리.
// - fetchBookChapterSets: 도서별 챕터 단어장 (curation_query->>'book_id' 매칭, GIN 인덱스 활용)
// - fetchBookWordSetSubscriptionStats: workspace UnifiedHeader chip 용 구독 통계

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import type { PublishedVocabSet } from '@/lib/library/vocab/queries'

type DB = Database

/**
 * 도서별 챕터 단어장 — chapter_idx ASC 정렬. PublishedVocabSet 호환 형태로 반환.
 */
export async function fetchBookChapterSets(
  supabase: SupabaseClient<DB>,
  bookId: string,
): Promise<(PublishedVocabSet & { chapterIdx: number; curationQuery: Record<string, unknown> })[]> {
  const { data, error } = await supabase
    .from('shared_word_sets')
    .select(
      'id, title, description, category, cefr_level, cover_emoji, sort_order, word_count, created_at, curation_query',
    )
    .eq('is_published', true)
    .eq('category', 'library_book')
    .eq('curation_query->>book_id', bookId)

  if (error) throw error
  const rows = (data ?? []) as {
    id: string
    title: string
    description: string | null
    category: string
    cefr_level: string | null
    cover_emoji: string | null
    sort_order: number | null
    word_count: number | null
    created_at: string | null
    curation_query: Record<string, unknown>
  }[]

  if (rows.length === 0) return []

  // 실측 단어 수 보정 — word_count 캐시 stale 방지
  const ids = rows.map((r) => r.id)
  const { data: words, error: wErr } = await supabase
    .from('shared_words')
    .select('set_id')
    .in('set_id', ids)
  if (wErr) throw wErr
  const counts = new Map<string, number>()
  for (const w of words ?? []) {
    counts.set(w.set_id, (counts.get(w.set_id) ?? 0) + 1)
  }

  return rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category as PublishedVocabSet['category'],
      categoryNode: null,
      additionalCategoryIds: [],
      cefrLevel: r.cefr_level,
      coverEmoji: r.cover_emoji,
      sortOrder: r.sort_order ?? 0,
      wordCount: counts.get(r.id) ?? r.word_count ?? 0,
      createdAt: r.created_at ?? new Date(0).toISOString(),
      chapterIdx: Number(r.curation_query?.chapter_idx ?? 0),
      curationQuery: r.curation_query ?? {},
    }))
    .sort((a, b) => a.chapterIdx - b.chapterIdx)
}

/**
 * 도서의 챕터 단어장 구독 통계 — Workspace UnifiedHeader chip 용.
 * subscribed: 사용자가 구독한 챕터 단어장 수
 * total: 도서의 전체 챕터 단어장 수
 * 비로그인 / library_book 단어장 없는 도서 → null 반환.
 */
export async function fetchBookWordSetSubscriptionStats(
  supabase: SupabaseClient<DB>,
  bookId: string,
  userId: string | null,
): Promise<{ subscribed: number; total: number } | null> {
  const { data: sets, error } = await supabase
    .from('shared_word_sets')
    .select('id')
    .eq('is_published', true)
    .eq('category', 'library_book')
    .eq('curation_query->>book_id', bookId)

  if (error) throw error
  const setIds = ((sets ?? []) as { id: string }[]).map((s) => s.id)
  const total = setIds.length
  if (total === 0) return null

  if (!userId) return { subscribed: 0, total }

  const { data: subs, error: sErr } = await supabase
    .from('user_word_set_subscriptions')
    .select('set_id')
    .eq('user_id', userId)
    .in('set_id', setIds)

  if (sErr) throw sErr
  return { subscribed: (subs ?? []).length, total }
}
