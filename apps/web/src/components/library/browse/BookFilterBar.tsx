// apps/web/src/components/library/browse/BookFilterBar.tsx
//
// 도서 탐색 필터/정렬 바.
//   기본: 검색 · 정렬 · 나에게(i+1, 진단 시) · 레벨(V) · 장르 · 길이 · 오디오
//   상세 필터 disclosure: 주제(테마) · 연령
// 레벨 단위 = V-Level (CEFR 는 카드 배지 보조). 상태는 BooksExplorer 소유, facets 로 실재 값만 노출.

'use client'

import { useState } from 'react'
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'

import {
  AGE_BANDS,
  GENRE_BUCKETS,
  LENGTH_BUCKETS,
  V_BANDS,
  vBandOf,
  type AgeBand,
  type GenreBucket,
  type LengthBucket,
  type VBand,
} from '@/lib/library/genres'
import type { IPlusOneTier } from '@/lib/library/i-plus-one'

export interface BookFilters {
  search: string
  /** i+1 적합도 (진단 사용자만 유효) */
  fit: IPlusOneTier | null
  vBand: VBand | null
  genre: GenreBucket | null
  theme: string | null
  age: AgeBand | null
  length: LengthBucket | null
  audioOnly: boolean
}

export type BookSort = 'recommended' | 'easy' | 'hard' | 'short' | 'popular' | 'new'

export const EMPTY_FILTERS: BookFilters = {
  search: '',
  fit: null,
  vBand: null,
  genre: null,
  theme: null,
  age: null,
  length: null,
  audioOnly: false,
}

const FIT_OPTIONS: { key: IPlusOneTier; label: string }[] = [
  { key: 'ideal', label: '딱 맞아요' },
  { key: 'challenge', label: '도전적' },
  { key: 'easy', label: '쉬워요' },
]

const SORT_OPTIONS: { key: BookSort; label: string }[] = [
  { key: 'recommended', label: '추천순' },
  { key: 'easy', label: '쉬운 순' },
  { key: 'hard', label: '어려운 순' },
  { key: 'short', label: '짧은 순' },
  { key: 'popular', label: '인기순' },
  { key: 'new', label: '신규순' },
]

const THEME_PREVIEW = 8

export interface FacetData {
  vBands: VBand[]
  genres: GenreBucket[]
  themes: string[]
  ages: AgeBand[]
  hasAudio: boolean
}

interface Props {
  filters: BookFilters
  onChange: (patch: Partial<BookFilters>) => void
  sort: BookSort
  onSortChange: (s: BookSort) => void
  resultCount: number
  totalCount: number
  facets: FacetData
  diagnosed: boolean
  /** 진단 V레벨 — 레벨 밴드에 "내 레벨" 표시 */
  userVLevel: number
  onReset: () => void
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-[var(--r-full)] border px-2.5 py-1 font-display text-[11.5px] font-[600] transition-colors ${
        active
          ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--p-dark)]'
          : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--t3)] hover:bg-[var(--bg2)]'
      }`}
    >
      {children}
    </button>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
        {label}
      </span>
      {children}
    </div>
  )
}

export function BookFilterBar({
  filters,
  onChange,
  sort,
  onSortChange,
  resultCount,
  totalCount,
  facets,
  diagnosed,
  userVLevel,
  onReset,
}: Props) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [allThemes, setAllThemes] = useState(false)

  const hasActive =
    filters.search.trim() !== '' ||
    filters.fit !== null ||
    filters.vBand !== null ||
    filters.genre !== null ||
    filters.theme !== null ||
    filters.age !== null ||
    filters.length !== null ||
    filters.audioOnly

  const myBand = diagnosed ? vBandOf(userVLevel) : null

  // 주제 — 빈도순 facets.themes. 미리보기 N + 활성 주제는 항상 포함.
  const shownThemes = (() => {
    if (allThemes) return facets.themes
    const head = facets.themes.slice(0, THEME_PREVIEW)
    if (filters.theme && !head.includes(filters.theme)) return [filters.theme, ...head]
    return head
  })()
  const hasDetail = facets.themes.length > 0 || facets.ages.length > 0

  return (
    <div className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)]/60 p-3.5">
      {/* Row 1 — 검색 + 정렬 + 결과수 */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[180px] flex-1">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)]"
          />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="제목·저자 검색"
            aria-label="도서 검색"
            className="w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] py-2 pl-9 pr-3 font-body text-[13px] text-[var(--t1)] placeholder:text-[var(--t3)] focus:border-[var(--bdf)] focus:outline-none focus:ring-2 focus:ring-[var(--p)]/20"
          />
        </div>

        <div className="inline-flex items-center gap-1.5">
          <SlidersHorizontal size={13} aria-hidden className="text-[var(--t3)]" />
          <label htmlFor="book-sort" className="sr-only">
            정렬
          </label>
          <select
            id="book-sort"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as BookSort)}
            className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] py-2 pl-2.5 pr-7 font-display text-[12px] font-[600] text-[var(--t1)] focus:border-[var(--bdf)] focus:outline-none focus:ring-2 focus:ring-[var(--p)]/20"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <span className="ml-auto whitespace-nowrap font-mono text-[11.5px] text-[var(--t3)]">
          <strong className="font-display font-[700] text-[var(--t1)]">{resultCount}</strong>
          {resultCount !== totalCount && ` / ${totalCount}`} 권
        </span>
      </div>

      {/* Row 2 — 기본 필터 그룹 */}
      <div className="flex flex-col gap-2.5">
        {diagnosed && (
          <Group label="나에게">
            {FIT_OPTIONS.map((o) => (
              <Chip
                key={o.key}
                active={filters.fit === o.key}
                onClick={() => onChange({ fit: filters.fit === o.key ? null : o.key })}
              >
                {o.label}
              </Chip>
            ))}
          </Group>
        )}

        {facets.vBands.length > 0 && (
          <Group label="레벨">
            {V_BANDS.filter((b) => facets.vBands.includes(b.key)).map((b) => (
              <Chip
                key={b.key}
                active={filters.vBand === b.key}
                onClick={() => onChange({ vBand: filters.vBand === b.key ? null : b.key })}
              >
                <span className="font-mono">{b.short}</span> {b.label}
                {myBand === b.key && (
                  <span className="ml-0.5 rounded-[var(--r-full)] bg-[var(--p)] px-1 py-px font-mono text-[8.5px] font-[700] text-white">
                    내 레벨
                  </span>
                )}
              </Chip>
            ))}
          </Group>
        )}

        {facets.genres.length > 0 && (
          <Group label="장르">
            {GENRE_BUCKETS.filter((g) => facets.genres.includes(g.key)).map((g) => (
              <Chip
                key={g.key}
                active={filters.genre === g.key}
                onClick={() => onChange({ genre: filters.genre === g.key ? null : g.key })}
              >
                <span aria-hidden>{g.emoji}</span> {g.label}
              </Chip>
            ))}
          </Group>
        )}

        <Group label="길이">
          {LENGTH_BUCKETS.map((l) => (
            <Chip
              key={l.key}
              active={filters.length === l.key}
              onClick={() => onChange({ length: filters.length === l.key ? null : l.key })}
            >
              {l.label}
            </Chip>
          ))}
          {facets.hasAudio && (
            <Chip
              active={filters.audioOnly}
              onClick={() => onChange({ audioOnly: !filters.audioOnly })}
            >
              🔊 원어민 음성
            </Chip>
          )}
          {hasDetail && (
            <button
              type="button"
              aria-expanded={detailOpen}
              onClick={() => setDetailOpen((v) => !v)}
              className="ml-1 inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-2.5 py-1 font-display text-[11.5px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)]"
            >
              상세 필터
              <ChevronDown
                size={12}
                aria-hidden
                className={`transition-transform ${detailOpen ? 'rotate-180' : ''}`}
              />
            </button>
          )}
          {hasActive && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-1 font-display text-[11px] font-[600] text-[var(--t3)] transition-colors hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
            >
              <X size={11} aria-hidden /> 초기화
            </button>
          )}
        </Group>

        {/* 상세 필터 — 주제 + 연령 */}
        {detailOpen && hasDetail && (
          <div className="flex flex-col gap-2.5 border-t border-[var(--bd)] pt-2.5">
            {facets.themes.length > 0 && (
              <Group label="주제">
                {shownThemes.map((t) => (
                  <Chip
                    key={t}
                    active={filters.theme === t}
                    onClick={() => onChange({ theme: filters.theme === t ? null : t })}
                  >
                    {t}
                  </Chip>
                ))}
                {facets.themes.length > THEME_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setAllThemes((v) => !v)}
                    className="inline-flex items-center rounded-[var(--r-full)] px-2 py-1 font-display text-[11px] font-[600] text-[var(--p)] transition-colors hover:bg-[var(--p-light)]"
                  >
                    {allThemes ? '접기' : `+${facets.themes.length - THEME_PREVIEW}개 더보기`}
                  </button>
                )}
              </Group>
            )}

            {facets.ages.length > 0 && (
              <Group label="연령">
                {AGE_BANDS.filter((a) => facets.ages.includes(a.key)).map((a) => (
                  <Chip
                    key={a.key}
                    active={filters.age === a.key}
                    onClick={() => onChange({ age: filters.age === a.key ? null : a.key })}
                  >
                    {a.label}
                  </Chip>
                ))}
              </Group>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
