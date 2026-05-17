'use client'

import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VcbQueueListItem } from '@/lib/vcb/types'

interface Props {
  items: VcbQueueListItem[]
  selectedId: number | null
  selectedIds: Set<number>
  onSelect: (id: number) => void
  onToggleMultiSelect: (id: number) => void
}

export function VcbCurationList({
  items,
  selectedId,
  selectedIds,
  onSelect,
  onToggleMultiSelect,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  })

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto" style={{ contain: 'strict' }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((vItem) => {
          const item = items[vItem.index]
          if (!item) return null
          const isSelected = selectedId === item.queue_id
          const isMultiSelected = selectedIds.has(item.queue_id)

          return (
            <button
              key={item.queue_id}
              type="button"
              className="flex items-center gap-2 w-full px-3 text-left border-b"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translateY(${vItem.start}px)`,
                height: `${vItem.size}px`,
                background: isSelected
                  ? 'var(--p-light)'
                  : isMultiSelected
                    ? 'var(--bg3)'
                    : 'transparent',
                color: isSelected ? 'var(--p)' : 'var(--t1)',
                borderColor: 'var(--bd)',
              }}
              onClick={(e) => {
                if (e.shiftKey || e.metaKey || e.ctrlKey) {
                  onToggleMultiSelect(item.queue_id)
                } else {
                  onSelect(item.queue_id)
                }
              }}
            >
              <input
                type="checkbox"
                checked={isMultiSelected}
                readOnly
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleMultiSelect(item.queue_id)
                }}
              />
              <span className="flex-1 font-display font-medium text-sm">{item.lemma}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-[var(--r-sm)]"
                style={{ background: 'var(--bg2)', color: 'var(--t3)' }}
              >
                {item.pos}
              </span>
              {item.cefr && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-[var(--r-sm)] font-mono"
                  style={{
                    background: `var(--cefr-${item.cefr}-bg)`,
                    color: `var(--cefr-${item.cefr}-text)`,
                  }}
                >
                  {item.cefr}
                </span>
              )}
              {item.qa_flags.length > 0 && (
                <span
                  className="font-mono text-[10px]"
                  style={{ color: 'var(--warning)' }}
                >
                  {item.qa_flags.join(',')}
                </span>
              )}
              {item.seed_origin === 'ai_generated' && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-[var(--r-sm)]"
                  style={{ background: 'var(--info-light)', color: 'var(--info)' }}
                >
                  AI
                </span>
              )}
              {item.latest_decision && (
                <span
                  className="text-sm"
                  style={{
                    color:
                      item.latest_decision === 'approve'
                        ? 'var(--success)'
                        : item.latest_decision === 'reject'
                          ? 'var(--error)'
                          : 'var(--t3)',
                  }}
                >
                  {item.latest_decision === 'approve'
                    ? '✓'
                    : item.latest_decision === 'reject'
                      ? '✗'
                      : '✎'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
