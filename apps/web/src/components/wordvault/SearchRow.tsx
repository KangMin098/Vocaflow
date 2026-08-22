// apps/web/src/components/wordvault/SearchRow.tsx
// 검색 + 필터 한 줄

'use client'

import { Search } from 'lucide-react'
import { useState } from 'react'

export interface SearchRowProps {
  onSearchChange?: (query: string) => void
  onLevelChange?: (level: string) => void
  onSortChange?: (sort: string) => void
}

export function SearchRow({ onSearchChange, onLevelChange, onSortChange }: SearchRowProps) {
  const [query, setQuery] = useState('')

  const handleQuery = (v: string) => {
    setQuery(v)
    onSearchChange?.(v)
  }

  return (
    <div className="flex flex-wrap items-center gap-s-2 sm:flex-nowrap">
      <div className="relative min-w-[200px] flex-1">
        <Search size={13} className="absolute left-[13px] top-1/2 -translate-y-1/2 text-t3" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQuery(e.target.value)}
          placeholder="단어 또는 의미로 검색..."
          className="h-[38px] w-full rounded-md border border-bd bg-bg pl-[38px] pr-s-4 font-body text-sm text-t1 transition-all duration-fast placeholder:text-t3 focus:border-bdf focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)] focus:outline-none"
        />
      </div>

      <select
        onChange={(e) => onLevelChange?.(e.target.value)}
        className="h-[38px] cursor-pointer appearance-none rounded-md border border-bd bg-bg bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2210%22%20height=%2210%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%23A1A1AA%22%20stroke-width=%222.5%22%3E%3Cpolyline%20points=%226%209%2012%2015%2018%209%22/%3E%3C/svg%3E')] bg-[right_11px_center] bg-no-repeat pl-[13px] pr-[32px] font-display text-[13px] font-semibold tracking-[-0.01em] text-t2 focus:border-bdf focus:outline-none"
      >
        <option value="all">난이도: 전체</option>
        <option value="a">A1 ~ A2 · 기초</option>
        <option value="b">B1 ~ B2 · 중급</option>
        <option value="c">C1 ~ C2 · 고급</option>
      </select>

      <select
        onChange={(e) => onSortChange?.(e.target.value)}
        className="h-[38px] cursor-pointer appearance-none rounded-md border border-bd bg-bg bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2210%22%20height=%2210%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%23A1A1AA%22%20stroke-width=%222.5%22%3E%3Cpolyline%20points=%226%209%2012%2015%2018%209%22/%3E%3C/svg%3E')] bg-[right_11px_center] bg-no-repeat pl-[13px] pr-[32px] font-display text-[13px] font-semibold tracking-[-0.01em] text-t2 focus:border-bdf focus:outline-none"
      >
        <option value="recent">최근 추가</option>
        <option value="alpha">알파벳 순</option>
        <option value="mastery">마스터 낮은 순</option>
      </select>
    </div>
  )
}
