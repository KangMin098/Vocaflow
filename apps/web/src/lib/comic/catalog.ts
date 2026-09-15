// apps/web/src/lib/comic/catalog.ts
//
// CCP 학습자 카탈로그 조회 — /library/books 히어로 · /comics 탭 · 만화 상세의 단일 출처.
//
// 조회 경로 2단 (마이그레이션 적용 여부에 무관하게 동작):
//   ① list_comic_catalog (P1 · 20260808240000) — RPC 안에서 첫 컷 커버까지 뽑고 feature_rank 로 큐레이션 정렬.
//   ② 폴백: list_book_comic_catalog(알파벳순) + 도서별 select_book_comic_all 로 커버.
//      ⚠️ 폴백은 커버 1장을 위해 전권 컷 payload 를 받는다(RLS 로 comic_pages 직접 select 불가).
//         그래서 coverLimit(실제 렌더되는 카드 수)으로 상한을 건다. 마이그레이션 적용 후엔 ①만 탄다.

import type { SupabaseClient } from '@supabase/supabase-js'

/** coverLimit 미지정 시 폴백 경로에서 커버를 받아올 최대 도서 수 */
const DEFAULT_COVER_LIMIT = 12

export interface ComicCatalogItem {
  bookId: string
  title: string
  author: string | null
  vLevel: number | null
  panelsTotal: number
  /** 첫 컷 이미지 URL (미조회/실패 시 null → 폴백 아이콘) */
  coverArt: string | null
  // ── 아래는 list_comic_catalog(P1) 에서만 채워짐. 폴백 경로에선 null/0 ──
  /** 만화가 존재하는 챕터 수 */
  chaptersTotal: number
  genreNorm: string | null
  /** i+1 판정용 (judgeIPlusOne) */
  lexicalCoverage: Record<string, number> | null
  isPictureBook: boolean
  /** 원문 읽기 예상 시간(분) — 포맷 선택 카드의 비교 정보 */
  readingMinutes: number | null
  bookChapterCount: number | null
  hasAudio: boolean
  publishedAt: string | null
}

export interface ComicCatalogOptions {
  /** 반환 항목 수 상한 (미지정 = 전량) */
  limit?: number
  /** 폴백 경로에서 커버를 받아올 상위 N개 (0 = 커버 조회 안 함). 미지정 = DEFAULT_COVER_LIMIT */
  coverLimit?: number
}

interface RichRow {
  library_book_id: string
  title: string
  author: string | null
  book_v_level: number | null
  panels_total: number | null
  chapters_total: number | null
  cover_url: string | null
  genre_norm: string | null
  lexical_coverage: Record<string, number> | null
  is_picture_book: boolean | null
  reading_minutes: number | null
  book_chapter_count: number | null
  has_audio: boolean | null
  feature_rank: number | null
  published_at: string | null
}

interface LegacyRow {
  library_book_id: string
  title: string
  author: string | null
  book_v_level: number | null
  panels_total: number | null
}

function fromRich(r: RichRow): ComicCatalogItem {
  return {
    bookId: r.library_book_id,
    title: r.title,
    author: r.author,
    vLevel: r.book_v_level,
    panelsTotal: r.panels_total ?? 0,
    coverArt: r.cover_url,
    chaptersTotal: r.chapters_total ?? 0,
    genreNorm: r.genre_norm,
    lexicalCoverage: r.lexical_coverage,
    isPictureBook: r.is_picture_book === true,
    readingMinutes: r.reading_minutes,
    bookChapterCount: r.book_chapter_count,
    hasAudio: r.has_audio === true,
    publishedAt: r.published_at,
  }
}

function fromLegacy(r: LegacyRow): ComicCatalogItem {
  return {
    bookId: r.library_book_id,
    title: r.title,
    author: r.author,
    vLevel: r.book_v_level,
    panelsTotal: r.panels_total ?? 0,
    coverArt: null,
    chaptersTotal: 0,
    genreNorm: null,
    lexicalCoverage: null,
    isPictureBook: false,
    readingMinutes: null,
    bookChapterCount: null,
    hasAudio: false,
    publishedAt: null,
  }
}

export interface ComicCatalogResult {
  items: ComicCatalogItem[]
  /**
   * 두 경로가 **모두 실패**했는가.
   *
   * ⚠️ 빈 배열에는 원인이 둘 있다 — "아직 만화가 없다" 와 "목록을 못 읽었다"(RLS 변경·
   *    타임아웃·RPC 미적용). 예전에는 둘 다 `[]` 로 뭉개서, 호출 화면이 「아직 준비된
   *    만화가 없어요」를 띄웠다. 재고가 그대로인데 화면이 0을 말하면 그건 거짓말이고,
   *    오류 로그도 화면 신호도 없어 아무도 못 잡는다(2026-09-05 감사).
   */
  failed: boolean
}

/**
 * 발행된 만화 카탈로그 + **실패 여부**. 두 RPC 모두 comic_books.status='published'
 * AND library_books.status='published' 이중 게이트라 미발행 유출 없음.
 */
export async function fetchComicCatalogResult(
  client: SupabaseClient,
  options: ComicCatalogOptions = {},
): Promise<ComicCatalogResult> {
  const { limit, coverLimit = DEFAULT_COVER_LIMIT } = options

  // ① P1 경로
  try {
    const { data, error } = await client.rpc('list_comic_catalog')
    if (!error && Array.isArray(data)) {
      const items = (data as RichRow[]).map(fromRich)
      return { items: typeof limit === 'number' ? items.slice(0, limit) : items, failed: false }
    }
  } catch {
    // 미적용(PGRST202) 등 — 폴백으로
  }

  // ② 폴백 경로
  let rows: LegacyRow[] = []
  try {
    const { data, error } = await client.rpc('list_book_comic_catalog')
    if (error || !Array.isArray(data)) return { items: [], failed: true }
    rows = data as LegacyRow[]
  } catch {
    return { items: [], failed: true }
  }

  const sliced = typeof limit === 'number' ? rows.slice(0, limit) : rows
  const items = sliced.map(fromLegacy)
  if (coverLimit <= 0 || items.length === 0) return { items, failed: false }

  const covers = await fetchComicCovers(
    client,
    items.slice(0, coverLimit).map((i) => i.bookId),
  )
  if (covers.size === 0) return { items, failed: false }
  return {
    items: items.map((i) => ({ ...i, coverArt: covers.get(i.bookId) ?? null })),
    failed: false,
  }
}

/**
 * 항목만 필요한 호출부용 얇은 껍데기 (도서 화면의 만화 히어로 등 — 그쪽은 실패하면
 * 섹션 자체를 생략하는 graceful degrade 라 실패 여부를 구분할 필요가 없다).
 */
export async function fetchComicCatalog(
  client: SupabaseClient,
  options: ComicCatalogOptions = {},
): Promise<ComicCatalogItem[]> {
  return (await fetchComicCatalogResult(client, options)).items
}

/** 폴백 전용 — 도서별 첫 컷 URL. 실패한 책은 map 에서 빠짐(호출부가 null 폴백). */
async function fetchComicCovers(
  client: SupabaseClient,
  bookIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const results = await Promise.all(
    bookIds.map(async (bookId) => {
      try {
        const { data } = await client.rpc('select_book_comic_all', { p_book_id: bookId })
        const first = Array.isArray(data)
          ? (data[0] as { image_url?: string } | undefined)
          : undefined
        return first?.image_url ? ([bookId, first.image_url] as const) : null
      } catch {
        return null
      }
    }),
  )
  for (const r of results) {
    if (r) out.set(r[0], r[1])
  }
  return out
}

/**
 * 만화가 발행된 도서 id 집합 — 도서 그리드 배지/포맷 필터용.
 * book_comic_available 을 도서마다 호출하면 N+1 이라 카탈로그 1회로 해결한다.
 */
export function comicBookIdsOf(items: ComicCatalogItem[]): Set<string> {
  return new Set(items.map((i) => i.bookId))
}

export interface ComicPreviewPanel {
  pageOrder: number
  chapterIdx: number
  imageUrl: string
  staveLabel: string | null
}

/**
 * 미등록/비로그인 프리뷰 컷. preview_book_comic(P1) 우선, 미적용 시 전권 RPC 앞부분으로 폴백.
 * 대사(bubbles)는 의도적으로 버린다 — 프리뷰는 유입용이고, 정본 대사/vocab 은 리더의 학습 자산.
 */
export async function fetchComicPreview(
  client: SupabaseClient,
  bookId: string,
  limit = 3,
): Promise<ComicPreviewPanel[]> {
  const cap = Math.max(1, Math.min(limit, 5))

  try {
    const { data, error } = await client.rpc('preview_book_comic', {
      p_book_id: bookId,
      p_limit: cap,
    })
    if (!error && Array.isArray(data)) return mapPanels(data)
  } catch {
    // 미적용 — 폴백
  }

  try {
    const { data, error } = await client.rpc('select_book_comic_all', { p_book_id: bookId })
    if (!error && Array.isArray(data)) return mapPanels(data.slice(0, cap))
  } catch {
    return []
  }
  return []
}

function mapPanels(rows: unknown[]): ComicPreviewPanel[] {
  return (
    rows as Array<{
      page_order: number
      chapter_idx: number
      image_url: string
      stave_label: string | null
    }>
  )
    .filter((r) => typeof r?.image_url === 'string' && r.image_url.length > 0)
    .map((r) => ({
      pageOrder: r.page_order,
      chapterIdx: r.chapter_idx,
      imageUrl: r.image_url,
      staveLabel: r.stave_label ?? null,
    }))
}
