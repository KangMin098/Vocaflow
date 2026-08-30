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
import { BookOpen, Compass, PlayCircle, Sparkles, TrendingUp } from 'lucide-react'

import { LibraryGrid } from '@/components/library/LibraryGrid'
import {
  NetflixDetailSheet,
  type DetailVariant,
} from '@/components/library/shared/NetflixDetailSheet'
import { createClient } from '@/lib/supabase/client'
import { unenrollBook } from '@/lib/library/enroll'
import { toBookDetailVariant } from '@/lib/library/book-detail-variant'
import { countReadableChapters, judgeIPlusOne } from '@/lib/library/i-plus-one'
import {
  AGE_BANDS,
  LENGTH_BUCKETS,
  V_BANDS,
  ageBandOf,
  bucketOf,
  lengthBucket,
  vBandOf,
  type AgeBand,
  type GenreBucket,
  type LengthBucket,
  type VBand,
} from '@/lib/library/genres'
import {
  rankBooks,
  rankStartHereBooks,
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

/**
 * 전체 탐색 그리드를 **한 번에 몇 장까지 그릴 것인가.**
 *
 * ── 왜 상한이 필요한가 (실측 2026-08-30) ────────────────────────────────
 * 상한이 없을 때 이 화면의 HTML 은 **1.79MB** 였고, 그중 79%(1.42MB)가 발행 316권을
 * 전부 서버 렌더한 카드 DOM 이었다(RSC 데이터는 367KB 로 오히려 작다 — 무게는 데이터가
 * 아니라 **그린 결과**다). 카드 한 장이 약 4.5KB 이므로 이 비용은 카탈로그와 함께
 * **선형으로** 자란다. 발행 대기가 303권 더 있으니 그대로 두면 곧 3MB 를 넘긴다.
 *
 * 학습자 쪽 근거가 같은 방향을 가리킨다 — 316장을 한 화면에 쏟는 것은 고르기를 돕지
 * 않는다(Cognitive Load · Progressive Disclosure). 그래서 **자르는 대신 접는다**:
 * 처음 60장을 그리고, 더 보고 싶은 사람만 60장씩 편다.
 *
 * ⚠️ 추천 레일·스포트라이트는 건드리지 않는다. 그쪽은 이미 상한이 있고(SPOTLIGHT_N·RAIL_N),
 *    "무엇을 먼저 볼지" 를 파는 자리라 접으면 화면의 목적이 사라진다.
 *
 * ⚠️ **접는 것만으로는 안 된다.** 처음 이 상한을 넣었을 때 `33-public-surface` 의
 *    "sitemap 이 알린 주소가 링크로 닿는다" 가 깨졌다 — 316권 중 256권이 화면 어디에서도
 *    링크로 닿지 않는 고아가 됐다. sitemap 에 있는 것과 사이트 안에서 닿는 것은 다른 문제고,
 *    이 저장소는 이미 "검색에 알렸지만 아무도 안 본 화면" 의 값을 치렀다.
 *    그래서 **`?show=all` 이라는 진짜 주소**를 함께 판다 — 버튼(JS·점진)과 별개로
 *    링크(무JS·크롤러) 한 줄이 전량으로 가는 길을 연다. 눌러서 볼 수 있는 것만 알린다.
 *
 * 60인 이유: 가장 넓은 뷰(xl, 6열)에서 10줄이다 — 한 번 더 누르기 전에 스크롤로
 * 충분히 훑을 분량이면서, 초기 HTML 을 약 0.5MB 안에 둔다.
 */
const GRID_PAGE = 60

/** `?show=all` — 전량을 서버에서 그리는 주소. 링크로 닿는 길이자 무JS 폴백. */
export const SHOW_ALL_PARAM = 'show'
export const SHOW_ALL_VALUE = 'all'

interface Props {
  books: PublishedBook[]
  userVLevel: number
  userMastery: UserMastery
  /** `?show=all` 로 들어왔는가 — 그러면 전체 탐색 그리드를 처음부터 전량 그린다. */
  showAll?: boolean
}

function nullsLast(a: number | null | undefined, b: number | null | undefined, dir: 1 | -1) {
  const av = a ?? null
  const bv = b ?? null
  if (av === null && bv === null) return 0
  if (av === null) return 1
  if (bv === null) return -1
  return (av - bv) * dir
}

export function BooksExplorer({ books, userVLevel, userMastery, showAll = false }: Props) {
  const router = useRouter()
  const diagnosed = userVLevel >= 1
  const ctx = useMemo(() => ({ userVLevel, userMastery }), [userVLevel, userMastery])

  const [filters, setFilters] = useState<BookFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<BookSort>('recommended')
  const [detail, setDetail] = useState<DetailVariant | null>(null)
  const [unenrollPending, startUnenroll] = useTransition()
  /** 전체 탐색 그리드에 지금 그려 둔 장수 (GRID_PAGE 주석 참조). */
  const initialShown = showAll ? books.length : GRID_PAGE
  const [shown, setShown] = useState(initialShown)

  // 조건이 바뀌면 펼친 만큼을 되돌린다 — 안 그러면 200장을 펼쳐 둔 채 필터를 바꿨을 때
  // 새 결과 200장이 그대로 쏟아진다(펼침은 **그 목록에 대한** 선택이지 화면의 설정이 아니다).
  //
  // 세터를 감싸지 않고 **렌더 중 조정**을 쓴다(React 공식 패턴). 지금 조건을 바꾸는 곳이
  // 다섯 군데(빠른선택·필터·정렬·초기화·빈결과 초기화)라, 세터마다 리셋을 심으면
  // 하나를 빠뜨리는 순간 조용히 어긋난다 — 그 버그는 눈에 잘 띄지도 않는다.
  const conditionKey = `${sort}|${JSON.stringify(filters)}`
  const [lastConditionKey, setLastConditionKey] = useState(conditionKey)
  if (conditionKey !== lastConditionKey) {
    setLastConditionKey(conditionKey)
    setShown(initialShown)
  }

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
  // "이 책은 여기부터" — 선정·정렬 규칙은 recommend-books.ts 가 단일 출처.
  //   컴포넌트에 인라인으로 두면 회귀를 테스트로 잡을 수 없다.
  const startHere = useMemo(
    () => rankStartHereBooks(books, ctx).slice(0, RAIL_N),
    [books, ctx],
  )

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
    const lengthSet = new Set<LengthBucket>()
    const themeFreq = new Map<string, number>()
    let hasAudio = false
    let hasComic = false
    let hasEnrollments = false
    let hasReadableChapters = false
    for (const b of books) {
      const vb = vBandOf(b.book_v_level)
      if (vb) vbSet.add(vb)
      genreSet.add(bucketOf(b.genre_norm))
      const ab = ageBandOf(b.age_band)
      if (ab) ageSet.add(ab)
      const lb = lengthBucket(b.reading_minutes)
      if (lb) lengthSet.add(lb)
      for (const th of b.themes ?? []) themeFreq.set(th, (themeFreq.get(th) ?? 0) + 1)
      if (b.has_audio) hasAudio = true
      if (b.has_comic) hasComic = true
      if (b.enrollment_state && b.enrollment_state !== 'not_enrolled') hasEnrollments = true
      if ((countReadableChapters(b.chapter_v_hist, userVLevel)?.count ?? 0) > 0)
        hasReadableChapters = true
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
      lengths: LENGTH_BUCKETS.filter((l) => lengthSet.has(l.key)).map((l) => l.key),
      hasAudio,
      hasComic,
      hasEnrollments,
      hasReadableChapters,
    }
  }, [books, userVLevel])

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
      // 책 라벨이 어려워도 **그 안에 지금 읽을 수 있는 챕터**가 있으면 남긴다.
      if (
        filters.readableChaptersOnly &&
        (countReadableChapters(b.chapter_v_hist, userVLevel)?.count ?? 0) === 0
      )
        return false
      if (filters.comicOnly && !b.has_comic) return false
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
      {startHere.length > 0 && (
        <BookShelfRail
          title="이 책은 여기부터"
          hint="책 전체는 아직 어렵지만, 지금 읽을 수 있는 장이 있어요"
          icon={<BookOpen size={16} aria-hidden />}
          accent="var(--active)"
          books={startHere}
          userVLevel={userVLevel}
          reasonsByBook={reasonsByBook}
          onOpen={openDetail}
        />
      )}
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
          hasComic={facets.hasComic}
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
              className="mt-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
            >
              필터 초기화
            </button>
          </div>
        ) : (
          <>
            <div
              role="list"
              className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            >
              {visible.slice(0, shown).map((book) => (
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

            {/* 접힌 나머지 — 몇 권이 더 있는지 **숫자로** 말한다.
                "더 보기" 만 있으면 얼마나 남았는지 몰라 계속 누를지 판단할 수 없다. */}
            {visible.length > shown && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShown((n) => n + GRID_PAGE)}
                  className="min-h-11 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-5 font-display text-[13px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] active:bg-[var(--bg3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                >
                  {Math.min(GRID_PAGE, visible.length - shown)}권 더 보기
                </button>
                <p aria-live="polite" className="font-mono text-[11px] text-[var(--t2)]">
                  {shown} / {visible.length}
                </p>
                {/* 전량으로 가는 **진짜 주소**. 버튼은 JS 가 있어야 듣지만 이건 링크라
                    크롤러도 따라온다 — sitemap 이 알린 도서가 고아가 되지 않게 하는 길이다
                    (위 GRID_PAGE 주석의 33-public-surface 계약). */}
                <Link
                  href={`/library/books?${SHOW_ALL_PARAM}=${SHOW_ALL_VALUE}`}
                  className="min-h-11 items-center font-display text-[12px] font-[600] text-[var(--t2)] underline decoration-[var(--bd)] underline-offset-4 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] inline-flex"
                >
                  전체 {books.length}권 한 번에 보기
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      {/* rail/그리드 공용 상세 sheet (spotlight 은 LibraryGrid 자체 sheet) */}
      <NetflixDetailSheet variant={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
