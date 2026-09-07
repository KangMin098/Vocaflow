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
import type { CoverMeta } from '@/lib/vcb/covers/design'
import { coverLockupOf } from '@/lib/vcb/covers/lockup'

type DB = Database

/**
 * EMBEDDED_WORD_COUNT — 세트별 실측 단어 수를 **같은 왕복에서** 받는다.
 *
 * ── 왜 바꿨나 (실측 2026-08-30) ────────────────────────────────────────
 * 이전 구현은 세트를 받은 뒤 `shared_words` 를 `.in('set_id', ids)` 로 **한 번 더** 받아
 * 행을 세었다. 세트가 몇십 개일 때는 보이지 않던 두 가지가 발행 확대(316권) 뒤 드러났다:
 *
 *   ① **큰 책은 화면이 통째로 비었다.** UUID 하나가 37자라 세트 450개면 질의 URL 이
 *      16KB 를 넘고, 그 요청은 **7.7초를 끌다가 실패**한다. `/library/books/[id]` 는
 *      이 오류를 Promise.all 에서 그대로 받아 본문을 한 글자도 못 그린다 —
 *      그런데 HTTP 는 **200** 이라(셸은 이미 흘러갔다) 어떤 훑기 축에도 안 걸린다.
 *      실측: 발행 316권 중 Clarissa(450세트)·Le Morte d'Arthur(443세트) 2권이 빈 화면.
 *
 *   ② **나머지 책은 조용히 틀린 수를 보여 줬다.** PostgREST 는 한 응답에 1,000행까지만
 *      준다. 세트 단어 합이 1,000을 넘는 책이 **316권 중 257권(81%)** 이고, 잘린 창에
 *      걸친 세트는 실제보다 **작은 수**가 나온다(0이 아니라서 캐시 폴백도 안 걸린다).
 *      오류 없이 틀린 숫자를 파는, 이 저장소가 반복해서 값을 치른 실패 유형이다
 *      (`word-set-counts.ts` 머리 주석이 같은 함정을 카탈로그 쪽에서 기록하고 있다).
 *
 * ── 왜 이 방법인가 ────────────────────────────────────────────────────
 * `shared_words(count)` 임베드 집계는 **세트 목록과 같은 요청**에서 개수를 받는다.
 * 긴 URL 도, 1,000행 상한도, 두 번째 왕복도 없다 — 개수는 DB 가 세므로 정확하다.
 * 실측(Clarissa 450세트): 두 번 왕복 7,697ms 실패 → 한 번 왕복 **247ms 성공**.
 *
 * ⚠️ 그래도 `word_count` 캐시를 폴백으로 남긴다. 임베드가 없는 행(관계 조인이 비면
 *    `null`)을 0으로 적으면 "단어 없는 단어장" 이라는 또 다른 거짓말이 된다.
 */
function embeddedWordCounts(
  rows: { id: string; word_count: number | null; shared_words?: { count: number }[] | null }[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const embedded = r.shared_words?.[0]?.count
    counts.set(r.id, typeof embedded === 'number' ? embedded : (r.word_count ?? 0))
  }
  return counts
}

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
      // 단어 수는 **임베드 집계**로 함께 받는다(`shared_words(count)`) — 이유는 EMBEDDED_WORD_COUNT 주석.
      'id, title, description, category, cefr_level, cover_emoji, sort_order, word_count, created_at, curation_query, shared_words(count)',
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
    shared_words: { count: number }[] | null
  }[]

  if (rows.length === 0) return []

  const counts = embeddedWordCounts(rows)

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
      // 도서 챕터 세트는 공용 서가 사다리에 앉지 않는다 — 그 책의 맥락에서만 열린다.
      brandFingerprint: null,
      ladderStep: null,
      // 표지 계열·슬러그도 같은 이유로 없다 — 이 세트는 공용 서가에 뜨지 않아 표지를 안 그린다.
      brandFamily: null,
      // 챕터 단어장은 브랜드 각인 대상이 아니다(계열 55권만) — 규격이 없으면 표지가 그리지 않는다.
      brandLockup: null,
      slug: null,
      // 판권면 3종도 마찬가지다. 이 세트들은 공용 서가에 뜨지 않아
      // `scripts/vocab/stamp-imprint.mts` 의 각인 대상이 아니고, 각인이 없으면
      // 판권면이 그 줄들을 통째로 뺀다(0/0 을 적어 "검수 0 통과" 로 읽히게 두지 않는다).
      imprintCode: null,
      qa: null,
      level: null,
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
      // 챕터 세트와 같은 규칙 — 단어 수는 임베드 집계로 함께 받는다(EMBEDDED_WORD_COUNT 주석).
      'id, title, description, category, cefr_level, cover_emoji, sort_order, word_count, subscriber_count, created_at, curation_query, cover_image_url, cover_image_meta, slug, version, ladder_step, shared_words(count)',
    )
    .eq('is_published', true)
    .eq('curation_query->>source_book_id', bookId)

  if (error) throw error
  const rows = (data ?? []) as unknown as {
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
    slug: string | null
    version: number | null
    ladder_step: number | null
    cover_image_url: string | null
    cover_image_meta: CoverMeta | null
    shared_words: { count: number }[] | null
  }[]

  if (rows.length === 0) return []

  const counts = embeddedWordCounts(rows)

  return rows
    .map((r): BookComposerSet => {
      const cq = r.curation_query ?? {}
      const blueprint = String(cq['blueprint'] ?? '')
      // 표지 규격은 **한 번만** 좁힌다 — 매대(`vocab/queries.ts`)와 같은 함수를 쓴다.
      const lockup = coverLockupOf(cq['brand'])
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
        coverImageUrl: r.cover_image_url ?? null,
        coverImageMeta: r.cover_image_meta ?? null,
        // 이 줄에서 카드로 열리는 미리보기 모달은 공용 서가와 **같은 판권면**을 그린다.
        // 그러니 각인된 값을 그대로 넘긴다 — 같은 권이 어디서 열리느냐에 따라 판권면이
        // 달라지면 그 판권면을 믿을 수 없다. (지문은 목록 표시에 안 쓰여 select 에서 뺐다.)
        brandFingerprint: null,
        ladderStep: r.ladder_step ?? null,
        // 같은 이유로 표지 계열·슬러그도 **각인된 값 그대로** 넘긴다 — `vocab/queries.ts` 와
        // 같은 순서로 고른다(계열은 그림의 성질이 아니라 그 책의 성질이라 큐레이션 질의가 먼저).
        brandFamily: lockup?.family ?? r.cover_image_meta?.family ?? null,
        brandLockup: lockup,
        slug: r.slug ?? null,
        imprintCode: r.slug ? `VF-${r.slug}-v${r.version ?? 1}` : null,
        qa: (cq['qa'] as BookComposerSet['qa']) ?? null,
        level: (cq['level'] as BookComposerSet['level']) ?? null,
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
  // ⚠️ 세트 id 를 **받아서 `.in()` 으로 되돌려 보내지 않는다.**
  //    세트가 450개인 책(Clarissa)에서 그 URL 이 16KB 를 넘어 요청이 7초를 끌다 실패했고,
  //    이 함수는 `/text/[id]` 레이아웃이 부르므로 **읽기 화면 전체**가 그 오류를 받는다.
  //    개수만 필요하므로 양쪽 다 head 카운트로 센다 — 목록은 애초에 오갈 이유가 없다.
  //    (같은 함정의 전말은 이 파일 위 EMBEDDED_WORD_COUNT 주석.)
  const { count: total, error } = await supabase
    .from('shared_word_sets')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true)
    .eq('category', 'library_book')
    .eq('curation_query->>book_id', bookId)

  if (error) throw error
  if (!total) return null

  if (!userId) return { subscribed: 0, total }

  // 구독 수도 같은 조건을 **조인으로** 건다(inner join → 이 책의 챕터 세트만 남는다).
  const { count: subscribed, error: sErr } = await supabase
    .from('user_word_set_subscriptions')
    .select('set_id, shared_word_sets!inner(id)', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('shared_word_sets.is_published', true)
    .eq('shared_word_sets.category', 'library_book')
    .eq('shared_word_sets.curation_query->>book_id', bookId)

  if (sErr) throw sErr
  return { subscribed: subscribed ?? 0, total }
}
