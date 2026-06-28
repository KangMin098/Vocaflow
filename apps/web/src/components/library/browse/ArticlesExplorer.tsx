// apps/web/src/components/library/browse/ArticlesExplorer.tsx
//
// 스크립트(아티클) 탐색 — /library/books 스크립트 탭.
// 검색 + CEFR + 카테고리 + 정렬 → 반응형 카드 그리드.
// 도서(BooksExplorer)의 코버플로우/추천 대신, 짧은 글에 맞는 가벼운 그리드.

'use client'

import { useMemo, useState } from 'react'
import { Search, Sparkles, X } from 'lucide-react'

import type { PublishedArticle } from '@/lib/articles/types'
import { useUserVLevel } from '@/hooks/useUserVLevel'
import { judgeArticleIPlusOne } from '@/lib/library/i-plus-one'

import { ArticleCard } from './ArticleCard'

type Sort = 'recommended' | 'new' | 'short' | 'long'

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: 'recommended', label: '추천순' },
  { value: 'new', label: '최신순' },
  { value: 'short', label: '짧은순' },
  { value: 'long', label: '긴순' },
]

// P5 — i+1 적합 우선 진열 (낮을수록 우선): i+1(gap=+1) → 동급(0) → 약한 도전(+2)
//   → 쉬움(음수) → 어려움(≥+3) → V레벨 미상(99). 동순위는 짧은 글 우선(호출부).
function fitRank(article: PublishedArticle, userVLevel: number): number {
  const fit = judgeArticleIPlusOne(article.article_v_level, userVLevel)
  if (!fit) return 99
  const g = fit.gap
  if (g === 1) return 0
  if (g === 0) return 1
  if (g === 2) return 2
  if (g < 0) return 3 + Math.min(2, -g - 1) // −1→3, −2→4, −3↓→5
  return 6 + (g - 3) // +3→6, +4→7 …
}

export function ArticlesExplorer({
  articles,
  sourceFilter = null,
  onClearSourceFilter,
}: {
  articles: PublishedArticle[]
  /** 소스 맵 트랙 선택 → 그 트랙 소스만 노출 (목업 약점 5 — 맵↔목록 연동). */
  sourceFilter?: { label: string; sources: string[] } | null
  onClearSourceFilter?: () => void
}) {
  const [search, setSearch] = useState('')
  const [cefr, setCefr] = useState<string>('all')
  const [category, setCategory] = useState<string>('all')
  const [sort, setSort] = useState<Sort>('recommended')
  const userVLevel = useUserVLevel() // P4/P5 — i+1 배지 + 추천 진열 baseline (미진단 0 → V5 fallback)

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
      if (sourceFilter && !sourceFilter.sources.includes(a.source)) return false
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
      case 'new':
        arr.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
        break
      default:
        // P5 추천순 — i+1 적합 우선, 동순위는 짧은 글 우선
        arr.sort((a, b) => {
          const r = fitRank(a, userVLevel) - fitRank(b, userVLevel)
          if (r !== 0) return r
          return (a.word_count ?? Infinity) - (b.word_count ?? Infinity)
        })
    }
    return arr
  }, [articles, search, cefr, category, sort, userVLevel, sourceFilter])

  // P5 — Progressive Disclosure: 기본 화면에 "맞춤 다음 글" 1개 (i+1~약한 도전 범위만)
  const isDefaultView = !search.trim() && cefr === 'all' && category === 'all' && !sourceFilter
  const topPick = useMemo(() => {
    if (!isDefaultView) return null
    const best = [...articles]
      .filter((a) => a.article_v_level != null)
      .sort((a, b) => {
        const r = fitRank(a, userVLevel) - fitRank(b, userVLevel)
        if (r !== 0) return r
        return (a.word_count ?? Infinity) - (b.word_count ?? Infinity)
      })[0]
    return best && fitRank(best, userVLevel) <= 2 ? best : null
  }, [articles, isDefaultView, userVLevel])

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
    onClearSourceFilter?.()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* P5 — 맞춤 다음 글 (Progressive Disclosure: 기본 1개) */}
      {topPick && (
        <section aria-label="맞춤 다음 글" className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 px-1 font-display text-[12px] font-[700] text-[var(--p)]">
            <Sparkles size={13} aria-hidden /> 맞춤 다음 글
          </div>
          <div className="sm:max-w-[320px]">
            <ArticleCard article={topPick} userVLevel={userVLevel} />
          </div>
        </section>
      )}

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

      {/* 소스 맵 트랙 필터 칩 (활성 시) */}
      {sourceFilter && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--p)] bg-[var(--p-light)] px-2.5 py-1 font-display text-[11.5px] font-[700] text-[var(--p)]">
            {sourceFilter.label} 트랙
            <button
              type="button"
              onClick={onClearSourceFilter}
              aria-label="트랙 필터 해제"
              className="inline-flex h-4 w-4 items-center justify-center rounded-[var(--r-full)] transition-colors hover:bg-[var(--p)] hover:text-[var(--ti)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              <X size={11} aria-hidden />
            </button>
          </span>
          <span className="font-body text-[11px] text-[var(--t3)]">이 트랙의 글만 보고 있어요</span>
        </div>
      )}

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
