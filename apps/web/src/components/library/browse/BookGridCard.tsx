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
import { coverFitFor } from '@/lib/library/cover-fit'
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
  const coverFit = coverFitFor(book)
  const fit = judgeIPlusOne(book.lexical_coverage, userVLevel, book.is_picture_book)
  const state = book.enrollment_state ?? 'not_enrolled'

  return (
    <button
      type="button"
      onClick={() => onOpen(book)}
      aria-label={`${book.title}${book.author ? ` · ${book.author}` : ''} 상세 보기`}
      // ⚠️ `w-full` 이 없으면 버튼이 **내용 너비로 줄어든다.** 격자는 6열 균등인데 칸 안에서
      // 카드가 제목 길이만큼만 넓어져, 표지(w-full)가 그 폭을 그대로 따라 제각각이 됐다 —
      // 실측 2026-08-15: 같은 행에서 63px(`Fables`) ~ 150px. 서가가 어수선해 보이던 진짜
      // 원인이고, 비율(3:4)은 내내 정확했다. 폭이 흔들리고 있었을 뿐이다.
      className="group flex w-full flex-col gap-2 rounded-[10px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]/40 focus-visible:ring-offset-2"
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
            {/* 그림책 표지는 가로 삽화 크롭이라 cover 로 채우면 좌우 64% 가 잘린다(실측).
                그때만 contain + 같은 이미지를 흐리게 깔아 여백을 메운다. */}
            {coverFit.blurBackdrop && (
              <Image
                src={coverImageUrl}
                alt=""
                aria-hidden
                fill
                sizes="(max-width: 768px) 45vw, 200px"
                className="scale-110 object-cover blur-xl saturate-150"
              />
            )}
            <Image
              src={coverImageUrl}
              alt={`${book.title} 표지`}
              fill
              sizes="(max-width: 768px) 45vw, 200px"
              className={`relative ${coverFit.objectFit}`}
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
              // --success 는 다크에서 밝은 초록(#5BA47D)이라 흰 글자와 2.9:1 이었다(2026-08-09 axe).
              // --memory-stable(#2E7D5A)은 양 테마 동일값이라 흰 글자로 5.0:1 확보.
              className="inline-flex items-center gap-0.5 rounded-[var(--r-full)] px-1.5 py-0.5 font-display text-[9px] font-[700] text-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
              style={{ background: 'var(--memory-stable)' }}
              title="완독한 도서"
            >
              <Check size={9} strokeWidth={2.5} aria-hidden /> 완독
            </span>
          )}
          {state === 'in_progress' && (
            <span
              className="inline-flex items-center gap-0.5 rounded-[var(--r-full)] bg-[var(--p)] px-1.5 py-0.5 font-display text-[9px] font-[700] text-[var(--on-p)] shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
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

      {/*
        제목 + 저자 — **높이를 예약한다.**
        서가가 서가처럼 보이는 이유는 책등이 한 줄로 맞기 때문이다. 제목이 1~2줄,
        저자가 0~1줄, 칩이 0~2줄로 흔들리면 카드 높이가 제각각이 되고(실측: 한 화면에
        9종) 격자의 기준선이 무너진다. 내용이 짧아도 자리는 남겨 둔다.
          제목 2줄 = 13.5px × leading-tight(1.25) × 2 ≈ 34px
          저자 1줄 = 11px × 1.45 ≈ 16px
      */}
      <div className="flex flex-col gap-0.5 px-0.5">
        <h3 className="line-clamp-2 min-h-[34px] font-english text-[13.5px] font-[600] leading-tight text-[var(--t1)]">
          {book.title}
        </h3>
        {/* 저자가 없어도 행은 남긴다 — 있는 카드와 없는 카드의 높이가 갈리지 않게 */}
        <p className="line-clamp-1 min-h-[16px] font-body text-[11px] text-[var(--t2)]">
          {book.author ?? ' '}
        </p>

        {/*
          배지 줄 — **정확히 한 줄만.** 예전엔 `flex-wrap` 이라 칩이 두 줄로 흘러 카드가
          그만큼 더 길어졌다. 넘치는 칩은 자르고(overflow-hidden) 줄바꿈을 막는다.
          비어 있어도 높이는 유지해 카드 사이 기준선을 맞춘다.
        */}
        <div className="mt-1 flex h-[18px] items-center gap-1 overflow-hidden whitespace-nowrap">
          {/* i+1 적합도 (진단 시) */}
          {fit && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-[var(--r-full)] border px-1.5 py-0.5 font-display text-[9.5px] font-[700]"
              style={{ color: fit.color, borderColor: fit.color }}
              title={`V${userVLevel} 학습자가 아는 단어 ${fit.coverage}%`}
            >
              <span aria-hidden className="h-1 w-1 rounded-full" style={{ backgroundColor: fit.color }} />
              {fit.label}
              <span className="font-mono">{fit.coverage}%</span>
            </span>
          )}

          {/* 추천 사유 칩 — fit 배지가 없을 때만 (인지 부하 절약) */}
          {!fit &&
            reasons.map((r) => (
              <span
                key={r}
                className="inline-flex shrink-0 items-center gap-0.5 rounded-[var(--r-full)] bg-[var(--bg3)] px-1.5 py-0.5 font-display text-[9px] font-[600] text-[var(--t2)]"
              >
                {r === '원어민 음성' && <Sparkles size={8} aria-hidden />}
                {r}
              </span>
            ))}
        </div>
      </div>
    </button>
  )
}
