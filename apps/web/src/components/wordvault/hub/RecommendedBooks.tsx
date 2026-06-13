// apps/web/src/components/wordvault/hub/RecommendedBooks.tsx
//
// WordVault Portfolio — i+1 권장 도서 (v06.35).
//
// recommend-books.ts scoreBook 으로 사용자 V-Level 기반 점수 매김.
// 도서 학습 단어 시각에서: book_v_level + lexical_coverage 가 핵심.
// 상위 3-4권 list 표시 (스크롤 X · 한눈에).

'use client'

import { ArrowRight, BookOpen, Compass } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { judgeIPlusOne } from '@/lib/library/i-plus-one'
import { scoreBook } from '@/lib/library/recommend-books'
import type { PublishedBook } from '@/lib/library/published-book'

type State =
  | { kind: 'loading' }
  | { kind: 'unauth' }
  | { kind: 'no-diagnostic' }
  | { kind: 'empty' }
  | { kind: 'ready'; vLevel: number; books: PublishedBook[] }
  | { kind: 'error'; message: string }

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

      // 출시 도서 fetch + 사용자 진도 도서 제외
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
          'id, title, author, cefr_level, cefr_band, book_v_level, word_count, chapter_count, reading_minutes, ' +
            'cover_from, cover_to, cover_image_url, lexical_coverage, popularity_rank, published_at',
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

  // 점수 매김 + 상위 4권 (한눈에)
  const ranked = useMemo(() => {
    if (state.kind !== 'ready') return []
    return state.books
      .map((b) => {
        const s = scoreBook(b, { userVLevel: state.vLevel, userMastery: 'warm' })
        const fit = judgeIPlusOne(b.lexical_coverage, state.vLevel)
        return { book: b, score: s.score, reasons: s.reasons, fit }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
  }, [state])

  if (state.kind === 'unauth' || state.kind === 'no-diagnostic') {
    return (
      <Frame title="다음 권장 도서">
        <p className="font-body text-[14px] leading-relaxed text-[var(--t2)]">
          진단을 마치면 V-Level 에 맞는 도서 4권을 추천해드려요.{' '}
          <Link
            href="/diagnostic"
            className="inline-flex items-baseline gap-1 font-display font-[600] text-[var(--p)] underline-offset-2 hover:underline"
          >
            <Compass size={13} aria-hidden />
            진단 받기 <ArrowRight size={12} aria-hidden />
          </Link>
        </p>
      </Frame>
    )
  }

  if (state.kind === 'loading') {
    return (
      <Frame title="다음 권장 도서">
        <p className="font-body text-[13px] text-[var(--t3)]">불러오는 중…</p>
      </Frame>
    )
  }

  if (state.kind === 'empty' || state.kind === 'error' || ranked.length === 0) {
    return (
      <Frame title="다음 권장 도서">
        <p className="font-body text-[13px] text-[var(--t3)]">
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
    <Frame title="다음 권장 도서" meta={`V${state.kind === 'ready' ? state.vLevel : '?'} 기준 · i+1`}>
      <ol className="flex flex-col">
        {ranked.map((r, i) => (
          <li key={r.book.id} className="border-b border-[var(--bd)] last:border-b-0">
            <Link
              href={`/library/books/${r.book.id}`}
              className="group flex items-center gap-4 py-3 transition-colors duration-[var(--dur-fast)] hover:bg-[var(--bg2)]"
            >
              <span className="w-6 shrink-0 font-mono text-[11px] font-[700] tabular-nums text-[var(--t4)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <BookOpen
                size={16}
                aria-hidden
                className="shrink-0 text-[var(--t3)] group-hover:text-[var(--p)]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="line-clamp-1 font-display text-[13px] font-[600] text-[var(--t1)]">
                    {r.book.title}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[10px] text-[var(--t3)]">
                  {r.book.author && <span className="truncate">{r.book.author}</span>}
                  {r.book.book_v_level != null && (
                    <>
                      {r.book.author && <span aria-hidden className="text-[var(--t4)]">·</span>}
                      <span className="tabular-nums">V{r.book.book_v_level}</span>
                    </>
                  )}
                  {r.book.cefr_band && (
                    <>
                      <span aria-hidden className="text-[var(--t4)]">·</span>
                      <span>CEFR {r.book.cefr_band}</span>
                    </>
                  )}
                  {r.fit && r.fit.tier && (
                    <>
                      <span aria-hidden className="text-[var(--t4)]">·</span>
                      <span
                        className={`font-display font-[700] ${
                          r.fit.tier === 'ideal'
                            ? 'text-[var(--success)]'
                            : r.fit.tier === 'challenge'
                              ? 'text-[var(--p)]'
                              : r.fit.tier === 'easy'
                                ? 'text-[var(--t2)]'
                                : 'text-[var(--warning)]'
                        }`}
                      >
                        {r.fit.tier === 'ideal'
                          ? '딱 맞아요'
                          : r.fit.tier === 'challenge'
                            ? '도전'
                            : r.fit.tier === 'easy'
                              ? '쉬워요'
                              : '어려워요'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ArrowRight
                size={13}
                aria-hidden
                className="shrink-0 text-[var(--t4)] transition-colors group-hover:text-[var(--p)]"
              />
            </Link>
          </li>
        ))}
      </ol>

      {/* 라이브러리 전체 */}
      <div className="mt-3 flex justify-end border-t border-[var(--bd)] pt-3">
        <Link
          href="/library/books"
          className="group inline-flex items-center gap-1.5 font-display text-[11.5px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-fast)] hover:text-[var(--p)]"
        >
          전체 라이브러리 둘러보기
          <ArrowRight
            size={11}
            aria-hidden
            className="transition-transform duration-[var(--dur-fast)] group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </Frame>
  )
}

function Frame({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 md:p-7"
    >
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
          {title}
        </span>
        {meta && (
          <span className="font-mono text-[10px] tabular-nums text-[var(--t3)]">{meta}</span>
        )}
      </header>
      {children}
    </section>
  )
}
