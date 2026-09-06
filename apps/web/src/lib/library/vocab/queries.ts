// apps/web/src/lib/library/vocab/queries.ts
//
// 공용 단어장(/library/vocab) Server-only 쿼리.
// - fetchPublishedSets: 게시된 세트 + 실제 단어 수(캐시 stale 보정) 머지
// - fetchUserSubscriptions: 현재 사용자가 구독한 set_id 집합
// - fetchSetSampleWords: 미리보기 단어 N개

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'
import { setKindOf, type SetKind } from './set-kind'
import type { CoverMeta } from '@/lib/vcb/covers/design'
import { pagedSelect } from '@/lib/supabase/paged-select'

type DB = Database

/**
 * 학습자 카탈로그의 칸.
 *
 * ⚠️ `components/library/vocab/categories.ts` 의 칩 목록과 **같아야 한다.** 한동안
 * `preschool` · `etymology` 두 개가 칩에는 있고 이 유니온에는 없었다 — 어원 세트 2개가
 * 실제로 그 칸에 발행돼 있는데 타입은 그런 칸이 없다고 말하는 상태였다(2026-08-15 실측).
 * 칸을 늘릴 때 두 곳을 같이 고칠 것.
 */
export type VocabCategory =
  | 'preschool'
  | 'elementary'
  | 'middle'
  | 'high'
  | 'csat'
  | 'eng_test'
  | 'civil'
  | 'business'
  | 'etymology'
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
  /**
   * 무엇으로 묶은 단어장인가 — 컴포저가 남긴 유형(blueprint)에서 온다.
   * 발행 세트의 24/29 가 '테마별' 한 칸에 있어 제목만으로는 서로 구별되지 않는다.
   * 유형이 없는 레거시 세트는 null 이고, 카드가 그 줄을 생략한다.
   */
  kind: SetKind | null
  /** 표지 이미지 (Openverse PD/CC 도판). null 이면 그라디언트 표지로 폴백. */
  coverImageUrl: string | null
  /** 표지 출처 — CC 표기 의무. 계열 듀오톤 색도 여기 `family` 에서 나온다. */
  coverImageMeta: CoverMeta | null
  /**
   * 발행 당시 브랜드 규격의 지문(FNV-1a 8자리). 지금 규격과 다르면 **옛 규격으로 만들어진
   * 권**이다 — 색을 DB 에 복사하지 않고 지문만 남기므로 토큰이 정본으로 남는다.
   */
  brandFingerprint: string | null
  /**
   * 컴포저가 정한 사다리 계단(1~7). **파생 캐시가 아니다** — null 이면 "아직 안 정했다" 는
   * 뜻이고, 그때만 화면이 `lib/library/vocab/rung.ts` 의 추정으로 내려간다.
   */
  ladderStep: number | null
  /**
   * 판권 번호 — 이 **판(edition)** 을 특정하는 표기. 시중 단어장의 ISBN 자리다.
   * 학습자가 인용·검색·문의할 때 쓸 수 있어야 하므로 slug 와 판차를 함께 낸다.
   */
  /**
   * 표지를 그릴 **계열**. `curation_query.brand.family` 가 정본이고(브랜드 드레인이 각인),
   * 각인 전 세트는 수집 도판의 메타로 떨어진다.
   *
   * ⚠️ `coverImageMeta.family` 를 정본으로 쓰면 **도판을 못 받은 권은 계열이 없다** —
   *    그 권은 표지를 그릴 수 없게 된다. 계열은 그림의 성질이 아니라 그 책의 성질이다.
   */
  brandFamily: string | null
  /** 표지 도판의 열쇠이자 판권 번호의 뿌리. 재발행해도 같은 책이면 같은 값이어야 한다. */
  slug: string | null
  imprintCode: string | null
  /**
   * 자동 검수 실측 — `scripts/vocab/stamp-imprint.mts` 가 각인한다.
   * **null 이면 판권면이 그 줄을 뺀다** — 0/0 은 "검수 0 통과" 로 읽혀 없는 것보다 나쁘다.
   */
  qa: { checked: number; passed: number; at: string } | null
  /**
   * 표제어 난이도 실측(V-Level 중앙값·최소·최대). 사다리 **밖**(성인 수준) 권이
   * "대상 수준" 을 말할 수 있게 하는 유일한 근거다 — 학령 계단이 없다고 수준이 없는 게 아니다.
   */
  level: { median: number; min: number; max: number; measured: number } | null
}

export interface SamplePreviewWord {
  word: string
  meaningKo: string
  partOfSpeech: string | null
  cefrLevel: string | null
}

/**
 * 개인 맞춤 추천 (recommend_word_sets_for_user RPC 결과 — 진단 V-level/track 기반).
 * recommendation_type: primary(메인)/stretch(도전)/review(보강)/specialty(관심)/fallback.
 */
export interface RecommendedSet {
  set_id: string
  recommendation_type: string
  reason: string
  priority: number
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
  slug?: string | null
  version?: number | null
  curation_query?: {
    blueprint?: string
    /** `scripts/vocab/stamp-imprint.mts` 가 더한 키. 컴포저의 레시피와 같은 jsonb 에 산다. */
    qa?: { checked: number; passed: number; at: string }
    level?: { median: number; min: number; max: number; measured: number }
    /** `scripts/vocab/brand-drain-import.mts` 가 각인한 계열 브랜드 규격. */
    brand?: { family?: string }
  } | null
  cover_image_url?: string | null
  cover_image_meta?: CoverMeta | null
  brand_fingerprint?: string | null
  ladder_step?: number | null
  /** `shared_words(count)` 임베드 집계 — enrichSets 주석 참조. 조인이 비면 null. */
  shared_words?: { count: number }[] | null
}

export async function fetchPublishedSets(
  supabase: SupabaseClient<DB>,
): Promise<PublishedVocabSet[]> {
  // subscriber_count 는 방금 추가된 컬럼 — database.ts 재생성 전이라 loose client 로 select
  const sb = supabase as unknown as SupabaseClient
  const { data, error } = await sb
    .from('shared_word_sets')
    .select(
      'id, title, description, category, cefr_level, cover_emoji, sort_order, word_count, subscriber_count, created_at, category_id, additional_category_ids, curation_query, cover_image_url, cover_image_meta, brand_fingerprint, ladder_step, slug, version, shared_words(count)',
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
      .select('id, title, description, category, cefr_level, cover_emoji, sort_order, word_count, subscriber_count, created_at, curation_query, cover_image_url, cover_image_meta, brand_fingerprint, ladder_step, slug, version, shared_words(count)')
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

  // 실측 단어 수는 세트 조회와 **같은 왕복**에서 온다(`shared_words(count)`).
  //
  // ⚠️ 예전에는 여기서 `shared_words` 를 `.in('set_id', ids)` 로 한 번 더 받아 행을 세었다.
  //    PostgREST 는 한 응답에 1,000행까지만 주는데, 이 화면의 세트 70개가 가진 단어는
  //    **32,792개**다. 잘린 창에 걸친 세트만 실제보다 작은 수가 되고 나머지는 캐시로
  //    떨어지므로 **오류 없이 합계가 틀린다** — 실측 2026-08-30: 화면이 `단어 32,632` 를
  //    팔았다(160 부족). 세는 일은 DB 에 맡긴다.
  //
  //    ⚠️ 캐시(`word_count`) 합은 32,793 이다 — 한 세트가 1 만큼 낡았다. 이 함수의 이름이
  //    처음부터 "실측 보정" 이었던 이유가 그것이고, 이제 실제로 그 일을 한다.
  //
  //    같은 함정의 전말은 `lib/library/books/queries.ts` 의 EMBEDDED_WORD_COUNT 주석.
  //    이 저장소에서 세 번째로 같은 자리에서 났다 — 세트 목록을 받아 단어를 다시 받는
  //    모양을 보면 상한부터 의심할 것.
  const counts = new Map<string, number>()
  for (const s of sets) {
    const embedded = s.shared_words?.[0]?.count
    counts.set(s.id, typeof embedded === 'number' ? embedded : (s.word_count ?? 0))
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
    kind: setKindOf(s.curation_query?.blueprint),
    coverImageUrl: s.cover_image_url ?? null,
    coverImageMeta: s.cover_image_meta ?? null,
    brandFingerprint: s.brand_fingerprint ?? null,
    ladderStep: s.ladder_step ?? null,
    brandFamily: s.curation_query?.brand?.family ?? s.cover_image_meta?.family ?? null,
    slug: s.slug ?? null,
    // 판권 번호 — slug 가 없으면 만들지 않는다(id 로 지어내면 학습자가 인용할 수 없는 값이 된다).
    imprintCode: s.slug ? `VF-${s.slug}-v${s.version ?? 1}` : null,
    qa: s.curation_query?.qa ?? null,
    level: s.curation_query?.level ?? null,
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

  // ⚠️ **끝까지 받는다.** 이 조회는 상한이 없어서 PostgREST 의 1,000행에서 조용히 잘렸다.
  //    잘리면 구독 중인 세트가 **구독 안 한 것으로** 보인다 — 오류 없이 화면만 틀리는,
  //    이 저장소가 하루에 세 번 값을 치른 그 실패다(`lib/supabase/paged-select.ts` 머리 주석).
  //
  //    도달 가능한가: 오늘 최대 보유는 268개다. 그런데 챕터 단어장은 **도서를 담으면 함께
  //    붙는다** — Clarissa 한 권이 450개, Le Morte d'Arthur 가 443개다(실측 2026-08-30).
  //    고전 몇 권을 담은 학습자는 바로 1,000을 넘는다. "지금은 안 넘는다" 는 근거가 못 된다.
  const rows = await pagedSelect<{ set_id: string }>(
    (from, to) =>
      supabase
        .from('user_word_set_subscriptions')
        .select('set_id')
        .eq('user_id', userId)
        .range(from, to),
    '구독 단어장',
  )

  return new Set(rows.map((r) => r.set_id))
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
