// apps/web/src/components/admin/vcb/wizard/FilterPanel.tsx
// Wizard Step 2 — 전체 필터 매트릭스 (V-Level / CEFR / list_tags / freq / pos / verified / limits).

'use client'

import {
  ALL_V_LEVELS,
  ALL_CEFR,
  ALL_LIST_TAGS,
  ALL_FREQ_BANDS,
  PRACTICAL_POS,
  LIST_TAG_LABELS,
  FREQ_BAND_LABELS,
  POS_LABELS,
  SORT_LABELS,
} from '@/lib/vcb/filters'
import type {
  VocabFilters,
  VocabLimits,
  VLevel,
  ListTag,
  FreqBand,
  PracticalPos,
  SortBy,
  TagMatchMode,
} from '@/lib/vcb/filters'
import type { Cefr } from '@/lib/vcb/types'
import { LiveCountBadge } from './LiveCountBadge'

interface Props {
  filters: VocabFilters
  limits: VocabLimits
  onFiltersChange: (next: VocabFilters) => void
  onLimitsChange: (next: VocabLimits) => void
  onCount?: (count: number) => void
}

export function FilterPanel({
  filters,
  limits,
  onFiltersChange,
  onLimitsChange,
  onCount,
}: Props) {
  const setF = <K extends keyof VocabFilters>(key: K, value: VocabFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }
  const setL = <K extends keyof VocabLimits>(key: K, value: VocabLimits[K]) => {
    onLimitsChange({ ...limits, [key]: value })
  }

  const toggleInArray = <T,>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--t1)' }}>
          필터 미세조정
        </h3>
        <p className="text-sm font-body" style={{ color: 'var(--t3)' }}>
          프리셋이 채운 기본값을 그대로 두거나 자유롭게 조정. 우측 상단 매치 수가 실시간 갱신됩니다.
        </p>
      </div>

      {/* ── Live Count (sticky on top) ──────────── */}
      <div className="sticky top-2 z-10">
        <LiveCountBadge filters={filters} maxWords={limits.max_words} onCount={onCount} />
      </div>

      {/* ── V-Level range ──────────────────────── */}
      <Section label="V-Level 범위" hint="진단 V-Level (1=초보 ~ 11=고급)">
        <div className="flex items-center gap-3">
          <RangeSelect
            value={filters.v_level_min}
            options={[null, ...ALL_V_LEVELS]}
            onChange={(v) => setF('v_level_min', v as VLevel | null)}
            placeholder="V-Level 최소"
          />
          <span style={{ color: 'var(--t3)' }}>~</span>
          <RangeSelect
            value={filters.v_level_max}
            options={[null, ...ALL_V_LEVELS]}
            onChange={(v) => setF('v_level_max', v as VLevel | null)}
            placeholder="V-Level 최대"
          />
          {(filters.v_level_min !== null || filters.v_level_max !== null) && (
            <button
              type="button"
              onClick={() => {
                onFiltersChange({ ...filters, v_level_min: null, v_level_max: null })
              }}
              className="text-xs font-body px-2 py-1 rounded-[var(--r-sm)] border"
              style={{ color: 'var(--t3)', borderColor: 'var(--bd)' }}
            >
              초기화
            </button>
          )}
        </div>
      </Section>

      {/* ── list_tags ──────────────────────────── */}
      <Section
        label="목적별 리스트 (list_tags)"
        hint={`매칭 모드: ${filters.list_tags_mode === 'all' ? '모두 포함 (AND)' : '하나라도 (OR)'}`}
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setF('list_tags_mode', 'any' as TagMatchMode)}
              className="text-xs font-display font-medium px-2.5 py-1 rounded-[var(--r-sm)] border transition-all"
              style={{
                background:
                  filters.list_tags_mode === 'any' ? 'var(--p-light)' : 'var(--bg)',
                color: filters.list_tags_mode === 'any' ? 'var(--p-dark)' : 'var(--t2)',
                borderColor:
                  filters.list_tags_mode === 'any' ? 'var(--p)' : 'var(--bd)',
              }}
            >
              OR
            </button>
            <button
              type="button"
              onClick={() => setF('list_tags_mode', 'all' as TagMatchMode)}
              className="text-xs font-display font-medium px-2.5 py-1 rounded-[var(--r-sm)] border transition-all"
              style={{
                background:
                  filters.list_tags_mode === 'all' ? 'var(--p-light)' : 'var(--bg)',
                color: filters.list_tags_mode === 'all' ? 'var(--p-dark)' : 'var(--t2)',
                borderColor:
                  filters.list_tags_mode === 'all' ? 'var(--p)' : 'var(--bd)',
              }}
            >
              AND
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {ALL_LIST_TAGS.map((tag) => {
            const meta = LIST_TAG_LABELS[tag]
            const active = filters.list_tags.includes(tag)
            return (
              <Chip
                key={tag}
                label={meta.label}
                hint={meta.hint}
                active={active}
                onClick={() => setF('list_tags', toggleInArray(filters.list_tags, tag) as ListTag[])}
              />
            )
          })}
        </div>
      </Section>

      {/* ── frequency_band ─────────────────────── */}
      <Section label="빈도 band" hint="frequency_band — NGSL 등 순위 구간">
        <div className="flex flex-wrap gap-2">
          {ALL_FREQ_BANDS.map((band) => {
            const active = filters.freq_bands.includes(band)
            return (
              <Chip
                key={band}
                label={FREQ_BAND_LABELS[band]}
                active={active}
                size="sm"
                onClick={() => setF('freq_bands', toggleInArray(filters.freq_bands, band) as FreqBand[])}
              />
            )
          })}
        </div>
      </Section>

      {/* ── primary_pos ────────────────────────── */}
      <Section label="품사" hint="primary_pos (실용 7종)">
        <div className="flex flex-wrap gap-2">
          {PRACTICAL_POS.map((pos) => {
            const active = filters.primary_pos.includes(pos)
            return (
              <Chip
                key={pos}
                label={POS_LABELS[pos]}
                active={active}
                size="sm"
                onClick={() =>
                  setF('primary_pos', toggleInArray(filters.primary_pos, pos) as PracticalPos[])
                }
              />
            )
          })}
        </div>
      </Section>

      {/* ── CEFR ───────────────────────────────── */}
      <Section label="CEFR" hint="A1 (입문) ~ C2 (전문가)">
        <div className="flex flex-wrap gap-2">
          {ALL_CEFR.map((cefr) => {
            const active = filters.cefr_levels.includes(cefr)
            return (
              <Chip
                key={cefr}
                label={cefr}
                active={active}
                size="sm"
                onClick={() => setF('cefr_levels', toggleInArray(filters.cefr_levels, cefr) as Cefr[])}
              />
            )
          })}
        </div>
      </Section>

      {/* ── verified ───────────────────────────── */}
      <Section label="검증" hint="verified=true 만 (큐레이션 완료된 단어)">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.verified_only}
            onChange={(e) => setF('verified_only', e.target.checked)}
            className="w-5 h-5 rounded"
            style={{ accentColor: 'var(--p)' }}
          />
          <span className="text-sm font-body" style={{ color: 'var(--t2)' }}>
            검증된 단어만 사용
          </span>
        </label>
      </Section>

      {/* ── limits ─────────────────────────────── */}
      <Section label="단어 수 한도 + 정렬" hint="limits">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-display" style={{ color: 'var(--t3)' }}>
              최대 단어 수
            </span>
            <select
              value={limits.max_words === null ? 'unlimited' : String(limits.max_words)}
              onChange={(e) => {
                const v = e.target.value
                setL('max_words', v === 'unlimited' ? null : parseInt(v, 10))
              }}
              className="px-3 py-2 rounded-[var(--r-md)] border text-sm font-body"
              style={{ background: 'var(--bg)', borderColor: 'var(--bd)', color: 'var(--t1)' }}
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="300">300</option>
              <option value="500">500</option>
              <option value="800">800</option>
              <option value="1000">1,000</option>
              <option value="2000">2,000</option>
              <option value="unlimited">무제한</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-display" style={{ color: 'var(--t3)' }}>
              정렬 기준
            </span>
            <select
              value={limits.sort_by}
              onChange={(e) => setL('sort_by', e.target.value as SortBy)}
              className="px-3 py-2 rounded-[var(--r-md)] border text-sm font-body"
              style={{ background: 'var(--bg)', borderColor: 'var(--bd)', color: 'var(--t1)' }}
            >
              <option value="frequency_rank">{SORT_LABELS.frequency_rank}</option>
              <option value="v_level">{SORT_LABELS.v_level}</option>
              <option value="alpha">{SORT_LABELS.alpha}</option>
              <option value="random">{SORT_LABELS.random}</option>
            </select>
          </label>
        </div>
      </Section>
    </div>
  )
}

// ── 내부 helper 컴포넌트 ─────────────────────────
function Section({
  label,
  hint,
  action,
  children,
}: {
  label: string
  hint?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-display font-medium text-sm" style={{ color: 'var(--t1)' }}>
            {label}
          </span>
          {hint && (
            <span className="text-xs font-body" style={{ color: 'var(--t3)' }}>
              {hint}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Chip({
  label,
  hint,
  active,
  size = 'md',
  onClick,
}: {
  label: string
  hint?: string
  active: boolean
  size?: 'sm' | 'md'
  onClick: () => void
}) {
  const padClass = size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-2'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${padClass} rounded-[var(--r-md)] text-left transition-all flex flex-col gap-0`}
      style={{
        // Calm UI tonal — solid var(--p) 풀 → p-light tint + p-dark text + 1.5px border
        background: active ? 'var(--p-light)' : 'var(--bg)',
        border: `${active ? 1.5 : 1}px solid ${active ? 'var(--p)' : 'var(--bd)'}`,
        color: active ? 'var(--p-dark)' : 'var(--t1)',
      }}
    >
      <span className="font-display text-[13px] font-medium">{label}</span>
      {hint && (
        <span
          className="text-[10.5px] font-body"
          style={{ color: active ? 'var(--p)' : 'var(--t3)' }}
        >
          {hint}
        </span>
      )}
    </button>
  )
}

function RangeSelect<T extends string | number | null>({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: T
  options: T[]
  onChange: (v: T) => void
  placeholder: string
}) {
  return (
    <select
      value={value === null ? '__null__' : String(value)}
      onChange={(e) => {
        const v = e.target.value
        onChange((v === '__null__' ? null : Number(v)) as T)
      }}
      className="px-3 py-2 rounded-[var(--r-md)] border text-sm font-body"
      style={{ background: 'var(--bg)', borderColor: 'var(--bd)', color: 'var(--t1)' }}
    >
      <option value="__null__">{placeholder}</option>
      {options.filter((v) => v !== null).map((v) => (
        <option key={String(v)} value={String(v)}>
          V{v}
        </option>
      ))}
    </select>
  )
}
