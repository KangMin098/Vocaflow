// apps/web/src/components/library/browse/BooksExplorer.tsx
//
// 라이브러리 도서 탐색 오케스트레이터.
//   ① Spotlight  — 기존 LibraryGrid 코버플로우 = "오늘의 추천" 상위 N권 (자체 sheet 보유)
//   ② Rails      — 이어서 학습 · 지금 딱 맞아요(i+1) · 인기 (조건부)
//   ③ Browse     — FilterBar + 반응형 그리드 (전체, 필터/정렬 반응형)
// 추천 점수는 recommend-books.ts (TS 순수 함수)로 클라 useMemo 계산 — 마이그레이션 없음.

'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Compass, PlayCircle, Sparkles, TrendingUp } from 'lucide-react'

import { LibraryGrid } from '@/components/library/LibraryGrid'
import {
  NetflixDetailSheet,
  type DetailVariant,
} from '@/components/library/shared/NetflixDetailSheet'
import { createClient } from '@/lib/supabase/client'
import { unenrollBook } from '@/lib/library/enroll'
import { toBookDetailVariant } from '@/lib/library/book-detail-variant'
import { judgeIPlusOne } from '@/lib/library/i-plus-one'
import {
  AGE_BANDS,
  V_BANDS,
  ageBandOf,
  bucketOf,
  lengthBucket,
  vBandOf,
  type AgeBand,
  type GenreBucket,
  type VBand,
} from '@/lib/library/genres'
import {
  rankBooks,
  scoreBook,
  topRecommended,
  type UserMastery,
} from '@/lib/library/recommend-books'
import type { PublishedBook } from '@/lib/library/published-book'

import { BookGridCard } from './BookGridCard'
import { BookShelfRail } from './BookShelfRail'
import {
  BookFilterBar,
  EMPTY_FILTERS,
  type BookFilters,
  type BookSort,
} from './BookFilterBar'
import { BookQuickPicks } from './BookQuickPicks'

const SPOTLIGHT_N = 10
const RAIL_N = 12

interface Props {
  books: PublishedBook[]
  userVLevel: number
  userMastery: UserMastery
}

function nullsLast(a: number | null | undefined, b: number | null | undefined, dir: 1 | -1) {
  const av = a ?? null
  const bv = b ?? null
  if (av === null && bv === null) return 0
  if (av === null) return 1
  if (bv === null) return -1
  return (av - bv) * dir
}

export function BooksExplorer({ books, userVLevel, userMastery }: Props) {
  const router = useRouter()
  const diagnosed = userVLevel >= 1
  const ctx = useMemo(() => ({ userVLevel, userMastery }), [userVLevel, userMastery])

  const [filters, setFilters] = useState<BookFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<BookSort>('recommended')
  const [detail, setDetail] = useState<DetailVariant | null>(null)
  const [unenrollPending, startUnenroll] = useTransition()

  // 점수 + 사유 (전체 도서 1회) — rail/그리드/추천정렬 공용.
  const reasonsByBook = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const b of books) m.set(b.id, scoreBook(b, ctx).reasons)
    return m
  }, [books, ctx])

  // 스포트라이트 — For You 상위 N.
  const spotlight = useMemo(() => topRecommended(books, ctx, SPOTLIGHT_N), [books, ctx])

  // Rails.
  const continueBooks = useMemo(
    () =>
      books
        .filter((b) => b.enrollment_state === 'in_progress')
        .sort((a, b) => (b.progress_pct ?? 0) - (a.progress_pct ?? 0)),
    [books],
  )
  const justRight = useMemo(() => {
    if (!diagnosed) return []
    const ideal = books.filter(
      (b) => judgeIPlusOne(b.lexical_coverage, userVLevel, b.is_picture_book)?.tier === 'ideal',
    )
    return rankBooks(ideal, ctx)
      .slice(0, RAIL_N)
      .map((r) => r.book)
  }, [books, ctx, diagnosed, userVLevel])
  const popular = useMemo(
    () =>
      [...books]
        .sort((a, b) => nullsLast(a.popularity_rank, b.popularity_rank, 1))
        .slice(0, RAIL_N),
    [books],
  )

  // Facets — 실재하는 값만 칩 노출.
  const facets = useMemo(() => {
    const vbSet = new Set<VBand>()
    const genreSet = new Set<GenreBucket>()
    const ageSet = new Set<AgeBand>()
    const themeFreq = new Map<string, number>()
    let hasAudio = false
    let hasEnrollments = false
    for (const b of books) {
      const vb = vBandOf(b.book_v_level)
      if (vb) vbSet.add(vb)
      genreSet.add(bucketOf(b.genre_norm))
      const ab = ageBandOf(b.age_band)
      if (ab) ageSet.add(ab)
      for (const th of b.themes ?? []) themeFreq.set(th, (themeFreq.get(th) ?? 0) + 1)
      if (b.has_audio) hasAudio = true
      if (b.enrollment_state && b.enrollment_state !== 'not_enrolled') hasEnrollments = true
    }
    // tie-break 은 code-unit 비교 (localeCompare 는 Node↔브라우저 collation 차이로
    // 주제 순서가 엇갈려 hydration mismatch 유발 — 주제 상시 노출 후 표면화).
    const themes = Array.from(themeFreq.entries())
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([t]) => t)
    return {
      vBands: V_BANDS.filter((b) => vbSet.has(b.key)).map((b) => b.key),
      genres: Array.from(genreSet),
      themes,
      ages: AGE_BANDS.filter((a) => ageSet.has(a.key)).map((a) => a.key),
      hasAudio,
      hasEnrollments,
    }
  }, [books])

  // 필터 적용 → 정렬.
  const visible = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const filtered = books.filter((b) => {
      if (q) {
        const hay = `${b.title} ${b.author ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filters.enroll) {
        const st = b.enrollment_state ?? 'not_enrolled'
        if (filters.enroll === 'mine' && st === 'not_enrolled') return false
        if (filters.enroll === 'in_progress' && st !== 'in_progress') return false
        if (filters.enroll === 'completed' && st !== 'completed') return false
      }
      if (filters.fit) {
        const tier = judgeIPlusOne(b.lexical_coverage, userVLevel, b.is_picture_book)?.tier
        if (tier !== filters.fit) return false
      }
      if (filters.vBand && vBandOf(b.book_v_level) !== filters.vBand) return false
      if (filters.genre && bucketOf(b.genre_norm) !== filters.genre) return false
      if (filters.theme && !(b.themes ?? []).includes(filters.theme)) return false
      if (filters.age && ageBandOf(b.age_band) !== filters.age) return false
      if (filters.length && lengthBucket(b.reading_minutes) !== filters.length) return false
      if (filters.audioOnly && !b.has_audio) return false
      return true
    })

    if (sort === 'recommended') {
      return rankBooks(filtered, ctx).map((r) => r.book)
    }
    const arr = [...filtered]
    switch (sort) {
      case 'easy':
        arr.sort((a, b) => nullsLast(a.book_v_level, b.book_v_level, 1))
        break
      case 'hard':
        arr.sort((a, b) => nullsLast(a.book_v_level, b.book_v_level, -1))
        break
      case 'short':
        arr.sort((a, b) => nullsLast(a.reading_minutes, b.reading_minutes, 1))
        break
      case 'popular':
        arr.sort((a, b) => nullsLast(a.popularity_rank, b.popularity_rank, 1))
        break
      case 'new':
        arr.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
        break
    }
    return arr
  }, [books, ctx, filters, sort, userVLevel])

  function handleUnenroll(book: PublishedBook) {
    if (
      !window.confirm(
        `"${book.title}" 을(를) 내 학습에서 제외할까요?\n` +
          '· 챕터 진도와 챕터 단어장 구독이 해제됩니다.\n' +
          '· 사용자가 직접 추가/수정한 단어는 보존됩니다.\n' +
          '· 언제든 다시 추가할 수 있어요.',
      )
    ) {
      return
    }
    startUnenroll(async () => {
      try {
        await unenrollBook(createClient(), book.id)
        setDetail(null)
        router.refresh()
      } catch (e) {
        window.alert(`제외 실패: ${e instanceof Error ? e.message : 'unknown'}`)
      }
    })
  }

  function openDetail(book: PublishedBook) {
    setDetail(
      toBookDetailVariant(book, userVLevel, {
        onUnenroll: () => handleUnenroll(book),
        unenrollPending,
      }),
    )
  }

  if (books.length === 0) {
    return <LibraryGrid books={[]} userVLevel={userVLevel} />
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 미진단 cold-start 배너 */}
      {!diagnosed && (
        <Link
          href="/diagnostic"
          className="flex items-center justify-between gap-3 rounded-[var(--r-lg)] border border-dashed border-[var(--p)]/40 bg-[var(--p-light)]/50 px-4 py-3 transition-colors hover:bg-[var(--p-light)]"
        >
          <span className="inline-flex items-center gap-2 font-body text-[12.5px] text-[var(--t2)]">
            <Compass size={15} aria-hidden className="text-[var(--p)]" />
            레벨을 진단하면 <strong className="font-[700] text-[var(--t1)]">나에게 딱 맞는 책</strong>을
            추천해드려요.
          </span>
          <span className="shrink-0 font-display text-[12.5px] font-[700] text-[var(--p)]">
            진단 →
          </span>
        </Link>
      )}

      {/* ① Spotlight — For You 코버플로우 (LibraryGrid 재사용, 자체 sheet) */}
      <section aria-label="오늘의 추천">
        <LibraryGrid books={spotlight} userVLevel={userVLevel} />
      </section>

      {/* ② Rails */}
      <BookShelfRail
        title="이어서 학습"
        icon={<PlayCircle size={16} aria-hidden />}
        accent="var(--p)"
        books={continueBooks}
        userVLevel={userVLevel}
        reasonsByBook={reasonsByBook}
        onOpen={openDetail}
      />
      <BookShelfRail
        title="지금 딱 맞아요"
        hint="모르는 단어가 적당해 맥락으로 익히기 좋아요"
        icon={<Sparkles size={16} aria-hidden />}
        accent="var(--success)"
        books={justRight}
        userVLevel={userVLevel}
        reasonsByBook={reasonsByBook}
        onOpen={openDetail}
      />
      <BookShelfRail
        title="인기 도서"
        icon={<TrendingUp size={16} aria-hidden />}
        accent="var(--active)"
        books={popular}
        userVLevel={userVLevel}
        reasonsByBook={reasonsByBook}
        onOpen={openDetail}
      />

      {/* ③ Browse — 전체 탐색 */}
      <section className="flex flex-col gap-4" aria-label="전체 도서 탐색">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">전체 탐색</h2>

        <BookQuickPicks
          filters={filters}
          sort={sort}
          diagnosed={diagnosed}
          hasAudio={facets.hasAudio}
          onApply={(f, s) => {
            setFilters(f)
            setSort(s)
          }}
        />

        <BookFilterBar
          filters={filters}
          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          sort={sort}
          onSortChange={setSort}
          resultCount={visible.length}
          totalCount={books.length}
          facets={facets}
          diagnosed={diagnosed}
          userVLevel={userVLevel}
          onReset={() => setFilters(EMPTY_FILTERS)}
        />

        {visible.length === 0 ? (
          <div
            role="status"
            className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-14 text-center"
          >
            <span className="select-none text-3xl" aria-hidden>
              🔎
            </span>
            <p className="font-display text-[14px] font-[700] text-[var(--t1)]">
              조건에 맞는 도서가 없어요
            </p>
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="mt-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
            >
              필터 초기화
            </button>
          </div>
        ) : (
          <div
            role="list"
            className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          >
            {visible.map((book) => (
              <div role="listitem" key={book.id}>
                <BookGridCard
                  book={book}
                  userVLevel={userVLevel}
                  reasons={reasonsByBook.get(book.id)}
                  onOpen={openDetail}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* rail/그리드 공용 상세 sheet (spotlight 은 LibraryGrid 자체 sheet) */}
      <NetflixDetailSheet variant={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
