// apps/web/src/components/library/browse/ComicsBrowser.tsx
//
// /comics 탐색 오케스트레이터 — 만화(도서의 포맷) 카탈로그.
//   ① 이어서 보기 레인 (comic_read_progress 진행분)
//   ② 전체 그리드 + 레벨 밴드 필터 (facet-adaptive — 실재 밴드만 칩 노출)
// 설계: docs/CCP_LIBRARY_INTEGRATION.md §8.1. BooksExplorer 의 구조(레인 → 필터 → 그리드)를
// 그대로 따라 시각 신규성을 줄인다(만화는 '새 세계'가 아니라 같은 책의 다른 입구).

'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookImage, PlayCircle } from 'lucide-react'

import { V_BANDS, vBandOf, type VBand } from '@/lib/library/genres'
import { readEnumParam, useShelfUrlState } from '@/lib/library/shelf-url-state'
import { ShelfEmptyState } from '@/components/library/shared/ShelfEmptyState'

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

export function ComicsBrowser({
  items,
  loadError = false,
}: {
  items: ComicBrowseItem[]
  /** 카탈로그 **조회 자체가 실패**했는가 — 빈 목록의 두 원인을 가른다(lib/comic/catalog.ts). */
  loadError?: boolean
}) {
  // 고른 레벨 밴드는 주소가 기억한다 — 만화 하나를 열었다 뒤로 와도 조건이 남는다.
  //   왜 `router.replace` 가 아닌지는 `lib/library/shelf-url-state.ts` 머리 주석.
  const { searchParams, setParams } = useShelfUrlState()
  const [band, setBandState] = useState<VBand | null>(() =>
    readEnumParam<VBand>(
      searchParams,
      'band',
      V_BANDS.map((b) => b.key),
    ),
  )
  const setBand = useCallback(
    (v: VBand | null) => {
      setBandState(v)
      setParams({ band: v })
    },
    [setParams],
  )

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
    // 「아직 없다」와 「못 읽었다」를 가른다 — 뒤쪽은 재고가 그대로일 수 있다.
    return loadError ? (
      <ShelfEmptyState
        tone="error"
        title="지금 만화 목록을 불러오지 못했어요"
        body="서가가 빈 게 아니라 목록을 읽는 데 실패했어요. 새로고침하면 대개 돌아오고, 그동안 원문으로 읽는 길은 열려 있어요."
        ctaHref="/library/books"
        ctaLabel="도서 보러 가기"
      />
    ) : (
      <ShelfEmptyState
        title="아직 준비된 만화가 없어요"
        body="도서를 만화로 옮기는 작업이 진행 중이에요. 그동안 원문으로 읽어 두면, 나중에 같은 책의 만화가 나왔을 때 그림이 줄거리를 다시 잡아 줘요."
        ctaHref="/library/books"
        ctaLabel="도서 보러 가기"
      />
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
          <span className="font-mono text-[11.5px] text-[var(--t2)]">
            <strong className="font-display font-[700] text-[var(--t1)]">{visible.length}</strong>
            {visible.length !== items.length && ` / ${items.length}`} 편
          </span>
        </div>

        {bands.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            <span className="mr-1 font-display text-[11px] font-[700] text-[var(--t2)]">레벨</span>
            {bands.map((b) => {
              const active = band === b.key
              return (
                <button
                  key={b.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBand(active ? null : b.key)}
                  className={`inline-flex min-h-11 items-center gap-1 rounded-[var(--r-full)] border px-3 py-1 font-display text-[11.5px] font-[600] transition-colors duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]/40 ${
                    active
                      ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--on-p-tint)]'
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
          <ShelfEmptyState
            tone="filtered"
            title="이 레벨의 만화가 아직 없어요"
            body="고른 레벨에 맞는 편이 아직 없어요. 레벨을 풀면 전체가 다시 보이고, 조금 쉬운 편부터 그림으로 읽어도 좋아요."
            onAction={() => setBand(null)}
            actionLabel="필터 초기화"
          />
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
      // 카드 목적지는 등록 상태에 따라 바뀐다(미등록=상세 · 등록=리더 직행).
      // 그래서 href 로 도서를 식별하면 회귀 테스트가 상태에 따라 조용히 공회전한다(2026-08-09 실측).
      data-book-id={item.bookId}
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
          <div className="absolute inset-0 grid place-items-center text-[var(--t2)]">
            <BookImage size={28} aria-hidden />
          </div>
        )}
        {item.completed && (
          <span className="absolute left-2 top-2 inline-flex items-center rounded-[var(--r-full)] px-2 py-1 font-display text-[10px] font-[700] text-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]" style={{ background: 'var(--memory-stable)' }}>
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
          style={{ color: 'var(--active-ink)' }}
        >
          만화 · Comic
        </span>
        <h3 className="line-clamp-2 font-display text-[17px] font-[800] leading-[1.12] tracking-[-0.01em] text-[var(--t1)]">
          {item.title}
        </h3>
        {item.author && (
          <p className="line-clamp-1 font-body text-[12px] text-[var(--t2)]">{item.author}</p>
        )}

        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <Meta>{item.panelsTotal}컷</Meta>
          {item.vLevel != null && <Meta>V{item.vLevel}</Meta>}
          {item.progressPct > 0 && !item.completed && <Meta>{item.progressPct}% 봄</Meta>}
        </div>

        <span
          className="mt-auto inline-flex min-h-11 w-fit items-center gap-2 rounded-[var(--r-full)] px-4 py-2 font-display text-[13px] font-[700] shadow-[var(--sh-sm)]"
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
    <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-1 font-mono text-[11px] tabular-nums text-[var(--t2)]">
      {children}
    </span>
  )
}
