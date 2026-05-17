'use client'

// VcbCurationFilterBar.tsx
// 자율 재구성: spec 미수신 (메시지 잘림). VcbCurationView 의 usage 시그니처
// (filter / sort / counts: {all, flagged, unreviewed} / onFilterChange /
// onSortChange) 기반 + AdminToolbar 의 chip 패턴 정합으로 구성.

import { Filter } from 'lucide-react'
import type { CurationFilter, CurationSort } from '@/lib/vcb/types'

interface Props {
  filter: CurationFilter
  sort: CurationSort
  counts: {
    all: number
    flagged: number
    unreviewed: number
  }
  onFilterChange: (f: CurationFilter) => void
  onSortChange: (s: CurationSort) => void
}

const FILTER_OPTIONS: Array<{
  value: CurationFilter
  label: string
  countKey?: keyof Props['counts']
}> = [
  { value: 'all', label: '전체', countKey: 'all' },
  { value: 'flagged', label: '플래그', countKey: 'flagged' },
  { value: 'unreviewed', label: '미검토', countKey: 'unreviewed' },
  { value: 'rejected', label: '거부됨' },
  { value: 'ai_seed', label: 'AI 시드' },
]

const SORT_OPTIONS: Array<{ value: CurationSort; label: string }> = [
  { value: 'ngsl_rank_asc', label: 'NGSL 빈도순' },
  { value: 'cefr_asc', label: 'CEFR 낮은순' },
  { value: 'confidence_desc', label: '신뢰도 높은순' },
  { value: 'origin', label: '출처별' },
]

export function VcbCurationFilterBar({
  filter,
  sort,
  counts,
  onFilterChange,
  onSortChange,
}: Props) {
  return (
    <div
      className="flex flex-col gap-2 p-3 border-b"
      style={{ background: 'var(--bg2)', borderColor: 'var(--bd)' }}
    >
      {/* 필터 chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="w-3 h-3" style={{ color: 'var(--t3)' }} aria-hidden />
        {FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.value
          const count = opt.countKey ? counts[opt.countKey] : undefined
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onFilterChange(opt.value)}
              className="inline-flex items-center gap-1 rounded-[var(--r-full)] border px-2.5 py-1 font-display text-[11px] font-semibold transition-colors"
              style={{
                borderColor: active ? '#6D28D9' : 'var(--bd)',
                background: active ? 'rgba(139, 92, 246, 0.10)' : 'var(--bg)',
                color: active ? '#6D28D9' : 'var(--t2)',
              }}
            >
              {opt.label}
              {typeof count === 'number' && (
                <span
                  className="font-mono text-[10px] tabular-nums opacity-70"
                  aria-label={`${count}개`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 정렬 selector */}
      <div className="flex items-center gap-2">
        <label
          className="font-display text-[11px] uppercase tracking-wider"
          style={{ color: 'var(--t3)' }}
          htmlFor="vcb-curation-sort"
        >
          정렬
        </label>
        <select
          id="vcb-curation-sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as CurationSort)}
          className="flex-1 px-2 py-1 rounded-[var(--r-sm)] border font-display text-xs"
          style={{
            background: 'var(--bg)',
            borderColor: 'var(--bd)',
            color: 'var(--t1)',
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
