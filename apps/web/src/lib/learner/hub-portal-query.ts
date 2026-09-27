// apps/web/src/lib/learner/hub-portal-query.ts
//
// 플랫폼 메인(`/hub`) 의 **홍보 면에 세울 실물**을 한 번에 읽는다.
//
// 2026-09-22 재설계 — `/hub` 가 「오늘의 무대」 한 장에서 **여러 플랫폼 홍보가 모인 메인**으로 바뀌었다.
// 홍보 면은 지어낸 문구를 세우기 쉬운 자리라 규칙을 먼저 정해 둔다:
//   ① 면에 서는 책 · 만화 · 글 · 단어장은 **발행 게이트를 통과한 실제 행**이다(학습자 RLS 로 읽는다).
//   ② 수치는 전부 여기서 센다(I5 — 상수 금지). 못 읽은 수는 `null` 이고 화면은 그 문장을 버린다.
//      `count ?? 0` 을 쓰지 않는다 — 막힌 표도 오류 없이 null 을 주고, 0 으로 접으면 「0권」 이 걸린다.
//   ③ 하나가 실패해도 페이지는 선다 — 면마다 따로 비고, 다른 면은 그대로다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { cache } from 'react'

import { fetchComicCatalogResult } from '@/lib/comic/catalog'
import { applyArticleCatalogGate, applyBookCatalogGate } from '@/lib/library/publish-gate'
import { listPdComics } from '@/lib/pd-comic/queries'
import { createClient } from '@/lib/supabase/server'

export interface PortalBook {
  id: string
  title: string
  author: string | null
  cover: string
  cefr: string | null
  minutes: number | null
}

export interface PortalComic {
  href: string
  title: string
  cover: string | null
  /** 'adapted' = 원서를 만화로 · 'restored' = 퍼블릭 도메인 만화 복원 */
  kind: 'adapted' | 'restored'
}

export interface PortalArticle {
  id: string
  title: string
  cefr: string | null
  minutes: number | null
}

export interface PortalFacts {
  books: number | null
  articles: number | null
  comics: number | null
  /** 도서·글에서 자동으로 만든 것을 뺀 큐레이션 단어장 */
  curatedSets: number | null
}

export interface HubPortal {
  newBooks: PortalBook[]
  comics: PortalComic[]
  articles: PortalArticle[]
  /** 큐레이션 단어장 — 범주별 발행 수(0 인 범주는 없다) */
  setCategories: { id: string; count: number }[]
  facts: PortalFacts
}

/** 도서·글 챕터에서 자동 생성된 세트 — 「단어장 컬렉션」 이 아니라 그 책의 부속이다. */
const DERIVED_SET_CATEGORIES = ['library_book', 'library_article'] as const

type Counted = PromiseLike<{ count: number | null; error: unknown }>

/**
 * 총계만 읽는다. HEAD 를 쓰지 않는 이유는 `trust-signals.ts` 머리 주석과 같다 —
 * HEAD 응답에는 본문이 없어 타임아웃이 `error: null · count: null` 로 조용히 사라진다.
 */
async function countOf(label: string, q: Counted): Promise<number | null> {
  const { count, error } = await q
  if (error) {
    const e = error as { message?: string; code?: string }
    console.error(`[hub-portal] ${label} 집계 실패`, e.code ?? '', e.message ?? error)
    return null
  }
  return typeof count === 'number' ? count : null
}

async function loadBooks(db: SupabaseClient): Promise<PortalBook[]> {
  const { data, error } = await applyBookCatalogGate(
    db
      .from('library_books')
      .select('id, title, author, cover_image_url, cefr_level, reading_minutes'),
  )
    .not('cover_image_url', 'is', null)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(12)
  if (error) {
    console.error('[hub-portal] 새 도서 조회 실패', error.message)
    return []
  }
  type Row = { id: string; title: string; author: string | null; cover_image_url: string; cefr_level: string | null; reading_minutes: number | null }
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    title: r.title,
    author: r.author,
    cover: r.cover_image_url,
    cefr: r.cefr_level,
    minutes: r.reading_minutes,
  }))
}

async function loadArticles(db: SupabaseClient): Promise<PortalArticle[]> {
  const { data, error } = await applyArticleCatalogGate(
    db.from('library_articles').select('id, title, cefr_level, reading_minutes'),
  )
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(5)
  if (error) {
    console.error('[hub-portal] 새 글 조회 실패', error.message)
    return []
  }
  type Row = { id: string; title: string; cefr_level: string | null; reading_minutes: number | null }
  return ((data ?? []) as Row[]).map((r) => ({ id: r.id, title: r.title, cefr: r.cefr_level, minutes: r.reading_minutes }))
}

async function loadComics(db: SupabaseClient): Promise<{ items: PortalComic[]; total: number | null }> {
  const [adapted, restored] = await Promise.all([
    fetchComicCatalogResult(db, { coverLimit: 6 }).catch(() => ({ items: [], failed: true })),
    listPdComics(db).catch(() => ({ ready: false, data: [] })),
  ])
  const items: PortalComic[] = [
    ...adapted.items.map((c) => ({
      href: `/comics/adapted/${c.bookId}`,
      title: c.title,
      cover: c.coverArt,
      kind: 'adapted' as const,
    })),
    ...restored.data.map((c) => ({
      href: `/comics/restored/${c.slug}`,
      title: c.seriesTitle && c.issueNo ? `${c.seriesTitle} #${c.issueNo}` : c.title,
      cover: c.coverUrl,
      kind: 'restored' as const,
    })),
  ]
  // 두 경로 중 하나라도 못 읽었으면 합계를 말하지 않는다 — 반쪽 합계는 과소 표시다.
  const total = adapted.failed || !restored.ready ? null : adapted.items.length + restored.data.length
  return { items: items.slice(0, 6), total }
}

async function loadSetCategories(db: SupabaseClient): Promise<{ id: string; count: number }[] | null> {
  const { data, error } = await db
    .from('shared_word_sets')
    .select('category')
    .eq('is_published', true)
    .not('category', 'in', `(${DERIVED_SET_CATEGORIES.join(',')})`)
    .limit(1000)
  if (error) {
    console.error('[hub-portal] 단어장 범주 조회 실패', error.message)
    return null
  }
  const tally = new Map<string, number>()
  for (const r of (data ?? []) as { category: string | null }[]) {
    if (!r.category) continue
    tally.set(r.category, (tally.get(r.category) ?? 0) + 1)
  }
  return [...tally.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count)
}

export const fetchHubPortal = cache(async (): Promise<HubPortal> => {
  const db = (await createClient()) as unknown as SupabaseClient

  const [newBooks, articles, comics, setCategories, books, articleTotal] = await Promise.all([
    loadBooks(db),
    loadArticles(db),
    loadComics(db),
    loadSetCategories(db),
    countOf('도서', applyBookCatalogGate(db.from('library_books').select('*', { count: 'exact' }).limit(0)) as unknown as Counted),
    countOf('글', applyArticleCatalogGate(db.from('library_articles').select('*', { count: 'exact' }).limit(0)) as unknown as Counted),
  ])

  return {
    newBooks,
    comics: comics.items,
    articles,
    setCategories: setCategories ?? [],
    facts: {
      // 0 은 대개 "못 읽었다" 다 — 발행 서가가 비어 있을 리 없는 표는 0 을 말하지 않는다.
      books: books || null,
      articles: articleTotal || null,
      comics: comics.total || null,
      curatedSets: setCategories ? setCategories.reduce((s, c) => s + c.count, 0) || null : null,
    },
  }
})
