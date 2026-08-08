// apps/web/src/components/comic/ComicHeroCard.tsx
//
// CCP 라이브러리 히어로 — "만화로 읽기" 프리미엄 발견 카드.
//   딥서치 반영(MasterClass 히어로·Apple product·Linear 카드 hover):
//   실제 첫 컷 아트 블리드 + paper 그라디언트 전이 + 단일 gold CTA + hover lift(scale/nudge).
//   Calm UI: 폭죽 없음 · gold(--active)는 CTA/eyebrow 두 곳만 · 양 테마 · reduced-motion.

'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, BookImage } from 'lucide-react'

export interface ComicHeroItem {
  bookId: string
  title: string
  author: string | null
  vLevel: number | null
  panelsTotal: number
  coverArt: string | null
  href: string
  enrolled: boolean
}

export function ComicHeroCard({ items }: { items: ComicHeroItem[] }) {
  if (items.length === 0) return null
  return (
    <section aria-label="만화로 읽기" className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <BookImage size={15} aria-hidden style={{ color: 'var(--active)' }} />
        <h2 className="font-display text-[13px] font-[700] uppercase tracking-[0.12em] text-[var(--t2)]">
          만화로 읽기
        </h2>
        <span className="font-body text-[12px] text-[var(--t3)]">그림과 정본 대사로 이야기에 먼저 몰입해요</span>
      </div>

      <div className={`grid gap-3 ${items.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {items.map((it) => (
          <Link
            key={it.bookId}
            href={it.href}
            aria-label={`${it.title} 만화로 읽기`}
            className="group relative overflow-hidden rounded-[var(--r-ios-2xl,20px)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)] transition-[transform,box-shadow] duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--sh-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--active)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <div className="grid grid-cols-1 sm:grid-cols-[1.05fr_1fr]">
              {/* 콘텐츠 */}
              <div className="order-2 flex flex-col justify-between gap-4 p-5 sm:order-1">
                <div className="flex flex-col gap-2">
                  <span className="font-display text-[10px] font-[800] uppercase tracking-[0.16em]" style={{ color: 'var(--active)' }}>
                    만화 · Comic
                  </span>
                  <h3 className="font-display text-[22px] font-[800] leading-[1.08] tracking-[-0.01em] text-[var(--t1)] text-balance">
                    {it.title}
                  </h3>
                  {it.author && <p className="font-body text-[12px] text-[var(--t3)]">{it.author}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Meta>{it.panelsTotal}컷</Meta>
                    {it.vLevel != null && <Meta>V{it.vLevel}</Meta>}
                    <Meta>GONICK 화풍</Meta>
                  </div>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-[var(--r-full)] px-4 py-2 font-display text-[13px] font-[700] text-white shadow-[var(--sh-sm)]" style={{ background: 'var(--active)' }}>
                  {it.enrolled ? '만화로 읽기' : '만화 미리보기'}
                  <ArrowRight size={14} aria-hidden className="transition-transform duration-[var(--dur-normal)] group-hover:translate-x-1 motion-reduce:transition-none" />
                </span>
              </div>

              {/* 아트 블리드 + paper 그라디언트 전이 */}
              <div className="relative order-1 min-h-[140px] overflow-hidden bg-[var(--bg2)] sm:order-2">
                {it.coverArt ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.coverArt}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-[var(--dur-slower)] ease-[var(--ease)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-[var(--t4)]">
                    <BookImage size={28} aria-hidden />
                  </div>
                )}
                {/* 그라디언트: 콘텐츠(좌/하) 쪽으로 종이 전이 — 텍스트 위 아님(가독) */}
                <div
                  aria-hidden
                  className="absolute inset-0 hidden sm:block"
                  style={{ background: 'linear-gradient(90deg, var(--bg) 4%, transparent 46%)' }}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 sm:hidden"
                  style={{ background: 'linear-gradient(180deg, transparent 40%, var(--bg) 96%)' }}
                />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function Meta({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[11px] tabular-nums text-[var(--t3)]">
      {children}
    </span>
  )
}
