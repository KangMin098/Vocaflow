// apps/web/src/components/wordvault/hub/MemoryDecayDistribution.tsx
//
// Memory Decay 4색 분포 시각화 — CLAUDE.md §17.2 [2] 상태 축
// 모든 단어의 SrsCard 에서 getMemoryState(card) 를 계산하여 4색 분포 표시.
// 디자인 철학:
//   - "Implicit Progress" — 색 분포 자체가 누적 학습 결과의 증거
//   - "Calm UI" — 정확한 R(t) 값은 노출 X (§17 안티패턴 2)
//   - 색상 토큰: var(--memory-stable|shaky|risk|new)

'use client'

import { Activity, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'

import { getMemoryState } from '@/lib/srs'
import type { MemoryState } from '@/lib/srs'

import type { WordItem } from '../types'

import { TrendIndicator } from './TrendIndicator'

interface MemoryDecayDistributionProps {
  words: WordItem[]
  /** week-over-week 추세 (v06.18 신규) — 미지정 시 추세선 미표시 */
  trend?: { stableDelta: number; riskDelta: number }
}

interface Bucket {
  state: MemoryState
  count: number
  label: string
  description: string
  colorVar: string
}

export function MemoryDecayDistribution({
  words,
  trend,
}: MemoryDecayDistributionProps) {
  const buckets = useMemo<Bucket[]>(() => {
    const counts: Record<MemoryState, number> = {
      stable: 0,
      shaky: 0,
      risk: 0,
      new: 0,
    }

    for (const w of words) {
      const state = w.srs ? getMemoryState(w.srs) : 'new'
      counts[state] += 1
    }

    return [
      {
        state: 'stable',
        count: counts.stable,
        label: '안정',
        description: '잘 기억하고 있어요',
        colorVar: 'var(--memory-stable)',
      },
      {
        state: 'shaky',
        count: counts.shaky,
        label: '흔들림',
        description: '곧 만나면 좋아요',
        colorVar: 'var(--memory-shaky)',
      },
      {
        state: 'risk',
        count: counts.risk,
        label: '위급',
        description: '지금 다시 만나봐요',
        colorVar: 'var(--memory-risk)',
      },
      {
        state: 'new',
        count: counts.new,
        label: '신규',
        description: '아직 만나지 않았어요',
        colorVar: 'var(--memory-new)',
      },
    ]
  }, [words])

  const total = words.length || 1

  const a11yLabel = buckets.map((b) => `${b.label} ${b.count}개`).join(', ')

  return (
    <section
      aria-label="단어 기억 상태 분포"
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
    >
      <header className="mb-4 flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p)]/10 text-[var(--p)]"
          aria-hidden="true"
        >
          <Activity size={13} strokeWidth={2} />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
            기억 분포
          </h2>
          <p className="font-body text-[11px] text-[var(--t2)]">
            전체 {words.length}개 단어
          </p>
        </div>
        {trend && (
          <TrendIndicator
            stableDelta={trend.stableDelta}
            riskDelta={trend.riskDelta}
          />
        )}
      </header>

      {/* Stacked horizontal bar */}
      <div
        className="mb-4 flex h-3 overflow-hidden rounded-full bg-[var(--bg3)]"
        role="img"
        aria-label={a11yLabel}
      >
        {buckets.map((b) => {
          const pct = (b.count / total) * 100
          if (pct === 0) return null
          return (
            <div
              key={b.state}
              className="h-full transition-all duration-[var(--dur-normal)]"
              style={{
                width: `${pct}%`,
                backgroundColor: b.colorVar,
              }}
            />
          )
        })}
      </div>

      {/* Legend */}
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {buckets.map((b) => (
          <li
            key={b.state}
            className="flex items-start gap-2 rounded-[var(--r-sm)] bg-[var(--bg2)] p-2"
          >
            <span
              className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: b.colorVar }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[16px] font-[800] tabular-nums text-[var(--t1)]">
                  {b.count}
                </span>
                <span className="font-display text-[11px] font-[700] text-[var(--t2)]">
                  {b.label}
                </span>
              </div>
              <p className="font-body text-[10px] leading-tight text-[var(--t2)]">
                {b.description}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {/* Learning gateway — 자산 hub 에서 학습 모듈로 위임 (boundary 명시) */}
      {(() => {
        const attentionCount =
          (buckets.find((b) => b.state === 'risk')?.count ?? 0) +
          (buckets.find((b) => b.state === 'shaky')?.count ?? 0)
        if (attentionCount === 0) return null
        return (
          <Link
            href="/flashcard?mode=review"
            className="mt-3 flex items-center justify-between gap-2 rounded-[var(--r-sm)] border-t border-[var(--bd)] pt-3 font-body text-[12px] text-[var(--t2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1"
          >
            <span>
              주의 필요 <strong className="font-[700] text-[var(--memory-shaky)]">{attentionCount}</strong>개 — Flashcard 에서 학습할 수 있어요
            </span>
            <ArrowRight
              size={11}
              className="shrink-0 text-[var(--t2)]"
              aria-hidden="true"
            />
          </Link>
        )
      })()}
    </section>
  )
}
