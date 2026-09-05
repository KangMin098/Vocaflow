'use client'

import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { SeedPreviewItem } from '@/lib/vcb/server/seed'

const ROW_HEIGHT = 44

const CEFR_DOT_COLOR: Record<string, string> = {
  A1: 'var(--cefr-a1)',
  A2: 'var(--cefr-a2)',
  B1: 'var(--cefr-b1)',
  B2: 'var(--cefr-b2)',
  C1: 'var(--cefr-c1)',
  C2: 'var(--cefr-c2)',
}

interface Props {
  items: SeedPreviewItem[]
  rejections: Set<string>
  selectedKey: string | null
  specCefrSet: Set<string>
  onSelect: (key: string, item: SeedPreviewItem) => void
  onToggleReject: (key: string, item: SeedPreviewItem) => void
}

function confBarColor(c: number): string {
  if (c >= 0.85) return 'var(--success)'
  if (c >= 0.70) return 'var(--warning)'
  return 'var(--error)'
}

export function VcbPreviewList({
  items,
  rejections,
  selectedKey,
  specCefrSet,
  onSelect,
  onToggleReject,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null)

  const v = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  if (items.length === 0) {
    return (
      <div
        className="flex items-center justify-center p-12 rounded-[var(--r-lg)] border text-sm"
        style={{ background: 'var(--bg)', borderColor: 'var(--bd)', color: 'var(--t3)' }}
      >
        필터 조건에 맞는 단어가 없어요
      </div>
    )
  }

  return (
    <div
      className="rounded-[var(--r-lg)] border overflow-hidden"
      style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
    >
      {/* Header */}
      <div
        className="grid items-center px-3 py-2 text-[11px] font-display uppercase tracking-wider border-b"
        style={{
          gridTemplateColumns: '40px 1fr 60px 60px 100px',
          background: 'var(--bg2)',
          borderColor: 'var(--bd)',
          color: 'var(--t3)',
        }}
      >
        <div>#</div>
        <div>Lemma</div>
        <div>POS</div>
        <div>CEFR</div>
        <div>Conf</div>
      </div>

      {/* Virtual scroll container */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: 'calc(100vh - 480px)', minHeight: '320px' }}
        role="grid"
        aria-rowcount={items.length}
      >
        <div style={{ height: v.getTotalSize(), position: 'relative', width: '100%' }}>
          {v.getVirtualItems().map((vItem) => {
            const item = items[vItem.index]!
            const key = `${item.lemma}|${item.pos}`
            const isRejected = rejections.has(key)
            const isSelected = selectedKey === key
            const cefrColor = CEFR_DOT_COLOR[item.cefr_estimate] ?? 'var(--t4)'
            const inSpec = specCefrSet.has(item.cefr_estimate)
            const confColor = confBarColor(item.confidence)

            return (
              <button
                type="button"
                key={key}
                onClick={() => onSelect(key, item)}
                role="row"
                aria-rowindex={vItem.index + 1}
                aria-selected={isSelected}
                className="absolute top-0 left-0 w-full grid items-center px-3 text-sm text-left border-b transition-colors group"
                style={{
                  height: ROW_HEIGHT,
                  transform: `translateY(${vItem.start}px)`,
                  gridTemplateColumns: '40px 1fr 60px 60px 100px',
                  background: isSelected
                    ? 'var(--p-light)'
                    : isRejected
                      ? 'var(--bg2)'
                      : 'var(--bg)',
                  borderColor: 'var(--bd)',
                  borderLeft: isSelected
                    ? '2px solid var(--p)'
                    : isRejected
                      ? '2px solid var(--error)'
                      : '2px solid transparent',
                  color: isRejected ? 'var(--t3)' : 'var(--t1)',
                  opacity: isRejected ? 0.6 : 1,
                  textDecoration: isRejected ? 'line-through' : 'none',
                }}
              >
                <span
                  className="font-mono text-[11px]"
                  style={{ color: 'var(--t3)' }}
                >
                  {vItem.index + 1}
                </span>
                <span
                  className="font-english truncate"
                  style={{ fontSize: '16px', fontWeight: 600 }}
                >
                  {item.lemma}
                </span>
                <span
                  className="font-mono text-[11px] px-2 py-1 rounded-[var(--r-sm)] w-fit"
                  style={{ background: 'var(--bg3)', color: 'var(--t2)' }}
                >
                  {item.pos}
                </span>
                <span className="flex items-center gap-1 text-[12px] font-mono">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: cefrColor, opacity: inSpec ? 1 : 0.45 }}
                  />
                  <span style={{ color: inSpec ? 'var(--t1)' : 'var(--warning)' }}>
                    {item.cefr_estimate}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-[12px] tabular-nums"
                    style={{ color: 'var(--t2)' }}
                  >
                    {item.confidence.toFixed(2)}
                  </span>
                  <div
                    className="flex-1 h-1 rounded-[var(--r-full)] overflow-hidden"
                    style={{ background: 'var(--bg3)' }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${item.confidence * 100}%`,
                        background: confColor,
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleReject(key, item)
                    }}
                    className="min-h-[44px] opacity-0 group-hover:opacity-100 text-[10px] font-display px-2 py-1 rounded-[var(--r-sm)] transition-opacity"
                    style={{
                      background: isRejected ? 'var(--success-light)' : 'var(--error-light)',
                      color: isRejected ? 'var(--success)' : 'var(--error)',
                    }}
                    aria-label={isRejected ? '복귀' : '거부'}
                  >
                    {isRejected ? '복귀' : '거부'}
                  </button>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
