// apps/web/src/components/admin/vcb/preview/VcbPreviewFilters.tsx

'use client'

import { useState } from 'react'
import { Search, ChevronDown } from 'lucide-react'

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type FrequencyTier = 'core' | 'common' | 'moderate' | 'rare'

export interface PreviewFilters {
  search: string
  cefr: CefrLevel[]
  pos: string[]
  tier: FrequencyTier[]
  confMin: number
  attentionOnly: boolean
}

interface Props {
  filters: PreviewFilters
  onChange: (next: PreviewFilters) => void
  visibleCount: number
  totalCount: number
  posOptions: string[]
}

const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const TIERS: FrequencyTier[] = ['core', 'common', 'moderate', 'rare']

const CEFR_DOT_COLOR: Record<CefrLevel, string> = {
  A1: 'var(--cefr-a1)',
  A2: 'var(--cefr-a2)',
  B1: 'var(--cefr-b1)',
  B2: 'var(--cefr-b2)',
  C1: 'var(--cefr-c1)',
  C2: 'var(--cefr-c2)',
}

export function VcbPreviewFilters({ filters, onChange, visibleCount, totalCount, posOptions }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const toggleCefr = (level: CefrLevel) => {
    onChange({
      ...filters,
      cefr: filters.cefr.includes(level)
        ? filters.cefr.filter((l) => l !== level)
        : [...filters.cefr, level],
    })
  }

  const togglePos = (pos: string) => {
    onChange({
      ...filters,
      pos: filters.pos.includes(pos)
        ? filters.pos.filter((p) => p !== pos)
        : [...filters.pos, pos],
    })
  }

  const toggleTier = (tier: FrequencyTier) => {
    onChange({
      ...filters,
      tier: filters.tier.includes(tier)
        ? filters.tier.filter((t) => t !== tier)
        : [...filters.tier, tier],
    })
  }

  return (
    <section
      className="p-4 rounded-[var(--r-lg)] border flex flex-col gap-3"
      style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
    >
      {/* Primary row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--t3)' }}
          />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="lemma 검색…"
            className="min-h-[44px] w-full pl-9 pr-3 py-2 rounded-[var(--r-md)] border text-sm"
            style={{
              background: 'var(--bg2)',
              borderColor: 'var(--bd)',
              color: 'var(--t1)',
            }}
            aria-label="lemma 검색"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-display" style={{ color: 'var(--t2)' }}>
            CEFR
          </span>
          <div className="flex gap-1">
            {CEFR_LEVELS.map((level) => {
              const active = filters.cefr.includes(level)
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleCefr(level)}
                  className="min-h-[44px] px-3 py-2 rounded-[var(--r-md)] text-xs font-mono font-semibold flex items-center gap-1 border transition-colors"
                  style={{
                    background: active ? CEFR_DOT_COLOR[level] : 'var(--bg2)',
                    color: active ? 'var(--ti)' : 'var(--t2)',
                    borderColor: active ? CEFR_DOT_COLOR[level] : 'var(--bd)',
                  }}
                  aria-pressed={active}
                >
                  {level}
                </button>
              )
            })}
          </div>
        </div>

        <label className="flex min-h-[44px] items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.attentionOnly}
            onChange={(e) => onChange({ ...filters, attentionOnly: e.target.checked })}
            className={/* 체크박스는 대체 요소(replaced element)라 ::after 로 히트 영역을 못 넓힌다 — 탭 영역은 감싼 <label> 44px */ 'w-4 h-4 accent-[var(--warning)]'}
          />
          <span className="text-xs font-display" style={{ color: 'var(--t2)' }}>
            ⚠ 주의만 (낮은 신뢰도 + spec 외)
          </span>
        </label>

        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="min-h-[44px] inline-flex items-center gap-1 px-3 py-2 rounded-[var(--r-md)] text-xs font-display border"
          style={{
            background: advancedOpen ? 'var(--p-light)' : 'var(--bg2)',
            color: advancedOpen ? 'var(--p)' : 'var(--t2)',
            borderColor: 'var(--bd)',
          }}
          aria-expanded={advancedOpen}
        >
          고급
          <ChevronDown
            className={`w-3 h-3 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Advanced row */}
      {advancedOpen && (
        <div
          className="flex flex-wrap items-center gap-4 pt-3 border-t"
          style={{ borderColor: 'var(--bd)' }}
        >
          {posOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-display" style={{ color: 'var(--t2)' }}>
                POS
              </span>
              <div className="flex flex-wrap gap-1">
                {posOptions.map((pos) => {
                  const active = filters.pos.includes(pos)
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => togglePos(pos)}
                      className="min-h-[44px] px-2 py-1 rounded-[var(--r-sm)] text-[11px] font-mono border"
                      style={{
                        background: active ? 'var(--p-light)' : 'var(--bg2)',
                        color: active ? 'var(--p)' : 'var(--t2)',
                        borderColor: active ? 'var(--p)' : 'var(--bd)',
                      }}
                      aria-pressed={active}
                    >
                      {pos}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-display" style={{ color: 'var(--t2)' }}>
              Tier
            </span>
            <div className="flex gap-1">
              {TIERS.map((tier) => {
                const active = filters.tier.includes(tier)
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => toggleTier(tier)}
                    className="min-h-[44px] px-2 py-1 rounded-[var(--r-sm)] text-[11px] font-mono border"
                    style={{
                      background: active ? 'var(--p-light)' : 'var(--bg2)',
                      color: active ? 'var(--p)' : 'var(--t2)',
                      borderColor: active ? 'var(--p)' : 'var(--bd)',
                    }}
                    aria-pressed={active}
                  >
                    {tier}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-display whitespace-nowrap" style={{ color: 'var(--t2)' }}>
              Conf ≥
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={filters.confMin}
              onChange={(e) => onChange({ ...filters, confMin: parseFloat(e.target.value) })}
              className="w-32 accent-[var(--p)]"
              aria-label="최소 신뢰도"
            />
            <span className="font-mono text-xs w-9" style={{ color: 'var(--t2)' }}>
              {filters.confMin.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Result count */}
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--t3)' }}>
        <span>
          표시: <span style={{ color: 'var(--t1)', fontWeight: 600 }}>{visibleCount.toLocaleString()}</span> / {totalCount.toLocaleString()}건
        </span>
        {(filters.search ||
          filters.cefr.length > 0 ||
          filters.pos.length > 0 ||
          filters.tier.length > 0 ||
          filters.confMin > 0 ||
          filters.attentionOnly) && (
          <button
            type="button"
            onClick={() =>
              onChange({
                search: '',
                cefr: [],
                pos: [],
                tier: [],
                confMin: 0,
                attentionOnly: false,
              })
            }
            className="text-[11px] underline"
            style={{ color: 'var(--p)' }}
          >
            필터 초기화
          </button>
        )}
      </div>
    </section>
  )
}
