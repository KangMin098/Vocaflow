// apps/web/src/components/library/browse/ScriptsBrowser.tsx
//
// 스크립트(아티클) 탐색 — /library/scripts.
// 재설계(v06.221): "학습 지도" 오리엔테이션 우선.
//   기본 뷰 = 개인화 배너(레벨 밴드) → 난이도 지도 → 내 레벨 추천 strip → 시리즈 오리엔테이션 카드.
//     · 다양한 레벨의 학습자가 "어떤 소스/시리즈를 왜/어떻게 고를지" 를 한 화면에서 결정.
//     · 수치·위치·적합·추천은 buildScriptsMap(실집계) — 하드코딩 없음.
//   드릴다운 뷰 = 검색/레벨/시리즈 선택 시 평면 그리드(정렬) — 기존 로직 재사용.
// ArticleCard + i+1 로직 재사용. 추가 fetch 0 (page 가 이미 articles fetch).

'use client'

import { useMemo, useState } from 'react'
import { Search, Sparkles, X } from 'lucide-react'

import { useUserVLevel } from '@/hooks/useUserVLevel'
import { judgeArticleIPlusOne } from '@/lib/library/i-plus-one'
import {
  SOURCE_TRACKS,
  articleFitRank,
  buildScriptsMap,
  byRecommendedArticle,
  type TrackKey,
} from '@/lib/articles/source-map'
import type { PublishedArticle } from '@/lib/articles/types'

import { ArticleCard } from './ArticleCard'
import { DifficultyMap } from './DifficultyMap'
import { ScriptsGuideBanner } from './ScriptsGuideBanner'
import { TrackOrientationCard } from './TrackOrientationCard'

type Sort = 'recommended' | 'new' | 'short' | 'long'

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: 'recommended', label: '추천순' },
  { value: 'new', label: '최신순' },
  { value: 'short', label: '짧은순' },
  { value: 'long', label: '긴순' },
]

// 소스 → 트랙 매핑 (source-map SOURCE_TRACKS 파생, 별도 SSoT 없음)
const SOURCE_TO_TRACK = new Map<string, TrackKey>(
  SOURCE_TRACKS.flatMap((t) => t.sources.map((s) => [s, t.key] as [string, TrackKey])),
)

export function ScriptsBrowser({ articles }: { articles: PublishedArticle[] }) {
  const userV = useUserVLevel()
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<string>('all') // 'all' | 'mine' | 'A2' | 'B1' …
  const [sort, setSort] = useState<Sort>('recommended')
  const [trackFilter, setTrackFilter] = useState<TrackKey | null>(null)

  const scriptsMap = useMemo(() => buildScriptsMap(articles, userV), [articles, userV])

  const availableCefrs = useMemo(
    () => CEFR_ORDER.filter((c) => articles.some((a) => a.cefr_level === c)),
    [articles],
  )

  const searchQ = search.trim().toLowerCase()
  const isGrouped = !searchQ && level === 'all' && !trackFilter

  const matchesSearch = (a: PublishedArticle) =>
    !searchQ || `${a.title} ${a.author ?? ''}`.toLowerCase().includes(searchQ)

  const matchesLevel = (a: PublishedArticle) => {
    if (level === 'all') return true
    if (level === 'mine') {
      const fit = judgeArticleIPlusOne(a.article_v_level, userV)
      return !!fit && fit.gap >= 0 && fit.gap <= 1 // 동급 ~ i+1 = "내 레벨"
    }
    return a.cefr_level === level
  }

  // 평면 뷰 (필터/시리즈 활성 시)
  const flat = useMemo(() => {
    let arr = articles.filter((a) => matchesSearch(a) && matchesLevel(a))
    if (trackFilter) arr = arr.filter((a) => SOURCE_TO_TRACK.get(a.source) === trackFilter)
    arr = [...arr]
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
        arr.sort(byRecommendedArticle(userV))
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, searchQ, level, sort, trackFilter, userV])

  // 내 레벨 추천 strip (기본 뷰) — i+1~약한 도전만 상위 3
  const recommended = useMemo(() => {
    if (!isGrouped) return []
    return [...articles]
      .filter((a) => a.article_v_level != null)
      .sort(byRecommendedArticle(userV))
      .filter((a) => articleFitRank(a, userV) <= 2)
      .slice(0, 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, isGrouped, userV])

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
          짧은 영어 글이 큐레이션되면 여기에 표시돼요. 곧 추가될 예정이에요.
        </p>
      </div>
    )
  }

  const reset = () => {
    setSearch('')
    setLevel('all')
    setSort('recommended')
    setTrackFilter(null)
  }

  const activeTrack = trackFilter ? SOURCE_TRACKS.find((t) => t.key === trackFilter) ?? null : null

  // 레벨 칩 정의
  const levelChips: Array<{ value: string; label: string }> = [
    { value: 'all', label: '전체' },
    { value: 'mine', label: '내 레벨' },
    ...availableCefrs.map((c) => ({ value: c, label: c })),
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* ── 그룹 뷰 (기본) — 오리엔테이션 우선 ── */}
      {isGrouped ? (
        <>
          <ScriptsGuideBanner map={scriptsMap} onSelectTrack={setTrackFilter} />
          <DifficultyMap map={scriptsMap} onSelectTrack={setTrackFilter} />

          {/* 검색 + 레벨 칩 (유틸리티) */}
          <Controls
            search={search}
            setSearch={setSearch}
            levelChips={levelChips}
            level={level}
            setLevel={setLevel}
          />

          {/* 내 레벨 추천 strip — 바로 시작할 글 */}
          {recommended.length > 0 && (
            <section aria-label="내 레벨 추천" className="flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 px-1 font-display text-[13px] font-[800] text-[var(--p)]">
                <Sparkles size={14} aria-hidden /> 바로 시작할 글
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recommended.map((a) => (
                  <ArticleCard key={a.id} article={a} userVLevel={userV} />
                ))}
              </div>
            </section>
          )}

          {/* 시리즈(트랙) 오리엔테이션 카드 */}
          <section aria-label="시리즈 둘러보기" className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5 px-1 font-display text-[13px] font-[800] text-[var(--t1)]">
              시리즈 둘러보기
              <span className="font-mono text-[11px] font-[600] text-[var(--t3)]">
                {scriptsMap.tracks.length}개 · 적합순
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {scriptsMap.tracks.map((stat) => (
                <TrackOrientationCard
                  key={stat.track.key}
                  stat={stat}
                  recommended={stat.track.key === scriptsMap.recommendedTrackKey}
                  onOpen={setTrackFilter}
                />
              ))}
            </div>
          </section>
        </>
      ) : (
        /* ── 평면 뷰 (필터/시리즈 활성) ── */
        <div className="flex flex-col gap-4">
          {/* 시리즈 컨텍스트 배너 — 드릴다운 중에도 정체성 유지 */}
          {activeTrack && (
            <div
              className="flex items-start gap-2.5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-3"
            >
              <span
                aria-hidden
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[16px]"
                style={{ backgroundColor: `color-mix(in srgb, ${activeTrack.accent} 14%, transparent)` }}
              >
                {activeTrack.icon}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h2 className="font-display text-[14px] font-[800] text-[var(--t1)]">{activeTrack.title}</h2>
                <p className="font-body text-[11.5px] leading-[1.4] text-[var(--t3)]">{activeTrack.oneLine}</p>
              </div>
            </div>
          )}

          {/* 컨트롤 */}
          <Controls
            search={search}
            setSearch={setSearch}
            levelChips={levelChips}
            level={level}
            setLevel={setLevel}
            sort={sort}
            setSort={setSort}
          />

          <div className="flex flex-wrap items-center gap-2">
            {activeTrack && (
              <span
                className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] border px-2.5 py-1 font-display text-[11.5px] font-[700]"
                style={{ color: activeTrack.accent, borderColor: activeTrack.accent }}
              >
                {activeTrack.icon} {activeTrack.title}
                <button
                  type="button"
                  onClick={() => setTrackFilter(null)}
                  aria-label="시리즈 필터 해제"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--r-full)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:bg-[var(--bg3)]"
                >
                  <X size={13} aria-hidden />
                </button>
              </span>
            )}
            <span className="font-mono text-[11px] text-[var(--t3)]">
              {flat.length === articles.length ? `${articles.length}편` : `${flat.length} / ${articles.length}편`}
            </span>
            <button
              type="button"
              onClick={reset}
              className="ml-auto inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2.5 py-1.5 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              <X size={12} aria-hidden /> 학습 지도로 돌아가기
            </button>
          </div>

          {flat.length === 0 ? (
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
                className="mt-1 inline-flex min-h-[40px] items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] active:bg-[var(--bg3)]"
              >
                <X size={12} aria-hidden /> 필터 초기화
              </button>
            </div>
          ) : (
            <div role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {flat.map((a) => (
                <div role="listitem" key={a.id}>
                  <ArticleCard article={a} userVLevel={userV} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 컨트롤 (검색 + 레벨 칩 + 정렬) ─────────────────────────────────────
function Controls({
  search,
  setSearch,
  levelChips,
  level,
  setLevel,
  sort,
  setSort,
}: {
  search: string
  setSearch: (v: string) => void
  levelChips: Array<{ value: string; label: string }>
  level: string
  setLevel: (v: string) => void
  sort?: Sort
  setSort?: (v: Sort) => void
}) {
  return (
    <div className="flex flex-col gap-3">
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
            className="h-9 w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] pl-8 pr-3 font-body text-[13px] text-[var(--t1)] placeholder:text-[var(--t3)] transition-colors focus-visible:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          />
        </div>
        {sort && setSort && (
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="정렬"
            className="h-9 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 레벨 칩 — 가시 facet ("읽을 수 있나?" 즉답) */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="레벨 필터">
        {levelChips.map((chip) => {
          const on = level === chip.value
          const mine = chip.value === 'mine'
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => setLevel(on && chip.value !== 'all' ? 'all' : chip.value)}
              aria-pressed={on}
              className={[
                'inline-flex items-center gap-1 rounded-[var(--r-full)] border px-3 py-1 font-display text-[12px] font-[700]',
                'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
                on
                  ? 'border-[var(--p)] bg-[var(--p)] text-[var(--ti)]'
                  : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--t1)]',
              ].join(' ')}
            >
              {mine && <Sparkles size={11} aria-hidden />}
              {chip.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
