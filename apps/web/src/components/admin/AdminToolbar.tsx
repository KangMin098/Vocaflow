// apps/web/src/components/admin/AdminToolbar.tsx
// 관리자 sub-page 공통 검색·필터 툴바

'use client'

import { Filter, Search } from 'lucide-react'

export interface FilterChip {
  label: string
  active?: boolean
  count?: number
  onClick?: () => void
}

export interface AdminToolbarProps {
  /** 검색 placeholder */
  searchPlaceholder?: string
  /** 검색 값 (controlled) */
  searchValue?: string
  onSearchChange?: (v: string) => void
  /** 필터 칩 배열 */
  chips?: FilterChip[]
  /** 우측 액션 슬롯 */
  trailing?: React.ReactNode
}

export function AdminToolbar({
  searchPlaceholder = '검색',
  searchValue,
  onSearchChange,
  chips,
  trailing,
}: AdminToolbarProps) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-3 shadow-[var(--sh-xs)]">
      {/* 검색 */}
      <div className="relative min-w-0 flex-1">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t2)]"
          aria-hidden
        />
        <input
          type="search"
          placeholder={searchPlaceholder}
          value={searchValue ?? ''}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] py-2 pl-9 pr-3 font-body text-[13px] text-[var(--t1)] placeholder:text-[var(--t2)] focus:border-[var(--bdf)] focus:outline-none focus:ring-2 focus:ring-[var(--p)]/20"
        />
      </div>

      {/* 필터 칩 */}
      {chips && chips.length > 0 && (
        <div className="flex items-center gap-1.5">
          <Filter size={13} className="text-[var(--t2)]" aria-hidden />
          {chips.map((c, i) => (
            <button
              key={i}
              onClick={c.onClick}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-display text-[11px] font-[600] transition-colors duration-[var(--dur-normal)] ${
                c.active
                  ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#8B5CF6]'
                  : 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[#8B5CF6]/40 hover:text-[#8B5CF6]'
              }`}
            >
              {c.label}
              {typeof c.count === 'number' && (
                <span className="font-mono text-[10px] tabular-nums opacity-70">{c.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  )
}
