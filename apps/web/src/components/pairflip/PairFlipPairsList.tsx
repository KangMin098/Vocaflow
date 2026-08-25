// apps/web/src/components/pairflip/PairFlipPairsList.tsx
// 매칭한 단어 펼침 가능 리스트

'use client'

import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'

import type { PairFlipPairResult } from './types'

interface PairsListProps {
  pairs: PairFlipPairResult[]
}

function attemptsBadge(attempts: number): { label: string; className: string } {
  if (attempts <= 1) return { label: '한 번에', className: 'bg-[var(--success-light)] text-[#065F46]' }
  if (attempts <= 2) return { label: '두 번 만에', className: 'bg-[var(--warning-light)] text-[#92400E]' }
  return { label: '여러 번 시도', className: 'bg-[var(--bg3)] text-[var(--t2)]' }
}

export function PairFlipPairsList({ pairs }: PairsListProps) {
  const [open, setOpen] = useState(true)

  if (pairs.length === 0) return null

  return (
    <section
      aria-labelledby="pf-pairs-heading"
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[var(--r-lg)] px-4 py-3 text-left transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
      >
        <div className="flex items-center gap-2">
          <h3
            id="pf-pairs-heading"
            className="font-display text-[14px] font-[700] text-[var(--t1)]"
          >
            학습한 단어
          </h3>
          <span className="font-mono text-[12px] font-[600] text-[var(--t2)]">
            {pairs.length}쌍
          </span>
        </div>
        <ChevronDown
          size={16}
          aria-hidden
          className="text-[var(--t2)] transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && (
        <ul className="divide-y divide-[var(--bd)]">
          {pairs.map((p) => {
            const badge = attemptsBadge(p.attempts)
            return (
              <li key={p.pairId} className="flex items-center gap-3 px-4 py-3">
                <Check
                  size={14}
                  className="shrink-0 text-[var(--success)]"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-english text-[14px] font-[600] text-[var(--t1)]">
                    {p.word}
                  </p>
                  <p className="truncate font-body text-[12px] text-[var(--t2)]">
                    {p.meaning}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-[var(--r-full)] px-2 py-1 font-display text-[11px] font-[600] ${badge.className}`}
                >
                  {badge.label}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
