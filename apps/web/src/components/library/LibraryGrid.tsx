// apps/web/src/components/library/LibraryGrid.tsx
//
// v06.32 도서관 v4 — OTT 스타일 3D Coverflow Carousel.
// - 중앙 책 prominent (정면, scale 1, focus)
// - 좌우 책 perspective 3D 회전 + scale + opacity 감쇠
// - iOS native easing (cubic-bezier(0.22, 1, 0.36, 1))
// - 화살표 버튼 + 키보드 ←/→ + 터치 swipe
// - 사이드 책 클릭 시 그 책으로 이동
// - 중앙 책 클릭 시 도서 진입

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'

import { bookCover } from '@/lib/library/book-cover'
import { NetflixDetailSheet, type DetailVariant } from '@/components/library/shared/NetflixDetailSheet'

export interface PublishedBook {
  id: string
  title: string
  author: string | null
  cefr_level: string | null
  cefr_band: string | null
  book_v_level: number | null
  word_count: number | null
  chapter_count: number | null
  reading_minutes: number | null
  word_set_count?: number
  cover_from?: string | null
  cover_to?: string | null
  // v06.34 — 큐레이션 메타 (library_seed_catalog join)
  synopsis_ko?: string | null
  learning_value?: string | null
  themes?: string[] | null
  est_basis?: string | null
  est_cefr?: string | null
  age_band?: string | null
  genre_norm?: string | null
  description_en?: string | null
}

interface LibraryGridProps {
  books: PublishedBook[]
}

// iOS native easing — Apple HIG interactive curves.
const IOS_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const CAROUSEL_DURATION = 620 // ms

// 거리별 책 변형 — OTT Coverflow 3D + 사이드 가독성 우선.
function cardTransform(offset: number) {
  const abs = Math.abs(offset)
  if (abs > 3) {
    return {
      transform: `translate3d(${Math.sign(offset) * 660}px, 0, -700px) rotateY(${
        offset * -20
      }deg) scale(0.45)`,
      opacity: 0,
      zIndex: 0,
      pointerEvents: 'none' as const,
    }
  }
  const sign = Math.sign(offset)
  // ±1: 200px, ±2: 360px, ±3: 510px
  const x = sign * (abs === 0 ? 0 : 200 + (abs - 1) * 160)
  const z = -abs * 60
  // 회전 최소화 — 사이드 표지 텍스트 정면감 유지
  const rotY = -offset * 13
  // scale 덜 감소 — 사이드도 충분히 큼
  const scale = 1 - abs * 0.07
  // 사이드 opacity 강화 — 색·텍스트 진하게
  const opacity = abs === 0 ? 1 : abs === 1 ? 0.96 : abs === 2 ? 0.8 : 0.6
  return {
    transform: `translate3d(${x}px, 0, ${z}px) rotateY(${rotY}deg) scale(${scale})`,
    opacity,
    zIndex: 30 - abs,
    pointerEvents: 'auto' as const,
  }
}

export function LibraryGrid({ books }: LibraryGridProps) {
  const [active, setActive] = useState(0)
  const [detail, setDetail] = useState<DetailVariant | null>(null)
  const touchStartX = useRef<number | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  function openDetail(book: PublishedBook) {
    setDetail({
      type: 'book',
      id: book.id,
      title: book.title,
      author: book.author,
      cefrBand: book.cefr_band,
      cefrLevel: book.cefr_level,
      bookVLevel: book.book_v_level,
      wordCount: book.word_count,
      chapterCount: book.chapter_count,
      readingMinutes: book.reading_minutes,
      wordSetCount: book.word_set_count,
      coverFrom: book.cover_from,
      coverTo: book.cover_to,
      ctaHref: `/library/books/${book.id}`,
      ctaLabel: '학습 시작',
      // v06.34 — 큐레이션 메타 (library_seed_catalog 에서 join)
      synopsisKo: book.synopsis_ko,
      learningValue: book.learning_value,
      themes: book.themes,
      estBasis: book.est_basis,
      estCefr: book.est_cefr,
      ageBand: book.age_band,
      genreNorm: book.genre_norm,
      descriptionEn: book.description_en,
    })
  }

  const last = books.length - 1
  const prev = useCallback(() => {
    setActive((i) => Math.max(0, i - 1))
  }, [])
  const next = useCallback(
    () => {
      setActive((i) => Math.min(last, i + 1))
    },
    [last],
  )
  const goTo = useCallback(
    (idx: number) => {
      setActive(Math.max(0, Math.min(last, idx)))
    },
    [last],
  )

  // 키보드 네비
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next])

  // 터치 swipe (50px 임계값)
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current
    const delta = endX - touchStartX.current
    if (Math.abs(delta) > 50) {
      delta > 0 ? prev() : next()
    }
    touchStartX.current = null
  }

  if (books.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-3 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-20 text-center"
      >
        <div className="select-none text-4xl" aria-hidden>
          📚
        </div>
        <h3 className="font-display text-[15px] font-[700] text-[var(--t1)]">
          아직 게시된 도서가 없어요
        </h3>
      </div>
    )
  }

  const activeBook = books[active]!

  return (
    <div role="list" className="flex flex-col items-center gap-6">
      {/* Stage — 3D perspective + 좌우 화살표 */}
      <div className="relative w-full">
        {/* Soft floor gradient (책 아래 ambient) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-black/10"
        />

        <div
          ref={stageRef}
          className="relative mx-auto flex h-[460px] w-full max-w-[1280px] items-center justify-center"
          style={{ perspective: '1800px', perspectiveOrigin: '50% 55%' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {books.map((book, idx) => {
            const offset = idx - active
            const transform = cardTransform(offset)
            const isActive = idx === active
            return (
              <div
                key={book.id}
                role="listitem"
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(-50%, -50%) ${transform.transform}`,
                  opacity: transform.opacity,
                  zIndex: transform.zIndex,
                  pointerEvents: transform.pointerEvents,
                  transition: `transform ${CAROUSEL_DURATION}ms ${IOS_EASING}, opacity ${CAROUSEL_DURATION}ms ${IOS_EASING}`,
                  transformStyle: 'preserve-3d',
                  willChange: 'transform, opacity',
                }}
              >
                <CarouselBook
                  book={book}
                  isActive={isActive}
                  onSideClick={() => goTo(idx)}
                  onCenterClick={() => openDetail(book)}
                />
              </div>
            )
          })}
        </div>

        {/* 좌우 화살표 — 큰 circular */}
        <button
          type="button"
          onClick={prev}
          disabled={active === 0}
          aria-label="이전 도서"
          className="absolute left-2 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--bd)] bg-[var(--bg)]/80 text-[var(--t1)] shadow-[var(--sh-md)] backdrop-blur-md transition-all hover:scale-110 hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 md:left-6"
        >
          <ChevronLeft size={22} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={next}
          disabled={active === last}
          aria-label="다음 도서"
          className="absolute right-2 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--bd)] bg-[var(--bg)]/80 text-[var(--t1)] shadow-[var(--sh-md)] backdrop-blur-md transition-all hover:scale-110 hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 md:right-6"
        >
          <ChevronRight size={22} strokeWidth={2} aria-hidden />
        </button>
      </div>

      {/* 활성 책 메타 (Hero info under carousel) */}
      <div
        key={activeBook.id} // 책 바뀔 때 fade
        className="flex max-w-xl flex-col items-center gap-2 px-4 text-center"
        style={{ animation: `fadeInUp 0.5s ${IOS_EASING}` }}
      >
        <h2 className="font-english text-[22px] font-[700] leading-tight text-[var(--t1)] md:text-[26px]">
          {activeBook.title}
        </h2>
        {activeBook.author && (
          <p className="font-body text-[13px] text-[var(--t3)]">{activeBook.author}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-[var(--t3)]">
          {(activeBook.cefr_band ?? activeBook.cefr_level) && (
            <span className="rounded-[var(--r-sm)] bg-[var(--bg3)] px-2 py-0.5 font-display text-[10px] font-[700] text-[var(--t2)]">
              {activeBook.cefr_band ?? activeBook.cefr_level}
            </span>
          )}
          {activeBook.book_v_level != null && (
            <span className="rounded-[var(--r-sm)] bg-[#FBBF24]/15 px-2 py-0.5 font-display text-[10px] font-[700] text-[#92400E]">
              V{activeBook.book_v_level}
            </span>
          )}
          {activeBook.chapter_count != null && <span>{activeBook.chapter_count}장</span>}
          {activeBook.reading_minutes != null && activeBook.reading_minutes > 0 && (
            <span>·  {Math.round(activeBook.reading_minutes / 60)}h</span>
          )}
          {activeBook.word_set_count != null && activeBook.word_set_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[#8B5CF6]">
              ·  <Sparkles size={9} aria-hidden />
              {activeBook.word_set_count}개 단어장
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => openDetail(activeBook)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--r-md)] bg-[var(--t1)] px-5 py-2.5 font-display text-[13px] font-[700] text-[var(--bg)] shadow-[var(--sh-sm)] transition-all hover:scale-[1.03] active:scale-[0.97]"
        >
          상세 보기
        </button>
      </div>

      {/* Dot indicator */}
      <div role="tablist" aria-label="도서 선택" className="flex items-center gap-2">
        {books.map((b, idx) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={idx === active}
            aria-label={`${idx + 1} / ${books.length}: ${b.title}`}
            onClick={() => goTo(idx)}
            className={`h-1.5 rounded-full transition-all duration-[${CAROUSEL_DURATION}ms] ${
              idx === active
                ? 'w-6 bg-[var(--t1)]'
                : 'w-1.5 bg-[var(--t3)]/40 hover:bg-[var(--t3)]'
            }`}
          />
        ))}
      </div>

      {/* fadeInUp keyframes — inline */}
      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <NetflixDetailSheet variant={detail} onClose={() => setDetail(null)} />
    </div>
  )
}

// ─── Carousel Book Card ─────────────────────────────────
function CarouselBook({
  book,
  isActive,
  onSideClick,
  onCenterClick,
}: {
  book: PublishedBook
  isActive: boolean
  onSideClick: () => void
  onCenterClick: () => void
}) {
  const cover = bookCover({
    title: book.title,
    bookVLevel: book.book_v_level,
    coverFrom: book.cover_from,
    coverTo: book.cover_to,
  })

  const inner = (
    <div
      className={`book-cover-premium relative aspect-[3/4] w-[270px] overflow-hidden ${
        isActive ? 'book-cover-premium--center' : ''
      }`}
      style={{
        background: `
          radial-gradient(120% 80% at 25% 12%, rgba(255,255,255,0.22) 0%, transparent 45%),
          linear-gradient(155deg, ${cover.from} 0%, ${cover.to} 78%, rgba(0,0,0,0.18) 100%)
        `,
      }}
    >
      {/* 책등 좌측 — 3-stop + highlight */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-[8px] bg-gradient-to-r from-black/45 via-black/22 to-transparent"
      />
      <div aria-hidden className="absolute inset-y-0 left-[7px] w-[1px] bg-white/15" />
      {/* 상단 sheen + grain */}
      <div aria-hidden className="book-cover-sheen absolute inset-0" />
      <div aria-hidden className="book-cover-grain absolute inset-0" />

      {/* CEFR + V-Level 상단 우측 */}
      <div className="absolute right-3.5 top-3.5 flex flex-col items-end gap-1">
        {(book.cefr_band ?? book.cefr_level) && (
          <span className="inline-flex items-center rounded-[3px] bg-white/95 px-2 py-0.5 font-mono text-[10.5px] font-[700] tracking-tight text-[var(--t1)] shadow-[0_2px_4px_rgba(0,0,0,0.18)]">
            {book.cefr_band ?? book.cefr_level}
          </span>
        )}
        {book.book_v_level != null && (
          <span className="inline-flex items-center rounded-[3px] bg-black/60 px-2 py-0.5 font-mono text-[10.5px] font-[700] tracking-tight text-white backdrop-blur-sm">
            V{book.book_v_level}
          </span>
        )}
      </div>

      {/* 단어장 indicator */}
      {book.word_set_count != null && book.word_set_count > 0 && (
        <span
          aria-hidden
          className="absolute left-3 top-3 inline-flex items-center justify-center rounded-full bg-white/20 p-1 text-white/95 backdrop-blur-sm"
          title="챕터 단어장 포함"
        >
          <Sparkles size={10} />
        </span>
      )}

      {/* 제목 + 저자 */}
      <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col justify-between p-6 text-white">
        <div />
        <div className="flex flex-col gap-2">
          <h3 className="line-clamp-4 font-display text-[22px] font-[800] leading-[1.15] tracking-[-0.02em] drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)]">
            {book.title}
          </h3>
          {book.author && (
            <>
              <span aria-hidden className="h-px w-6 bg-white/45" />
              <p className="line-clamp-1 font-body text-[12.5px] font-[500] text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
                {book.author}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )

  // 활성 책 클릭 → Netflix sheet · 사이드 책 클릭 → 해당 책으로 이동
  return (
    <button
      type="button"
      onClick={isActive ? onCenterClick : onSideClick}
      className={`block rounded-[10px] focus-visible:outline-none ${
        isActive
          ? 'focus-visible:ring-4 focus-visible:ring-[var(--p)]/40 focus-visible:ring-offset-4'
          : 'focus-visible:ring-2 focus-visible:ring-[var(--p)]/40'
      }`}
      aria-label={isActive ? `${book.title} 상세 보기` : `${book.title} 으로 이동`}
    >
      {inner}
    </button>
  )
}
