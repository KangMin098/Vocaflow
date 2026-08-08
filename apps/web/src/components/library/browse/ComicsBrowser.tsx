// apps/web/src/components/library/browse/ComicsBrowser.tsx
//
// /library/comics 탐색 오케스트레이터 — 만화(도서의 포맷) 카탈로그.
//   ① 이어서 보기 레인 (comic_read_progress 진행분)
//   ② 전체 그리드 + 레벨 밴드 필터 (facet-adaptive — 실재 밴드만 칩 노출)
// 설계: docs/CCP_LIBRARY_INTEGRATION.md §8.1. BooksExplorer 의 구조(레인 → 필터 → 그리드)를
// 그대로 따라 시각 신규성을 줄인다(만화는 '새 세계'가 아니라 같은 책의 다른 입구).

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookImage, PlayCircle } from 'lucide-react'

import { V_BANDS, vBandOf, type VBand } from '@/lib/library/genres'

export interface ComicBrowseItem {
  bookId: string
  title: string
  author: string | null
  vLevel: number | null
  panelsTotal: number
  coverArt: string | null
  href: string
  ctaLabel: string
  enrolled: boolean
  /** comic_read_progress 기반 0~100 (미시작 0) */
  progressPct: number
  completed: boolean
}

const ON_GOLD = '#231a09' // gold(--active) 위 고대비 텍스트 (양 테마 AA)

export function ComicsBrowser({ items }: { items: ComicBrowseItem[] }) {
  const [band, setBand] = useState<VBand | null>(null)

  const continuing = useMemo(
    () => items.filter((i) => i.progressPct > 0 && !i.completed),
    [items],
  )

  const bands = useMemo(() => {
    const s = new Set<VBand>()
    for (const i of items) {
      const b = vBandOf(i.vLevel)
      if (b) s.add(b)
    }
    return V_BANDS.filter((b) => s.has(b.key))
  }, [items])

  const visible = useMemo(
    () => (band ? items.filter((i) => vBandOf(i.vLevel) === band) : items),
    [items, band],
  )

  if (items.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-6 py-16 text-center"
      >
        <BookImage size={26} className="text-[var(--t3)]" aria-hidden />
        <div>
          <p className="font-display text-[16px] font-[800] text-[var(--t1)]">
            아직 준비된 만화가 없어요
          </p>
          <p className="mt-1 font-body text-[13px] text-[var(--t2)]">
            도서를 만화로 옮기는 작업이 진행 중이에요. 그동안 원문으로 읽어보실래요?
          </p>
        </div>
        <Link
          href="/library/books"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--p)] px-4 py-2 font-display text-[13px] font-[700] text-white shadow-[var(--sh-sm)] transition-colors hover:bg-[var(--p-dark)]"
        >
          도서 보러 가기
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ① 이어서 보기 */}
      {continuing.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="이어서 보기">
          <div className="flex items-center gap-2 px-1">
            <PlayCircle size={16} aria-hidden className="text-[var(--p)]" />
            <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">이어서 보기</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {continuing.map((it) => (
              <ComicCard key={`c-${it.bookId}`} item={it} />
            ))}
          </div>
        </section>
      )}

      {/* ② 전체 */}
      <section className="flex flex-col gap-4" aria-label="전체 만화">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">전체 만화</h2>
          <span className="font-mono text-[11.5px] text-[var(--t3)]">
            <strong className="font-display font-[700] text-[var(--t1)]">{visible.length}</strong>
            {visible.length !== items.length && ` / ${items.length}`} 편
          </span>
        </div>

        {bands.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span className="mr-1 font-display text-[11px] font-[700] text-[var(--t2)]">레벨</span>
            {bands.map((b) => {
              const active = band === b.key
              return (
                <button
                  key={b.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBand(active ? null : b.key)}
                  className={`inline-flex min-h-[32px] items-center gap-1 rounded-[var(--r-full)] border px-2.5 py-1 font-display text-[11.5px] font-[600] transition-colors duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]/40 ${
                    active
                      ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--p-dark)]'
                      : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--t3)] hover:bg-[var(--bg2)]'
                  }`}
                >
                  <span className="font-mono">{b.short}</span> {b.label}
                </button>
              )
            })}
          </div>
        )}

        {visible.length === 0 ? (
          <div
            role="status"
            className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center"
          >
            <p className="font-display text-[14px] font-[700] text-[var(--t1)]">
              이 레벨의 만화가 아직 없어요
            </p>
            <button
              type="button"
              onClick={() => setBand(null)}
              className="mt-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
            >
              필터 초기화
            </button>
          </div>
        ) : (
          <div
            role="list"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {visible.map((it) => (
              <div role="listitem" key={it.bookId}>
                <ComicCard item={it} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ComicCard({ item }: { item: ComicBrowseItem }) {
  return (
    <Link
      href={item.href}
      aria-label={`${item.title} — ${item.ctaLabel}`}
      className="group flex h-full flex-col overflow-hidden rounded-[var(--r-ios-2xl,20px)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)] transition-[transform,box-shadow] duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--sh-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--active)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {/* 아트 */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--bg2)]">
        {item.coverArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverArt}
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
        {item.completed && (
          <span className="absolute left-2 top-2 inline-flex items-center rounded-[var(--r-full)] bg-[var(--success)] px-1.5 py-0.5 font-display text-[9px] font-[700] text-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
            다 봤어요
          </span>
        )}
        {item.progressPct > 0 && !item.completed && (
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-black/30">
            <div
              className="h-full"
              style={{ width: `${item.progressPct}%`, background: 'var(--active)' }}
            />
          </div>
        )}
      </div>

      {/* 콘텐츠 */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span
          className="font-display text-[10px] font-[800] uppercase tracking-[0.16em]"
          style={{ color: 'var(--active)' }}
        >
          만화 · Comic
        </span>
        <h3 className="line-clamp-2 font-display text-[17px] font-[800] leading-[1.12] tracking-[-0.01em] text-[var(--t1)]">
          {item.title}
        </h3>
        {item.author && (
          <p className="line-clamp-1 font-body text-[12px] text-[var(--t3)]">{item.author}</p>
        )}

        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <Meta>{item.panelsTotal}컷</Meta>
          {item.vLevel != null && <Meta>V{item.vLevel}</Meta>}
          {item.progressPct > 0 && !item.completed && <Meta>{item.progressPct}% 봄</Meta>}
        </div>

        <span
          className="mt-auto inline-flex min-h-11 w-fit items-center gap-1.5 rounded-[var(--r-full)] px-4 py-2 font-display text-[13px] font-[700] shadow-[var(--sh-sm)]"
          style={{ background: 'var(--active)', color: ON_GOLD }}
        >
          {item.ctaLabel}
          <ArrowRight
            size={14}
            aria-hidden
            className="transition-transform duration-[var(--dur-normal)] group-hover:translate-x-1 motion-reduce:transition-none"
          />
        </span>
      </div>
    </Link>
  )
}

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[11px] tabular-nums text-[var(--t3)]">
      {children}
    </span>
  )
}
