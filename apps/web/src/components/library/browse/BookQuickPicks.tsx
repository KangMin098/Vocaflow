// apps/web/src/components/library/browse/BookQuickPicks.tsx
//
// "빠른 선택" — 한 클릭 의사결정 프리셋 (필터+정렬 조합을 즉시 적용).
// 선택을 적극 지원: 진단 사용자는 "나에게 맞는/도전", 모두에게 "가볍게/오디오북/인기".
// 현재 상태와 일치하면 pressed 표시(토글처럼 보이되 실제로는 조합 적용).

'use client'

import { EMPTY_FILTERS, type BookFilters, type BookSort } from './BookFilterBar'

interface Preset {
  id: string
  label: string
  emoji: string
  needsDiag?: boolean
  needsAudio?: boolean
  patch: Partial<BookFilters>
  sort: BookSort
}

const PRESETS: Preset[] = [
  { id: 'forme', label: '나에게 맞는', emoji: '🎯', needsDiag: true, patch: { fit: 'ideal' }, sort: 'recommended' },
  { id: 'challenge', label: '도전', emoji: '🔥', needsDiag: true, patch: { fit: 'challenge' }, sort: 'recommended' },
  { id: 'light', label: '가볍게', emoji: '☕', patch: { length: 'short' }, sort: 'short' },
  { id: 'audio', label: '오디오북', emoji: '🔊', needsAudio: true, patch: { audioOnly: true }, sort: 'recommended' },
  { id: 'popular', label: '인기', emoji: '⭐', patch: {}, sort: 'popular' },
]

interface Props {
  filters: BookFilters
  sort: BookSort
  diagnosed: boolean
  hasAudio: boolean
  onApply: (filters: BookFilters, sort: BookSort) => void
}

function targetOf(p: Preset): { filters: BookFilters; sort: BookSort } {
  return { filters: { ...EMPTY_FILTERS, ...p.patch }, sort: p.sort }
}

export function BookQuickPicks({ filters, sort, diagnosed, hasAudio, onApply }: Props) {
  const visible = PRESETS.filter(
    (p) => (!p.needsDiag || diagnosed) && (!p.needsAudio || hasAudio),
  )
  if (visible.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-display text-[10px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
        빠른 선택
      </span>
      {visible.map((p) => {
        const t = targetOf(p)
        const active =
          sort === t.sort && JSON.stringify(filters) === JSON.stringify(t.filters)
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={active}
            onClick={() => onApply(t.filters, t.sort)}
            className={`inline-flex items-center gap-1.5 rounded-[var(--r-full)] border px-3 py-1.5 font-display text-[12.5px] font-[700] transition-all active:scale-[0.97] ${
              active
                ? 'border-[var(--p)] bg-[var(--p)] text-white shadow-[var(--sh-sm)]'
                : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:border-[var(--p)] hover:bg-[var(--p-light)]'
            }`}
          >
            <span aria-hidden>{p.emoji}</span>
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
