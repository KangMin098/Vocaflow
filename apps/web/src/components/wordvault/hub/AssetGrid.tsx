// apps/web/src/components/wordvault/hub/AssetGrid.tsx
//
// WordVault Zone 3 (v06.35) — 내 자산 (검색 + 단어장 grid).
//
// useHubStats 의 books[] 그대로 활용. 이모지/장식 제거.
// 카드는 1px border + 큰 숫자 + 4색 mini bar.
// 검색 input 인라인 (기존 FindAndMore 폐기).

'use client'

import { ArrowRight, Search, X } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { VaultBook } from './BookShelfSection'

const NF = new Intl.NumberFormat('en-US')

interface AssetGridProps {
  books: VaultBook[]
}

export function AssetGrid({ books }: AssetGridProps) {
  const [q, setQ] = useState('')

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return books
    return books.filter((b) =>
      b.title.toLowerCase().includes(query) ||
      (b.subtitle ?? '').toLowerCase().includes(query),
    )
  }, [books, q])

  return (
    <section
      aria-label="내 단어장"
      className="rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 md:p-7"
    >
      {/* Header — title + count + search */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
            내 단어장
          </span>
          <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
            {NF.format(books.length)}
            <span className="ml-1 text-[var(--t3)]">개</span>
          </span>
        </div>

        <div className="relative w-full sm:w-[280px]">
          <Search
            size={13}
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)]"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="단어장 검색"
            aria-label="단어장 검색"
            className="h-9 w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] pl-8 pr-8 font-body text-[13px] text-[var(--t1)] placeholder:text-[var(--t3)] transition-colors duration-[var(--dur-normal)] focus:border-[var(--p)] focus:outline-none focus:ring-2 focus:ring-[var(--p)]/15"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="검색 지우기"
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </header>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="py-10 text-center font-body text-[13px] text-[var(--t3)]">
          {q ? `"${q}" 와 일치하는 단어장이 없어요.` : '아직 단어장이 없어요.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((book) => (
            <AssetCard key={book.id} book={book} />
          ))}
        </div>
      )}

      {/* Footer link */}
      <div className="mt-5 flex justify-end border-t border-[var(--bd)] pt-4">
        <Link
          href="/wordvault/browse"
          className="group inline-flex items-center gap-1.5 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-fast)] hover:text-[var(--p)]"
        >
          <span>전체 단어 둘러보기</span>
          <ArrowRight
            size={12}
            aria-hidden
            className="transition-transform duration-[var(--dur-fast)] group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </section>
  )
}

function AssetCard({ book }: { book: VaultBook }) {
  const d = book.distribution
  const total = d.stable + d.shaky + d.risk + d.new
  const sStable = total > 0 ? (d.stable / total) * 100 : 0
  const sShaky = total > 0 ? (d.shaky / total) * 100 : 0
  const sRisk = total > 0 ? (d.risk / total) * 100 : 0
  const sNew = total > 0 ? (d.new / total) * 100 : 0

  // 책 제목 — 공용 단어장은 prefix 이모지 strip (Editorial 톤)
  const cleanTitle = book.title.replace(/^[\p{Extended_Pictographic}\s]+/u, '').trim() || book.title

  return (
    <Link
      href={book.href}
      className="group flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:bg-[var(--bg2)]"
    >
      {/* Top row — type + title */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">
          <span>{book.type === 'text' ? '스크립트' : '단어장'}</span>
          {book.subtitle && (
            <span className="truncate text-[var(--t4)]">{book.subtitle}</span>
          )}
        </div>
        <h3 className="line-clamp-2 font-english text-[14px] font-[600] leading-snug text-[var(--t1)] group-hover:text-[var(--p)]">
          {cleanTitle}
        </h3>
      </div>

      {/* Big number — 단어수 */}
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-[28px] font-[800] leading-none tracking-[-0.02em] tabular-nums text-[var(--t1)]">
          {NF.format(total)}
        </span>
        <span className="font-body text-[11px] text-[var(--t3)]">단어</span>
      </div>

      {/* Mini bar */}
      <div className="flex h-[4px] w-full overflow-hidden rounded-full bg-[var(--bg3)]">
        {sStable > 0 && <div style={{ width: `${sStable}%`, backgroundColor: '#22C55E' }} />}
        {sShaky > 0 && <div style={{ width: `${sShaky}%`, backgroundColor: '#F59E0B' }} />}
        {sRisk > 0 && <div style={{ width: `${sRisk}%`, backgroundColor: '#EF4444' }} />}
        {sNew > 0 && <div style={{ width: `${sNew}%`, backgroundColor: '#94A3B8' }} />}
      </div>

      {/* Inline counts */}
      <div className="flex items-center gap-3 font-mono text-[10px] tabular-nums text-[var(--t3)]">
        {d.stable > 0 && (
          <span>
            <span style={{ color: '#22C55E' }}>●</span> {d.stable}
          </span>
        )}
        {d.shaky > 0 && (
          <span>
            <span style={{ color: '#F59E0B' }}>●</span> {d.shaky}
          </span>
        )}
        {d.risk > 0 && (
          <span>
            <span style={{ color: '#EF4444' }}>●</span> {d.risk}
          </span>
        )}
        {d.new > 0 && (
          <span>
            <span style={{ color: '#94A3B8' }}>●</span> {d.new}
          </span>
        )}
      </div>
    </Link>
  )
}
