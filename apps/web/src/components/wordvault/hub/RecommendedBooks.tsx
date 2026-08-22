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
import { useEffect, useMemo, useState } from 'react'

import { Frame, PrimaryButton } from '@/components/ui/ios'
import { createClient } from '@/lib/supabase/client'
import { judgeIPlusOne } from '@/lib/library/i-plus-one'
import { scoreBook } from '@/lib/library/recommend-books'
import type { PublishedBook } from '@/lib/library/published-book'
import { bookCover } from '@/lib/library/book-cover'

type State =
  | { kind: 'loading' }
  | { kind: 'unauth' }
  | { kind: 'no-diagnostic' }
  | { kind: 'empty' }
  | { kind: 'ready'; vLevel: number; books: PublishedBook[] }
  | { kind: 'error'; message: string }

type FitTier = NonNullable<ReturnType<typeof judgeIPlusOne>>['tier']

const FIT_META: Record<FitTier, { label: string; bg: string; color: string }> = {
  ideal: { label: '딱 맞아요', bg: '#E8F8EE', color: '#15803D' },
  challenge: { label: '도전', bg: 'var(--p-light)', color: 'var(--on-p-tint)' },
  easy: { label: '쉬워요', bg: '#F1F5F9', color: '#475569' },
  hard: { label: '어려워요', bg: '#FFF1E5', color: '#9A3412' },
}

export function RecommendedBooks() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({ kind: 'unauth' })
        return
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('current_v_level')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      const vLevel =
        (profile as { current_v_level: number | null } | null)?.current_v_level ?? null
      if (vLevel == null) {
        setState({ kind: 'no-diagnostic' })
        return
      }

      const { data: enrolled } = await supabase
        .from('texts')
        .select('library_book_id')
        .eq('user_id', user.id)
        .not('library_book_id', 'is', null)
      const enrolledIds = new Set(
        ((enrolled ?? []) as Array<{ library_book_id: string }>).map((e) => e.library_book_id),
      )

      const { data, error } = await supabase
        .from('library_books')
        .select(
          // popularity_rank 는 library_seed_catalog 소유 — library_books 에 없어 select 시 400
          // (인기 가중은 서버 병합 경로(/library/books)만 적용, 허브 추천은 나머지 신호로 스코어)
          'id, title, author, cefr_level, cefr_band, book_v_level, word_count, chapter_count, reading_minutes, ' +
            'cover_from, cover_to, cover_image_url, lexical_coverage, is_picture_book, published_at',
        )
        .eq('status', 'published')
        .eq('copyright_safe_in_kr', true)
        .not('published_at', 'is', null)
        .limit(80)
      if (cancelled) return
      if (error) {
        setState({ kind: 'error', message: error.message })
        return
      }

      const all = ((data ?? []) as unknown as PublishedBook[]).filter(
        (b) => !enrolledIds.has(b.id),
      )
      if (all.length === 0) {
        setState({ kind: 'empty' })
        return
      }
      setState({ kind: 'ready', vLevel, books: all })
    })().catch((e: unknown) => {
      if (cancelled) return
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const ranked = useMemo(() => {
    if (state.kind !== 'ready') return []
    return state.books
      .map((b) => {
        const s = scoreBook(b, { userVLevel: state.vLevel, userMastery: 'warm' })
        const fit = judgeIPlusOne(b.lexical_coverage, state.vLevel, b.is_picture_book)
        return { book: b, score: s.score, reasons: s.reasons, fit }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
  }, [state])

  if (state.kind === 'unauth' || state.kind === 'no-diagnostic') {
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
            <span className="inline-flex items-center gap-1.5">
              <Compass size={13} aria-hidden />
              진단 받기
            </span>
          </PrimaryButton>
        </div>
      </Frame>
    )
  }

  if (state.kind === 'loading') {
    return (
      <Frame title="다음 권장 도서">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[228px] w-[156px] shrink-0 rounded-[16px] bg-[var(--bg2)]"
              style={{ animation: `pulse 1.6s ease-in-out ${i * 100}ms infinite` }}
            />
          ))}
        </div>
      </Frame>
    )
  }

  if (state.kind === 'empty' || state.kind === 'error' || ranked.length === 0) {
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
      meta={state.kind === 'ready' ? `V${state.vLevel} 기준 · i+1` : undefined}
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
      className="group flex w-[156px] shrink-0 flex-col gap-2.5"
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
            className="absolute right-2 top-2 rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[700] backdrop-blur-md"
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
      <div className="flex flex-col gap-1 px-0.5">
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
    <span className="inline-flex items-center rounded-[5px] bg-[var(--bg2)] px-1.5 py-0.5 font-mono text-[9.5px] font-[600] tabular-nums text-[var(--t2)]">
      {children}
    </span>
  )
}

