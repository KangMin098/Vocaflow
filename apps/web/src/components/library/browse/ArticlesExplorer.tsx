// apps/web/src/components/library/browse/ArticlesExplorer.tsx
//
// 스크립트(아티클) 탐색 — /library/books 스크립트 탭.
// 검색 + CEFR + 카테고리 + 정렬 → 반응형 카드 그리드.
// 도서(BooksExplorer)의 코버플로우/추천 대신, 짧은 글에 맞는 가벼운 그리드.

'use client'

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'

import type { PublishedArticle } from '@/lib/articles/types'
import { useUserVLevel } from '@/hooks/useUserVLevel'

import { ArticleCard } from './ArticleCard'

type Sort = 'new' | 'short' | 'long'

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: 'new', label: '최신순' },
  { value: 'short', label: '짧은순' },
  { value: 'long', label: '긴순' },
]

export function ArticlesExplorer({ articles }: { articles: PublishedArticle[] }) {
  const [search, setSearch] = useState('')
  const [cefr, setCefr] = useState<string>('all')
  const [category, setCategory] = useState<string>('all')
  const [sort, setSort] = useState<Sort>('new')
  const userVLevel = useUserVLevel() // P4 — i+1 배지 baseline (미진단 0 → 카드에서 V5 fallback)

  // 실재하는 CEFR / 카테고리 facet
  const facets = useMemo(() => {
    const cefrSet = new Set<string>()
    const catFreq = new Map<string, number>()
    for (const a of articles) {
      if (a.cefr_level) cefrSet.add(a.cefr_level)
      for (const t of a.category_tags ?? []) catFreq.set(t, (catFreq.get(t) ?? 0) + 1)
    }
    const cefrs = CEFR_ORDER.filter((c) => cefrSet.has(c))
    const cats = Array.from(catFreq.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([t]) => t)
    return { cefrs, cats }
  }, [articles])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = articles.filter((a) => {
      if (q) {
        const hay = `${a.title} ${a.author ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (cefr !== 'all' && a.cefr_level !== cefr) return false
      if (category !== 'all' && !(a.category_tags ?? []).includes(category)) return false
      return true
    })
    const arr = [...filtered]
    switch (sort) {
      case 'short':
        arr.sort((a, b) => (a.word_count ?? Infinity) - (b.word_count ?? Infinity))
        break
      case 'long':
        arr.sort((a, b) => (b.word_count ?? -1) - (a.word_count ?? -1))
        break
      default:
        arr.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    }
    return arr
  }, [articles, search, cefr, category, sort])

  if (articles.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-16 text-center"
      >
        <span className="select-none text-3xl" aria-hidden>
          📰
        </span>
        <p className="font-display text-[14px] font-[700] text-[var(--t1)]">
          아직 게시된 스크립트가 없어요
        </p>
        <p className="max-w-[360px] font-body text-[12px] text-[var(--t3)]">
          짧은 영어 글(VOA · NASA · NIH 등)이 큐레이션되면 여기에 표시돼요. 곧 추가될 예정이에요.
        </p>
      </div>
    )
  }

  const reset = () => {
    setSearch('')
    setCefr('all')
    setCategory('all')
    setSort('new')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--t3)]"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목·저자 검색"
            aria-label="스크립트 검색"
            className="h-9 w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] pl-8 pr-3 font-body text-[13px] text-[var(--t1)] placeholder:text-[var(--t3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          />
        </div>

        {facets.cefrs.length > 0 && (
          <select
            value={cefr}
            onChange={(e) => setCefr(e.target.value)}
            aria-label="레벨 필터"
            className="h-9 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-display text-[12px] font-[600] text-[var(--t2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <option value="all">레벨 전체</option>
            {facets.cefrs.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        {facets.cats.length > 0 && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="카테고리 필터"
            className="h-9 max-w-[160px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-display text-[12px] font-[600] text-[var(--t2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <option value="all">카테고리 전체</option>
            {facets.cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="정렬"
          className="h-9 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-display text-[12px] font-[600] text-[var(--t2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <span className="ml-auto font-mono text-[11px] text-[var(--t3)]">
          {visible.length === articles.length
            ? `${articles.length}편`
            : `${visible.length} / ${articles.length}편`}
        </span>
      </div>

      {visible.length === 0 ? (
        <div
          role="status"
          className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center"
        >
          <span className="select-none text-2xl" aria-hidden>
            🔎
          </span>
          <p className="font-display text-[14px] font-[700] text-[var(--t1)]">
            조건에 맞는 스크립트가 없어요
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-1 inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
          >
            <X size={12} aria-hidden /> 필터 초기화
          </button>
        </div>
      ) : (
        <div
          role="list"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {visible.map((a) => (
            <div role="listitem" key={a.id}>
              <ArticleCard article={a} userVLevel={userVLevel} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
