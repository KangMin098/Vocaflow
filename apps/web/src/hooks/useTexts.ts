// apps/web/src/hooks/useTexts.ts
//
// TextViewer 허브 (/text) 데이터 훅 — Phase 3 Supabase 연동.
//
// useHubData 패턴 정합:
//   - useAuthUserId 로 인증 결정 후 SWR 키 발행
//   - dedupingInterval 5초 / revalidateOnFocus / revalidateOnReconnect
//   - RLS 자동 격리 (auth.uid() = user_id)

'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'

import { createClient } from '@/lib/supabase/client'
import type { CEFRLevel, LibraryText } from '@/types/library'

import type { Tables } from '@vocaflow/types'

type TextsRow = Tables<'texts'>

const CATEGORY_MAP: Record<string, string> = {
  library: '라이브러리',
  'direct-script': '직접 입력',
  'direct-file': '파일',
  'shared-set': '공용 단어장',
}

/**
 * `texts.source_url` 의 ACP 마커에서 기사 id 를 뽑는다.
 * `lib/articles/start-learning.ts` 가 `article:{uuid}` 로 심는다(중복 학습 방지용 키).
 * 이 마커가 **기사 표지를 그릴 수 있는 유일한 단서**다 — `texts` 자체에는 출처 컬럼이 없다.
 */
export function articleIdFromMarker(sourceUrl: string | null | undefined): string | null {
  const m = /^article:([0-9a-f-]{36})$/i.exec((sourceUrl ?? '').trim())
  return m ? m[1] : null
}

/** 기사 id → 표지에 필요한 최소 메타. `fetchTexts` 가 한 번에 채운다. */
type ArticleCoverMeta = { source: string | null; readingMinutes: number | null }

function mapDbToLibraryText(row: TextsRow, articleMeta?: Map<string, ArticleCoverMeta>): LibraryText {
  const content = row.content ?? ''
  const wordCount = content.split(/\s+/).filter(Boolean).length
  const totalPages = Math.max(1, Math.ceil(wordCount / 250))
  const progress = Number(row.progress_percent ?? 0)
  const currentPage = Math.floor((totalPages * progress) / 100)

  return {
    id: row.id,
    title: row.title,
    author: row.author || '저자 미상',
    cefrLevel: (row.cefr_level || 'B1') as CEFRLevel,
    category: CATEGORY_MAP[row.source ?? 'direct-script'] ?? '직접 입력',
    preview:
      content.slice(0, 100).trim() + (content.length > 100 ? '…' : ''),
    wordCount,
    progressPercent: progress,
    totalPages,
    currentPage,
    coverGradient: {
      from: row.cover_from || '#A78BFA',
      to: row.cover_to || '#6D28D9',
    },
    addedAt: new Date(row.created_at || Date.now()),
    lastStudiedAt: row.last_opened ? new Date(row.last_opened) : null,
    isBookmarked: row.is_bookmarked ?? false,
    bookId: null,
    articleSource: articleMeta?.get(articleIdFromMarker(row.source_url) ?? '')?.source ?? null,
    articleReadingMinutes:
      articleMeta?.get(articleIdFromMarker(row.source_url) ?? '')?.readingMinutes ?? null,
  }
}

/**
 * library_book_id 가 있는 chapter rows 를 도서 단위로 집계 → 1 LibraryText.
 *   - title/author/cefr_band/book_v_level/chapter_count = library_books 메타 우선
 *   - progressPercent = round(completed_chapters / chapter_count × 100)
 *   - preview = "총 N장 · 진행 M장 · 완료 K장"
 *   - lastStudiedAt = max(last_opened)
 *   - id = library_book_id (카드 클릭 → /my/books/[bookId])
 */
interface LibraryBookMeta {
  id: string
  title: string | null
  author: string | null
  cefr_level: string | null
  cefr_band: string | null
  book_v_level: number | null
  chapter_count: number | null
  cover_from: string | null
  cover_to: string | null
  lexical_coverage: Record<string, number> | null
  cover_image_url: string | null
  is_picture_book: boolean | null
}

type JoinedRow = TextsRow & { library_books: LibraryBookMeta | null }

/**
 * v06.32 — getResumeTarget 로직 client-side 동일 적용 (서버 redirect 우회).
 * 우선순위: in_progress > not_started > 첫 chapter.
 */
function pickResumeTextId(sortedChapters: JoinedRow[]): string | null {
  const inProg = sortedChapters.find((r) => r.status === 'in_progress')
  if (inProg) return inProg.id
  const notStarted = sortedChapters.find(
    (r) => !r.status || r.status === 'not_started',
  )
  if (notStarted) return notStarted.id
  return sortedChapters[0]?.id ?? null
}

/**
 * v06.34 — 사용자 직접 입력 책 그룹(user_book_group_id) 의 챕터들을 1 LibraryText 로 집계.
 * library_books 메타가 없는 점만 다르고 나머지는 aggregateBookChapters 와 동일 구조.
 */
function aggregateUserBookChapters(
  groupId: string,
  rows: JoinedRow[],
): LibraryText {
  const sorted = [...rows].sort(
    (a, b) => (a.chapter_idx ?? 0) - (b.chapter_idx ?? 0),
  )
  const first = sorted[0]!

  const title = first.title || '제목 없음'
  const author = first.author || '저자 미상'
  const cefrLevel = (first.cefr_level || 'B1') as CEFRLevel

  const totalChapters = sorted.length
  const completed = sorted.filter(
    (r) => Number(r.progress_percent ?? 0) >= 100,
  ).length
  const inProgress = sorted.filter((r) => {
    const p = Number(r.progress_percent ?? 0)
    return p > 0 && p < 100
  }).length

  const progressPercent =
    totalChapters > 0 ? Math.round((completed / totalChapters) * 100) : 0

  const wordCount = sorted.reduce((acc, r) => {
    const c = r.content ?? ''
    return acc + c.split(/\s+/).filter(Boolean).length
  }, 0)

  let lastStudiedAt: Date | null = null
  for (const r of sorted) {
    const t = r.last_opened ? new Date(r.last_opened) : null
    if (t && (!lastStudiedAt || t > lastStudiedAt)) lastStudiedAt = t
  }

  const previewParts: string[] = [`총 ${totalChapters}장`]
  if (inProgress > 0) previewParts.push(`진행 ${inProgress}장`)
  if (completed > 0) previewParts.push(`완료 ${completed}장`)

  return {
    id: groupId,
    title,
    author,
    cefrLevel,
    category: '내 책',
    preview: previewParts.join(' · '),
    wordCount,
    progressPercent,
    totalPages: totalChapters,
    currentPage: completed,
    coverGradient: {
      from: first.cover_from ?? '#A78BFA',
      to: first.cover_to ?? '#6D28D9',
    },
    addedAt: new Date(first.created_at || Date.now()),
    lastStudiedAt,
    isBookmarked: sorted.some((r) => r.is_bookmarked === true),
    bookId: null,
    userBookGroupId: groupId,
    nextTextId: pickResumeTextId(sorted),
    chapterCount: totalChapters,
    completedChapters: completed,
  }
}

function aggregateBookChapters(
  bookId: string,
  rows: JoinedRow[],
): LibraryText {
  const sorted = [...rows].sort(
    (a, b) => (a.chapter_idx ?? 0) - (b.chapter_idx ?? 0),
  )
  const first = sorted[0]!
  const meta = first.library_books

  const title = meta?.title ?? first.title ?? '제목 없음'
  const author = meta?.author ?? first.author ?? '저자 미상'
  const cefrLevel = (meta?.cefr_band ??
    meta?.cefr_level ??
    first.cefr_level ??
    'B1') as CEFRLevel

  const totalChapters = meta?.chapter_count ?? sorted.length
  const completed = sorted.filter(
    (r) => Number(r.progress_percent ?? 0) >= 100,
  ).length
  const inProgress = sorted.filter((r) => {
    const p = Number(r.progress_percent ?? 0)
    return p > 0 && p < 100
  }).length

  const progressPercent =
    totalChapters > 0 ? Math.round((completed / totalChapters) * 100) : 0

  const wordCount = sorted.reduce((acc, r) => {
    const c = r.content ?? ''
    return acc + c.split(/\s+/).filter(Boolean).length
  }, 0)

  let lastStudiedAt: Date | null = null
  for (const r of sorted) {
    const t = r.last_opened ? new Date(r.last_opened) : null
    if (t && (!lastStudiedAt || t > lastStudiedAt)) lastStudiedAt = t
  }

  const previewParts: string[] = [`총 ${totalChapters}장`]
  if (inProgress > 0) previewParts.push(`진행 ${inProgress}장`)
  if (completed > 0) previewParts.push(`완료 ${completed}장`)

  return {
    id: bookId,
    title,
    author,
    cefrLevel,
    category: '라이브러리',
    preview: previewParts.join(' · '),
    wordCount,
    progressPercent,
    totalPages: totalChapters,
    currentPage: completed,
    coverGradient: {
      from: meta?.cover_from ?? first.cover_from ?? '#A78BFA',
      to: meta?.cover_to ?? first.cover_to ?? '#6D28D9',
    },
    addedAt: new Date(first.created_at || Date.now()),
    lastStudiedAt,
    isBookmarked: sorted.some((r) => r.is_bookmarked === true),
    bookId,
    nextTextId: pickResumeTextId(sorted),
    chapterCount: totalChapters,
    completedChapters: completed,
    bookVLevel: meta?.book_v_level ?? null,
    lexicalCoverage: meta?.lexical_coverage ?? null,
    coverImageUrl: meta?.cover_image_url ?? null,
    isPictureBook: meta?.is_picture_book ?? false,
  }
}

function useAuthUserId() {
  const [userId, setUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setUserId(data.user?.id ?? null)
      setAuthReady(true)
    })

    // 명시적 SIGNED_OUT 이외의 이벤트가 session=null 로 잠시 발화될 수 있어
    // (INITIAL_SESSION 직후 TOKEN_REFRESHED 등) userId 를 null 로 내리면
    // SWR 키가 깜빡이며 데이터가 사라졌다 돌아오는 플리커가 발생.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT') {
        setUserId(null)
        return
      }
      const next = session?.user?.id
      if (next) setUserId(next)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { userId, authReady }
}

async function fetchTexts(userId: string): Promise<LibraryText[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('texts')
    .select(
      '*, library_books (id, title, author, cefr_level, cefr_band, book_v_level, chapter_count, cover_from, cover_to, lexical_coverage, cover_image_url, is_picture_book)',
    )
    .eq('user_id', userId)
    .order('last_opened', { ascending: false, nullsFirst: false })

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[useTexts] fetch error:', error)
    return []
  }

  const rows = (data ?? []) as unknown as JoinedRow[]

  // library_book_id (curated) → bookGroups
  // user_book_group_id (사용자 직접 입력 책) → userBookGroups
  // 둘 다 없는 row → standalone (단일 스크립트)
  const bookGroups = new Map<string, JoinedRow[]>()
  const userBookGroups = new Map<string, JoinedRow[]>()
  const standalone: JoinedRow[] = []
  for (const r of rows) {
    const bid = r.library_book_id
    const ugid = (r as JoinedRow & { user_book_group_id: string | null })
      .user_book_group_id
    if (bid) {
      const arr = bookGroups.get(bid) ?? []
      arr.push(r)
      bookGroups.set(bid, arr)
    } else if (ugid) {
      const arr = userBookGroups.get(ugid) ?? []
      arr.push(r)
      userBookGroups.set(ugid, arr)
    } else {
      standalone.push(r)
    }
  }

  const out: LibraryText[] = []
  for (const [bookId, chapters] of bookGroups) {
    out.push(aggregateBookChapters(bookId, chapters))
  }
  for (const [groupId, chapters] of userBookGroups) {
    out.push(aggregateUserBookChapters(groupId, chapters))
  }
  // ACP 기사에서 시작한 글의 표지 메타 — `texts` 에 출처 컬럼이 없어 한 번 더 조회한다.
  //   조회는 마커가 있을 때만 일어난다(기사를 하나도 안 담은 사용자는 추가 왕복 0).
  const articleIds = standalone
    .map((r) => articleIdFromMarker(r.source_url))
    .filter((v): v is string => !!v)
  const articleMeta = new Map<string, ArticleCoverMeta>()
  if (articleIds.length) {
    const { data: arts } = await supabase
      .from('library_articles')
      .select('id, source, reading_minutes')
      .in('id', [...new Set(articleIds)])
    for (const a of (arts ?? []) as Array<{
      id: string
      source: string | null
      reading_minutes: number | null
    }>) {
      articleMeta.set(a.id, { source: a.source, readingMinutes: a.reading_minutes })
    }
  }

  for (const r of standalone) {
    out.push(mapDbToLibraryText(r, articleMeta))
  }
  // lastStudiedAt DESC, null 마지막
  out.sort((a, b) => {
    const at = a.lastStudiedAt?.getTime() ?? 0
    const bt = b.lastStudiedAt?.getTime() ?? 0
    return bt - at
  })
  return out
}

export interface UseTextsResult {
  texts: LibraryText[]
  isLoading: boolean
  error: Error | null
  stats: {
    total: number
    conquered: number
    inProgress: number
    notStarted: number
  }
  continueText: LibraryText | null
  refresh: () => void
}

export function useTexts(): UseTextsResult {
  const { userId, authReady } = useAuthUserId()

  const swr = useSWR(
    userId ? ['texts', userId] : null,
    () => fetchTexts(userId!),
    {
      dedupingInterval: 5_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  )

  const texts = swr.data ?? []

  const stats = {
    total: texts.length,
    conquered: texts.filter((t) => t.progressPercent >= 100).length,
    inProgress: texts.filter(
      (t) => t.progressPercent > 0 && t.progressPercent < 100,
    ).length,
    notStarted: texts.filter((t) => t.progressPercent === 0).length,
  }

  const continueText =
    texts
      .filter((t) => t.progressPercent > 0 && t.progressPercent < 100)
      .sort((a, b) => {
        const aTime = a.lastStudiedAt?.getTime() ?? 0
        const bTime = b.lastStudiedAt?.getTime() ?? 0
        return bTime - aTime
      })[0] ?? null

  return {
    texts,
    isLoading: !authReady || (!!userId && swr.isLoading),
    error: (swr.error as Error | undefined) ?? null,
    stats,
    continueText,
    refresh: () => {
      void swr.mutate()
    },
  }
}
