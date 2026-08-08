// apps/web/src/lib/comic/catalog.ts
//
// CCP 학습자 카탈로그 조회 — /library/books 히어로와 /library/comics 탭의 단일 출처.
// 이전엔 books/page.tsx 안에 인라인으로 있었고(도서 페이지 전용), 만화 탭이 생기며 중복될 자리라 lib 으로 승격.
//
// ⚠️ 커버(첫 컷) 조회 한계 — 발행 게이트 RPC 중 컷 URL 을 주는 것이 select_book_comic_all(전권 컷 전량)뿐이라
//    커버 1장을 위해 전권 payload 를 받는다. comic_pages 직접 select 는 RLS(admin/curator)로 막혀 대안이 아님.
//    그래서 coverLimit 으로 "실제 그려지는 카드 수"만큼만 커버를 받는다(히어로 4 / 탭 그리드 상한).
//    설계서 §7.1 list_comic_catalog(RPC 내부에서 첫 컷만 뽑음)로 P1 에서 대체 — 그때 fetchComicCovers 는 삭제된다.

import type { SupabaseClient } from '@supabase/supabase-js'

/** coverLimit 미지정 시 커버를 받아올 최대 도서 수 (그 이상은 coverArt=null → 폴백 아이콘) */
const DEFAULT_COVER_LIMIT = 12

export interface ComicCatalogItem {
  bookId: string
  title: string
  author: string | null
  vLevel: number | null
  panelsTotal: number
  /** 첫 컷 이미지 URL (미조회/실패 시 null → 폴백 아이콘) */
  coverArt: string | null
}

interface CatalogRow {
  library_book_id: string
  title: string
  author: string | null
  book_v_level: number | null
  panels_total: number | null
}

export interface ComicCatalogOptions {
  /** 반환 항목 수 상한 (미지정 = 전량) */
  limit?: number
  /** 커버를 받아올 상위 N개 (0 = 커버 조회 안 함). 미지정 = DEFAULT_COVER_LIMIT */
  coverLimit?: number
}

/**
 * 발행된 만화 카탈로그. RPC(list_book_comic_catalog)는 comic_books.status='published'
 * AND library_books.status='published' 이중 게이트가 걸려 있어 미발행 유출 없음.
 * RPC 미적용/오류 시 빈 배열(호출부는 섹션 자체를 생략 — graceful degrade).
 */
export async function fetchComicCatalog(
  client: SupabaseClient,
  options: ComicCatalogOptions = {},
): Promise<ComicCatalogItem[]> {
  const { limit, coverLimit = DEFAULT_COVER_LIMIT } = options

  let rows: CatalogRow[] = []
  try {
    const { data, error } = await client.rpc('list_book_comic_catalog')
    if (error || !Array.isArray(data)) return []
    rows = data as CatalogRow[]
  } catch {
    return []
  }

  const sliced = typeof limit === 'number' ? rows.slice(0, limit) : rows
  const items: ComicCatalogItem[] = sliced.map((r) => ({
    bookId: r.library_book_id,
    title: r.title,
    author: r.author,
    vLevel: r.book_v_level,
    panelsTotal: r.panels_total ?? 0,
    coverArt: null,
  }))

  if (coverLimit <= 0 || items.length === 0) return items

  const covers = await fetchComicCovers(
    client,
    items.slice(0, coverLimit).map((i) => i.bookId),
  )
  if (covers.size === 0) return items
  return items.map((i) => ({ ...i, coverArt: covers.get(i.bookId) ?? null }))
}

/** 도서별 첫 컷 URL. 실패한 책은 map 에서 빠짐(호출부가 null 폴백). */
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
