// apps/web/src/components/wordvault/CollectionsRow.tsx
// 컬렉션 칩 가로 스크롤

'use client'

import { cn } from '@/lib/utils/cn'
import { useState } from 'react'
import { MOCK_COLLECTIONS } from './mock-data'

export interface CollectionsRowProps {
  /** 활성 컬렉션 ID */
  activeId?: string
  /** 컬렉션 변경 콜백 */
  onChange?: (id: string) => void
}

export function CollectionsRow({ activeId: controlledActiveId, onChange }: CollectionsRowProps) {
  const [internalId, setInternalId] = useState('all')
  const activeId = controlledActiveId ?? internalId

  const handleClick = (id: string) => {
    setInternalId(id)
    onChange?.(id)
  }

  return (
    <div className="mb-s-4 flex gap-s-2 overflow-x-auto pb-s-1">
      {MOCK_COLLECTIONS.map((col) => {
        const isActive = activeId === col.id
        return (
          <button
            key={col.id}
            type="button"
            onClick={() => handleClick(col.id)}
            className={cn(
              'shrink-0 cursor-pointer',
              'inline-flex items-center gap-s-2',
              'py-s-1.5 rounded-md px-s-3',
              'border transition-all duration-fast',
              'font-display text-[13px] font-semibold tracking-[-0.01em]',
              isActive
                ? 'border-p bg-p text-bg'
                : 'hover:border-bd-strong border-bd bg-bg text-t2 hover:bg-bg2 hover:text-t1'
            )}
          >
            <span>{col.name}</span>
            <span
              className={cn(
                'px-s-1.5 rounded-[4px] py-[2px] font-mono text-[11px] font-bold',
                isActive ? 'bg-white/15 text-bg' : 'bg-bg2 text-t3'
              )}
            >
              {col.count.toLocaleString()}
            </span>
          </button>
        )
      })}
    </div>
  )
}
