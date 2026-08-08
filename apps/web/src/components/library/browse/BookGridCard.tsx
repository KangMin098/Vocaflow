// apps/web/src/components/library/browse/BookGridCard.tsx
//
// 탐색 그리드 도서 타일 — 표지(실 이미지 or 그라디언트) + 제목 + i+1 적합도 배지 + 추천 사유 칩.
// 클릭 시 NetflixDetailSheet (BooksExplorer 가 상태 보유). 표지 비주얼은 LibraryGrid 캐러셀과
// 동일한 .book-cover-* CSS + bookCover/GradientBookCover 재사용 (시각 일관성).

'use client'

import Image from 'next/image'
import { Check, Sparkles, Volume2 } from 'lucide-react'

import { ComicBadge } from '@/components/comic/ComicBadge'
import { bookCover } from '@/lib/library/book-cover'
import { GradientBookCover } from '@/components/library/shared/GradientBookCover'
import { judgeIPlusOne } from '@/lib/library/i-plus-one'
import type { PublishedBook } from '@/lib/library/published-book'

interface Props {
  book: PublishedBook
  userVLevel: number
  /** recommend-books.scoreBook 의 사유 (최대 2개). */
  reasons?: string[]
  onOpen: (book: PublishedBook) => void
}

export function BookGridCard({ book, userVLevel, reasons = [], onOpen }: Props) {
  const cover = bookCover({
    title: book.title,
    bookVLevel: book.book_v_level,
    coverFrom: book.cover_from,
    coverTo: book.cover_to,
  })
  const coverImageUrl = book.cover_image_url ?? null
  const fit = judgeIPlusOne(book.lexical_coverage, userVLevel, book.is_picture_book)
  const state = book.enrollment_state ?? 'not_enrolled'

  return (
    <button
      type="button"
      onClick={() => onOpen(book)}
      aria-label={`${book.title}${book.author ? ` · ${book.author}` : ''} 상세 보기`}
      className="group flex flex-col gap-2 rounded-[10px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]/40 focus-visible:ring-offset-2"
    >
      {/* 표지 */}
      <div
        className="book-cover-premium relative aspect-[3/4] w-full overflow-hidden transition-transform duration-[var(--dur-normal)] group-hover:-translate-y-0.5"
        style={{
          background: coverImageUrl
            ? '#0B0B0F'
            : `
              radial-gradient(120% 80% at 25% 12%, rgba(255,255,255,0.22) 0%, transparent 45%),
              linear-gradient(155deg, ${cover.from} 0%, ${cover.to} 78%, rgba(0,0,0,0.18) 100%)
            `,
        }}
      >
        {coverImageUrl ? (
          <>
            <Image
              src={coverImageUrl}
              alt={`${book.title} 표지`}
              fill
              sizes="(max-width: 768px) 45vw, 200px"
              className="object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35"
            />
            <div aria-hidden className="book-cover-laminate absolute inset-0" />
          </>
        ) : (
          <>
            <GradientBookCover title={book.title} author={book.author} compact />
            <div aria-hidden className="book-cover-sheen absolute inset-0" />
            <div aria-hidden className="book-cover-grain absolute inset-0" />
          </>
        )}

        {/* 입체 책등 + 페이지 단면 */}
        <div aria-hidden className="book-spine3d" />
        <div aria-hidden className="book-foreedge" />

        {/* 우상단 CEFR + V */}
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
          {(book.cefr_band ?? book.cefr_level) && (
            <span className="inline-flex items-center rounded-[3px] bg-white/95 px-1.5 py-0.5 font-mono text-[9.5px] font-[700] tracking-tight text-[var(--t1)] shadow-[0_2px_4px_rgba(0,0,0,0.18)]">
              {book.cefr_band ?? book.cefr_level}
            </span>
          )}
          {book.book_v_level != null && (
            <span className="inline-flex items-center rounded-[3px] bg-black/60 px-1.5 py-0.5 font-mono text-[9.5px] font-[700] tracking-tight text-white backdrop-blur-sm">
              V{book.book_v_level}
            </span>
          )}
        </div>

        {/* 좌상단 enrollment + 단어장 */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {state === 'completed' && (
            <span
              className="inline-flex items-center gap-0.5 rounded-[var(--r-full)] bg-[var(--success)] px-1.5 py-0.5 font-display text-[9px] font-[700] text-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
              title="완독한 도서"
            >
              <Check size={9} strokeWidth={2.5} aria-hidden /> 완독
            </span>
          )}
          {state === 'in_progress' && (
            <span
              className="inline-flex items-center gap-0.5 rounded-[var(--r-full)] bg-[var(--p)] px-1.5 py-0.5 font-display text-[9px] font-[700] text-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
              title={`학습 중 · ${book.progress_pct ?? 0}%`}
            >
              ● {book.progress_pct ?? 0}%
            </span>
          )}
          {state === 'enrolled' && (
            <span
              className="inline-flex items-center gap-0.5 rounded-[var(--r-full)] bg-white/95 px-1.5 py-0.5 font-display text-[9px] font-[700] text-[var(--p)] shadow-[0_2px_6px_rgba(0,0,0,0.18)]"
              title="내 학습에 추가됨"
            >
              <Check size={9} strokeWidth={2.5} aria-hidden /> 내 학습
            </span>
          )}
          {book.has_audio && (
            <span
              aria-hidden
              className="inline-flex w-fit items-center justify-center rounded-full bg-black/45 p-1 text-white/95 backdrop-blur-sm"
              title="원어민 음성"
            >
              <Volume2 size={9} />
            </span>
          )}
          {/* 포맷 — 만화로도 볼 수 있는 도서 (CCP) */}
          {book.has_comic && <ComicBadge variant="tile" />}
        </div>

        {/* in_progress 진행 바 */}
        {state === 'in_progress' && (
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-black/30">
            <div
              className="h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
              style={{ width: `${book.progress_pct ?? 0}%` }}
            />
          </div>
        )}
      </div>

      {/* 제목 + 저자 */}
      <div className="flex flex-col gap-0.5 px-0.5">
        <h3 className="line-clamp-2 font-english text-[13.5px] font-[600] leading-tight text-[var(--t1)]">
          {book.title}
        </h3>
        {book.author && (
          <p className="line-clamp-1 font-body text-[11px] text-[var(--t3)]">{book.author}</p>
        )}

        {/* i+1 적합도 (진단 시) */}
        {fit && (
          <span
            className="mt-1 inline-flex w-fit items-center gap-1 rounded-[var(--r-full)] border px-1.5 py-0.5 font-display text-[9.5px] font-[700]"
            style={{ color: fit.color, borderColor: fit.color }}
            title={`V${userVLevel} 학습자가 아는 단어 ${fit.coverage}%`}
          >
            <span aria-hidden className="h-1 w-1 rounded-full" style={{ backgroundColor: fit.color }} />
            {fit.label}
            <span className="font-mono opacity-70">{fit.coverage}%</span>
          </span>
        )}

        {/* 추천 사유 칩 — fit 배지가 없을 때만 (인지 부하 절약) */}
        {!fit && reasons.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {reasons.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-0.5 rounded-[var(--r-full)] bg-[var(--bg3)] px-1.5 py-0.5 font-display text-[9px] font-[600] text-[var(--t2)]"
              >
                {r === '원어민 음성' && <Sparkles size={8} aria-hidden />}
                {r}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
