// apps/web/src/components/library/browse/BookFilterBar.tsx
//
// 도서 탐색 필터/정렬 바 — "항상 펼친 상세 패널" 재설계 (v06.35).
//   상단: 검색 · 정렬 · 결과수 · 초기화
//   구획(항상 노출, facet-adaptive): 내 학습 상태 · 나에게(i+1) · 레벨 · 장르 · 주제 · 연령 · 길이 · 포맷(만화/음성)
// 이전 "묶음 한 카드 + 상세 disclosure" 를 라벨 구획으로 분리해 각 조건을 또렷하게.
// 레벨 단위 = V-Level (CEFR 는 카드 배지 보조). 상태는 BooksExplorer 소유, facets 로 실재 값만 노출.

'use client'

import { useState } from 'react'
import { BookImage, Search, SlidersHorizontal, X } from 'lucide-react'

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

/** 내 학습 상태 필터 — 로그인 + enrollment 존재 시에만 노출 */
export type EnrollFilter = 'mine' | 'in_progress' | 'completed'

export interface BookFilters {
  search: string
  /** 내 학습 상태 (로그인 + 등록 도서 존재 시 유효) */
  enroll: EnrollFilter | null
  /** i+1 적합도 (진단 사용자만 유효) */
  fit: IPlusOneTier | null
  vBand: VBand | null
  genre: GenreBucket | null
  theme: string | null
  age: AgeBand | null
  length: LengthBucket | null
  audioOnly: boolean
  /** 포맷 — 만화(comic_books published)로도 볼 수 있는 도서만 */
  comicOnly: boolean
}

export type BookSort = 'recommended' | 'easy' | 'hard' | 'short' | 'popular' | 'new'

export const EMPTY_FILTERS: BookFilters = {
  search: '',
  enroll: null,
  fit: null,
  vBand: null,
  genre: null,
  theme: null,
  age: null,
  length: null,
  audioOnly: false,
  comicOnly: false,
}

const ENROLL_OPTIONS: { key: EnrollFilter; label: string }[] = [
  { key: 'mine', label: '내 서재' },
  { key: 'in_progress', label: '학습 중' },
  { key: 'completed', label: '완료' },
]

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

const THEME_PREVIEW = 10

export interface FacetData {
  vBands: VBand[]
  genres: GenreBucket[]
  themes: string[]
  ages: AgeBand[]
  lengths: LengthBucket[]
  hasAudio: boolean
  /** 발행된 만화를 가진 도서가 하나라도 있는지 */
  hasComic: boolean
  /** 로그인 사용자가 등록(내 서재)한 도서가 하나라도 있는지 */
  hasEnrollments: boolean
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
      className={`inline-flex min-h-11 items-center gap-1 rounded-[var(--r-full)] border px-3 py-1 font-display text-[11.5px] font-[600] transition-colors ${
        active
          ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--on-p-tint)]'
          : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--t3)] hover:bg-[var(--bg2)]'
      }`}
    >
      {children}
    </button>
  )
}

/** 라벨 구획 — 좌측 고정폭 라벨 + 칩 묶음. 각 조건을 또렷한 compartment 로 분리. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-3">
      <span className="shrink-0 pt-1 font-display text-[11px] font-[700] text-[var(--t2)] sm:w-[56px]">
        {label}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
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
  const [allThemes, setAllThemes] = useState(false)

  const hasActive =
    filters.search.trim() !== '' ||
    filters.enroll !== null ||
    filters.fit !== null ||
    filters.vBand !== null ||
    filters.genre !== null ||
    filters.theme !== null ||
    filters.age !== null ||
    filters.length !== null ||
    filters.audioOnly ||
    filters.comicOnly

  const myBand = diagnosed ? vBandOf(userVLevel) : null

  // 주제 — 빈도순 facets.themes. 미리보기 N + 활성 주제는 항상 포함.
  const shownThemes = (() => {
    if (allThemes) return facets.themes
    const head = facets.themes.slice(0, THEME_PREVIEW)
    if (filters.theme && !head.includes(filters.theme)) return [filters.theme, ...head]
    return head
  })()

  return (
    <div className="flex flex-col divide-y divide-[var(--bd)] rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)]/60">
      {/* 상단 — 검색 + 정렬 + 초기화 + 결과수 */}
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[180px] flex-1">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t2)]"
          />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="제목·저자 검색"
            aria-label="도서 검색"
            className="min-h-11 w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] py-2 pl-9 pr-3 font-body text-[13px] text-[var(--t1)] placeholder:text-[var(--t2)] focus:border-[var(--bdf)] focus:outline-none focus:ring-2 focus:ring-[var(--p)]/20"
          />
        </div>

        <div className="inline-flex items-center gap-2">
          <SlidersHorizontal size={13} aria-hidden className="text-[var(--t2)]" />
          <label htmlFor="book-sort" className="sr-only">
            정렬
          </label>
          <select
            id="book-sort"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as BookSort)}
            className="min-h-11 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] py-2 pl-3 pr-7 font-display text-[12px] font-[600] text-[var(--t1)] focus:border-[var(--bdf)] focus:outline-none focus:ring-2 focus:ring-[var(--p)]/20"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {hasActive && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-11 items-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[11px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
          >
            <X size={11} aria-hidden /> 초기화
          </button>
        )}

        <span className="whitespace-nowrap font-mono text-[11.5px] text-[var(--t2)]">
          <strong className="font-display font-[700] text-[var(--t1)]">{resultCount}</strong>
          {resultCount !== totalCount && ` / ${totalCount}`} 권
        </span>
      </div>

      {/* 내 학습 상태 — 로그인 + 등록 도서 존재 시 (최상단 구획) */}
      {facets.hasEnrollments && (
        <Section label="내 학습">
          {ENROLL_OPTIONS.map((o) => (
            <Chip
              key={o.key}
              active={filters.enroll === o.key}
              onClick={() => onChange({ enroll: filters.enroll === o.key ? null : o.key })}
            >
              {o.label}
            </Chip>
          ))}
        </Section>
      )}

      {/* 나에게 — i+1 적합도 (진단 사용자) */}
      {diagnosed && (
        <Section label="나에게">
          {FIT_OPTIONS.map((o) => (
            <Chip
              key={o.key}
              active={filters.fit === o.key}
              onClick={() => onChange({ fit: filters.fit === o.key ? null : o.key })}
            >
              {o.label}
            </Chip>
          ))}
        </Section>
      )}

      {/* 레벨 — V 밴드 */}
      {facets.vBands.length > 0 && (
        <Section label="레벨">
          {V_BANDS.filter((b) => facets.vBands.includes(b.key)).map((b) => (
            <Chip
              key={b.key}
              active={filters.vBand === b.key}
              onClick={() => onChange({ vBand: filters.vBand === b.key ? null : b.key })}
            >
              <span className="font-mono">{b.short}</span> {b.label}
              {myBand === b.key && (
                <span className="ml-0.5 rounded-[var(--r-full)] bg-[var(--p)] px-1 py-px font-mono text-[8.5px] font-[700] text-[var(--on-p)]">
                  내 레벨
                </span>
              )}
            </Chip>
          ))}
        </Section>
      )}

      {/* 장르 */}
      {facets.genres.length > 0 && (
        <Section label="장르">
          {GENRE_BUCKETS.filter((g) => facets.genres.includes(g.key)).map((g) => (
            <Chip
              key={g.key}
              active={filters.genre === g.key}
              onClick={() => onChange({ genre: filters.genre === g.key ? null : g.key })}
            >
              <span aria-hidden>{g.emoji}</span> {g.label}
            </Chip>
          ))}
        </Section>
      )}

      {/* 주제 — 이전 숨김 disclosure 에서 상시 노출로 승격 */}
      {facets.themes.length > 0 && (
        <Section label="주제">
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
              className="inline-flex items-center rounded-[var(--r-full)] px-2 py-1 font-display text-[11px] font-[600] text-[var(--on-p-tint)] transition-colors hover:bg-[var(--p-light)]"
            >
              {allThemes ? '접기' : `+${facets.themes.length - THEME_PREVIEW}개 더보기`}
            </button>
          )}
        </Section>
      )}

      {/* 연령 */}
      {facets.ages.length > 0 && (
        <Section label="연령">
          {AGE_BANDS.filter((a) => facets.ages.includes(a.key)).map((a) => (
            <Chip
              key={a.key}
              active={filters.age === a.key}
              onClick={() => onChange({ age: filters.age === a.key ? null : a.key })}
            >
              {a.label}
            </Chip>
          ))}
        </Section>
      )}

      {/* 길이 — facet-adaptive (실재 버킷만) */}
      {facets.lengths.length > 0 && (
        <Section label="길이">
          {LENGTH_BUCKETS.filter((l) => facets.lengths.includes(l.key)).map((l) => (
            <Chip
              key={l.key}
              active={filters.length === l.key}
              onClick={() => onChange({ length: filters.length === l.key ? null : l.key })}
            >
              {l.label}
            </Chip>
          ))}
        </Section>
      )}

      {/* 포맷 — 같은 책의 다른 표현형(만화/음성). 장르 축과 직교(docs/CCP_LIBRARY_INTEGRATION.md D3). */}
      {(facets.hasComic || facets.hasAudio) && (
        <Section label="포맷">
          {facets.hasComic && (
            <Chip
              active={filters.comicOnly}
              onClick={() => onChange({ comicOnly: !filters.comicOnly })}
            >
              <BookImage size={11} aria-hidden /> 만화로도 볼 수 있어요
            </Chip>
          )}
          {facets.hasAudio && (
            <Chip
              active={filters.audioOnly}
              onClick={() => onChange({ audioOnly: !filters.audioOnly })}
            >
              🔊 원어민 음성
            </Chip>
          )}
        </Section>
      )}
    </div>
  )
}
