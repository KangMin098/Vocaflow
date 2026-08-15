// apps/web/src/lib/library/books/queries.ts
//
// 도서 컨텍스트 챕터 단어장 Server 쿼리.
// - fetchBookChapterSets: 도서별 챕터 단어장 (curation_query->>'book_id' 매칭, GIN 인덱스 활용)
// - fetchBookComposerSets: 이 책에서 만든 컴포저 단어장 (curation_query->>'source_book_id')
// - fetchBookWordSetSubscriptionStats: workspace UnifiedHeader chip 용 구독 통계
//
// ⚠️ 두 키를 섞지 말 것: `book_id` 는 **챕터 세트 전용** 판정 키다(구독 시 commit_chapter_vocab
// RPC 로 분기한다). 컴포저 세트는 `source_book_id` 를 쓴다 — 같은 키를 쓰면 챕터 목록에
// chapter_idx=0 으로 끼어들어 구독 경로가 엉킨다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import type { PublishedVocabSet } from '@/lib/library/vocab/queries'
import { setKindOf } from '@/lib/library/vocab/set-kind'

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
      subscriberCount: 0, // 도서 챕터 세트 — 컨텍스트상 인기도 미표시
      createdAt: r.created_at ?? new Date(0).toISOString(),
      kind: null,
      coverImageUrl: null,
      coverImageMeta: null,
      chapterIdx: Number(r.curation_query?.chapter_idx ?? 0),
      curationQuery: r.curation_query ?? {},
    }))
    .sort((a, b) => a.chapterIdx - b.chapterIdx)
}

/** 컴포저가 이 책으로 만든 단어장 — 챕터 세트가 아닌 것들. */
export interface BookComposerSet extends PublishedVocabSet {
  /** blueprint id (unlock · recycle · book-companion …) */
  blueprint: string
  /** 학습자에게 이 단어장이 왜 있는지 한 줄 — 지표가 아니라 사람의 말 */
  why: string
}

/**
 * 학습자 말로 옮긴 "이 단어장이 왜 있나".
 *
 * 어드민 화면은 "해금 문장 201 vs 빈도순 23" 을 보지만, 학습자에게 필요한 것은 대조군이 아니라
 * **이걸 하면 무엇이 달라지는지**다. 그래서 증거 수치 중 학습자가 체감하는 것 하나만 문장에 넣는다.
 */
export function composerSetWhy(
  blueprint: string,
  wordCount: number,
  cq: Record<string, unknown>,
): string {
  const evidence = cq['evidence'] as
    | { sentence_unlock?: { ours: number; total: number }; future_encounters?: { ours_mean: number } }
    | null
    | undefined
  const coverage = cq['coverage'] as { achieved?: number } | null | undefined

  switch (blueprint) {
    case 'unlock': {
      const opened = evidence?.sentence_unlock?.ours
      if (opened && opened > 0) {
        return `이 ${wordCount}단어를 알면 이 책의 문장 ${opened.toLocaleString()}개가 온전히 읽혀요`
      }
      if (coverage?.achieved) {
        return `이 책 낱말의 ${Math.round(coverage.achieved * 100)}% 를 덮는 순서로 골랐어요`
      }
      return '이 책의 문장이 가장 빨리 읽히게 되는 순서로 골랐어요'
    }
    case 'recycle':
      // 평균 재등장 횟수(실측 143)를 그대로 쓰면 "143번 더 만나요" 가 되어 과장처럼 읽힌다.
      // 고빈도 책 단어라 산술은 맞지만, 숫자 게이지 대신 **무엇이 달라지는지**를 말한다.
      return '배운 뒤 이 책에서 다시 만나는 단어부터예요 · 책이 대신 복습해 줘요'
    case 'book-companion':
      return '이 책에 실제로 나오는 단어만 모았어요 · 예문도 이 책의 문장이에요'
    case 'chapter-companion':
      return '지금 읽을 챕터 범위에만 집중한 목록이에요'
    default:
      return '이 책에서 만든 단어장이에요'
  }
}

export async function fetchBookComposerSets(
  supabase: SupabaseClient<DB>,
  bookId: string,
): Promise<BookComposerSet[]> {
  const { data, error } = await supabase
    .from('shared_word_sets')
    .select(
      'id, title, description, category, cefr_level, cover_emoji, sort_order, word_count, subscriber_count, created_at, curation_query',
    )
    .eq('is_published', true)
    .eq('curation_query->>source_book_id', bookId)

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
    subscriber_count: number | null
    created_at: string | null
    curation_query: Record<string, unknown>
  }[]

  if (rows.length === 0) return []

  // 실측 단어 수 보정 — word_count 캐시가 stale 할 수 있다 (챕터 세트와 같은 규칙).
  const ids = rows.map((r) => r.id)
  const { data: words, error: wErr } = await supabase
    .from('shared_words')
    .select('set_id')
    .in('set_id', ids)
  if (wErr) throw wErr
  const counts = new Map<string, number>()
  for (const w of words ?? []) counts.set(w.set_id, (counts.get(w.set_id) ?? 0) + 1)

  return rows
    .map((r): BookComposerSet => {
      const cq = r.curation_query ?? {}
      const blueprint = String(cq['blueprint'] ?? '')
      const wordCount = counts.get(r.id) ?? r.word_count ?? 0
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category as PublishedVocabSet['category'],
        categoryNode: null,
        additionalCategoryIds: [],
        cefrLevel: r.cefr_level,
        coverEmoji: r.cover_emoji,
        sortOrder: r.sort_order ?? 0,
        wordCount,
        subscriberCount: r.subscriber_count ?? 0,
        createdAt: r.created_at ?? new Date(0).toISOString(),
        kind: setKindOf(blueprint),
        coverImageUrl: null,
        coverImageMeta: null,
        blueprint,
        why: composerSetWhy(blueprint, wordCount, cq),
      }
    })
    // 해금 → 재등장 → 나머지. 읽기 직전에 값나가는 순서다.
    .sort((a, b) => {
      const rank = (b: string): number => (b === 'unlock' ? 0 : b === 'recycle' ? 1 : 2)
      return rank(a.blueprint) - rank(b.blueprint) || a.title.localeCompare(b.title)
    })
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
