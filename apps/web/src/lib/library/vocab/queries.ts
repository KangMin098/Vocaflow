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

/**
 * dictionary_categories 노드 (v06.25 브릿지) — 새 카테고리 트리.
 * category_id 가 채워진 세트만 비-null. WordVault hub / library UI 의 새 라벨/이모지 출처.
 */
export interface VocabCategoryNode {
  id: string
  nameKo: string | null
  nameEn: string
  coverEmoji: string | null
  level: number
}

export interface PublishedVocabSet {
  id: string
  title: string
  description: string | null
  /** @deprecated v06.25 — `categoryNode` 우선 사용. legacy free-text fallback. */
  category: VocabCategory
  /** v06.25 신규 — dictionary_categories(566 트리) 매핑. null 이면 아직 매핑 안 됨. */
  categoryNode: VocabCategoryNode | null
  /** v06.25 신규 — 보조 카테고리 ID 배열 (gin 인덱스, dictionary_categories.id 참조). */
  additionalCategoryIds: string[]
  cefrLevel: string | null
  coverEmoji: string | null
  sortOrder: number
  /** shared_words 실측 단어 수 (캐시 word_count 가 stale 한 경우 보정). */
  wordCount: number
  /** 구독자 수 (denormalized · 사용빈도/인기 랭킹용). */
  subscriberCount: number
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
/**
 * SELECT 결과 raw row 타입 (v06.25 브릿지 컬럼 포함).
 * `Database` 자동 생성 타입에 `category_id` / `additional_category_ids` 가
 * 아직 없을 수 있어 (마이그레이션 적용 + `supabase gen types` 재생성 전), 로컬
 * 보강 타입을 정의 — 컬럼이 row 에 없을 경우 fallback 안전.
 */
interface SharedSetRow {
  id: string
  title: string
  description: string | null
  category: string
  cefr_level: string | null
  cover_emoji: string | null
  sort_order: number | null
  word_count: number | null
  subscriber_count?: number | null
  created_at: string | null
  category_id?: string | null
  additional_category_ids?: string[] | null
}

export async function fetchPublishedSets(
  supabase: SupabaseClient<DB>,
): Promise<PublishedVocabSet[]> {
  // subscriber_count 는 방금 추가된 컬럼 — database.ts 재생성 전이라 loose client 로 select
  const sb = supabase as unknown as SupabaseClient
  const { data, error } = await sb
    .from('shared_word_sets')
    .select(
      'id, title, description, category, cefr_level, cover_emoji, sort_order, word_count, subscriber_count, created_at, category_id, additional_category_ids',
    )
    .eq('is_published', true)
    // 소스 종속 자동생성 세트는 공용 단어장 영역에 노출 X — 각 소스 컨텍스트에서만.
    //   · library_book  : 도서 챕터 어휘 → /library/books · /admin/curation
    //   · library_article: 스크립트(글) 어휘 → 스크립트 컨텍스트 (저큐레이션·다수라 클러터)
    .neq('category', 'library_book')
    .neq('category', 'library_article')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    // 마이그레이션 미적용 환경에선 category_id/additional_category_ids 컬럼이 없어
    // 위 select 가 실패할 수 있음 — fallback 으로 legacy 컬럼만 fetch.
    const fallback = await sb
      .from('shared_word_sets')
      .select('id, title, description, category, cefr_level, cover_emoji, sort_order, word_count, subscriber_count, created_at')
      .eq('is_published', true)
      .neq('category', 'library_book')
      .neq('category', 'library_article')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    if (fallback.error) throw fallback.error
    return enrichSets(supabase, (fallback.data ?? []) as SharedSetRow[])
  }

  return enrichSets(supabase, (data ?? []) as unknown as SharedSetRow[])
}

async function enrichSets(
  supabase: SupabaseClient<DB>,
  sets: SharedSetRow[],
): Promise<PublishedVocabSet[]> {
  if (sets.length === 0) return []

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

  // category_id 노드 lookup (한 번에 fetch)
  const categoryIds = sets
    .map((s) => s.category_id)
    .filter((id): id is string => typeof id === 'string')
  const categoryNodeMap = new Map<string, VocabCategoryNode>()
  if (categoryIds.length > 0) {
    const { data: cats, error: cErr } = await supabase
      .from('dictionary_categories')
      .select('id, name_ko, name_en, cover_emoji, level')
      .in('id', categoryIds)
    if (cErr) throw cErr
    for (const c of cats ?? []) {
      categoryNodeMap.set(c.id, {
        id: c.id,
        nameKo: c.name_ko,
        nameEn: c.name_en,
        coverEmoji: c.cover_emoji,
        level: c.level ?? 1,
      })
    }
  }

  return sets.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    category: s.category as VocabCategory,
    categoryNode: s.category_id ? (categoryNodeMap.get(s.category_id) ?? null) : null,
    additionalCategoryIds: s.additional_category_ids ?? [],
    cefrLevel: s.cefr_level,
    coverEmoji: s.cover_emoji,
    sortOrder: s.sort_order ?? 0,
    wordCount: counts.get(s.id) ?? s.word_count ?? 0,
    subscriberCount: s.subscriber_count ?? 0,
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
