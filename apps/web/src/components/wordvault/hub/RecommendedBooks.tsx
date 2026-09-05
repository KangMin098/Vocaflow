// apps/web/src/components/wordvault/hub/RecommendedBooks.tsx
//
// WordVault Section 4 (v06.35 iOS) — App Store style 권장 도서 캐러셀.
//
// iOS App Store "Today" / Books 감성:
//   · 가로 스크롤 카드 (snap)
//   · 큰 그라디언트 표지 (cover_image_url or cover_from→cover_to)
//   · 카드 우측 상단 캡슐 fit-tier 배지
//   · 메타 = author / V-Level / CEFR
//   · 헤더에 "More →" 링크 (iOS section header 패턴)

'use client'

import { Compass } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo } from 'react'

import { Frame, PrimaryButton } from '@/components/ui/ios'
import { judgeIPlusOne } from '@/lib/library/i-plus-one'
import { scoreBook } from '@/lib/library/recommend-books'
import type { PublishedBook } from '@/lib/library/published-book'
import { bookCover } from '@/lib/library/book-cover'

type FitTier = NonNullable<ReturnType<typeof judgeIPlusOne>>['tier']

const FIT_META: Record<FitTier, { label: string; bg: string; color: string }> = {
  ideal: { label: '딱 맞아요', bg: '#E8F8EE', color: '#15803D' },
  challenge: { label: '도전', bg: 'var(--p-light)', color: 'var(--on-p-tint)' },
  easy: { label: '쉬워요', bg: '#F1F5F9', color: '#475569' },
  hard: { label: '어려워요', bg: '#FFF1E5', color: '#9A3412' },
}

interface RecommendedBooksProps {
  /** 이미 등록한 도서를 뺀 발행 도서. 서버가 한 번에 읽어 넘긴다. */
  books: PublishedBook[]
  /** 진단 전이면 `null` — 그때는 추천이 아니라 진단으로 안내한다. */
  vLevel: number | null
}

/**
 * ⚠️ **이 컴포넌트는 스스로 조회하지 않는다** (2026-09-05).
 *
 * 예전에는 마운트 후 `auth.getUser()` → `user_profiles` → `texts` → `library_books`
 * 네 번을 스스로 왕복했다. 허브의 다른 섹션들도 저마다 같은 일을 해서, `/wordvault` 한
 * 화면이 `auth.getUser()` 를 **8번** 부르고 단어 전량을 **두 번** 내려받았다.
 *
 * 지금은 `lib/wordvault/hub-query.ts` 가 서버에서 한 벌로 읽고 내려준다. 여기서 다시
 * 조회를 붙이면 그 낭비가 되살아난다 — 필요한 데이터가 없으면 **props 를 늘려라.**
 */
export function RecommendedBooks({ books, vLevel }: RecommendedBooksProps) {
  const ranked = useMemo(() => {
    if (vLevel == null) return []
    return books
      .map((b) => {
        const s = scoreBook(b, { userVLevel: vLevel, userMastery: 'warm' })
        const fit = judgeIPlusOne(b.lexical_coverage, vLevel, b.is_picture_book)
        return { book: b, score: s.score, reasons: s.reasons, fit }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
  }, [books, vLevel])

  if (vLevel == null) {
    return (
      <Frame title="다음 권장 도서">
        <div className="flex items-center justify-between gap-4 rounded-ios-xl bg-[var(--bg2)] px-5 py-4">
          <p className="font-body text-[13px] text-[var(--t2)]">
            진단을 받으면 수준에 맞는 도서를 추천해드려요.
          </p>
          <PrimaryButton
            href="/diagnostic"
            tone="brand"
            size="sm"
            block={false}
            rightIcon={null}
          >
            <span className="inline-flex items-center gap-2">
              <Compass size={13} aria-hidden />
              진단 받기
            </span>
          </PrimaryButton>
        </div>
      </Frame>
    )
  }

  if (ranked.length === 0) {
    return (
      <Frame title="다음 권장 도서">
        <p className="font-body text-[13px] text-[var(--t2)]">
          모든 권장 도서를 학습 중이에요.{' '}
          <Link
            href="/library/books"
            className="font-display font-[600] text-[var(--p)] underline-offset-2 hover:underline"
          >
            라이브러리 둘러보기 →
          </Link>
        </p>
      </Frame>
    )
  }

  return (
    <Frame
      title="다음 권장 도서"
      meta={`V${vLevel} 기준 · i+1`}
      moreHref="/library/books"
    >
      {/* iOS horizontal scroll snap */}
      <div
        className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {ranked.map((r) => (
          <BookCard
            key={r.book.id}
            book={r.book}
            fit={r.fit ? r.fit.tier : null}
          />
        ))}
      </div>
    </Frame>
  )
}

// ─── iOS App Store 카드 ─────────────────────────────────
function BookCard({
  book,
  fit,
}: {
  book: PublishedBook
  fit: FitTier | null
}) {
  const fitMeta = fit ? FIT_META[fit] : null
  const coverUrl = (book as { cover_image_url?: string | null }).cover_image_url ?? null
  const fromColor = book.cover_from ?? '#3B82F6'
  const toColor = book.cover_to ?? '#1D4ED8'
  // ⚠️ DB 표지색은 아무 값이나 올 수 있다. 흰 제목을 무조건 얹으면 옅은 표지에서 사라진다 —
  //    실측 2026-08-22: 'Introduction to Sociology' 가 옅은 민트 표지에서 **1.1:1** 이었다.
  //    판정은 `bookCover` 가 소유한다(표지가 자기 색에서 잉크를 정한다).
  const { textTone } = bookCover({
    title: book.title,
    bookVLevel: null,
    coverFrom: fromColor,
    coverTo: toColor,
  })
  const coverInk = textTone === 'dark' ? 'text-[#1A1714]' : 'text-white'

  return (
    <Link
      href={`/library/books/${book.id}`}
      className="group flex w-[156px] shrink-0 flex-col gap-3"
      style={{ scrollSnapAlign: 'start' }}
    >
      {/* Cover */}
      <div className="motion-safe:transition-transform motion-safe:duration-[var(--dur-ios-normal)] motion-safe:ease-ios-standard motion-safe:group-hover:-translate-y-1 motion-safe:group-active:scale-[0.97] relative aspect-[2/3] w-full overflow-hidden rounded-[14px] shadow-[0_4px_16px_-4px_rgba(0,0,0,0.18)]">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={book.title}
            fill
            sizes="156px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${fromColor} 0%, ${toColor} 100%)`,
            }}
            aria-hidden
          />
        )}
        {/* 표지 위 darken + 제목 fallback (no image only) */}
        {!coverUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
            <span
              className={`line-clamp-3 font-display text-[12px] font-[700] leading-tight tracking-[-0.01em] ${coverInk}`}
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
            >
              {book.title}
            </span>
          </div>
        )}
        {/* Fit 배지 (캡슐) */}
        {fitMeta && (
          <span
            className="absolute right-2 top-2 rounded-[var(--r-full)] px-2 py-1 font-display text-[10px] font-[700] backdrop-blur-md"
            style={{
              backgroundColor: `${fitMeta.bg}E6`,
              color: fitMeta.color,
            }}
          >
            {fitMeta.label}
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-1 px-1">
        <span className="line-clamp-2 font-display text-[12.5px] font-[600] leading-tight tracking-[-0.01em] text-[var(--t1)]">
          {book.title}
        </span>
        {book.author && (
          <span className="line-clamp-1 font-body text-[11px] text-[var(--t2)]">
            {book.author}
          </span>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {book.book_v_level != null && (
            <MiniChip>V{book.book_v_level}</MiniChip>
          )}
          {book.cefr_band && <MiniChip>{book.cefr_band}</MiniChip>}
        </div>
      </div>
    </Link>
  )
}

function MiniChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[5px] bg-[var(--bg2)] px-2 py-1 font-mono text-[9.5px] font-[600] tabular-nums text-[var(--t2)]">
      {children}
    </span>
  )
}

