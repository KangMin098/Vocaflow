// apps/web/src/components/wordvault/hub/CEFRDistribution.tsx
//
// CEFRDistribution — 레벨별 자산 분포 (Tier 3 Level Pivot)
// CLAUDE.md §17 자산 facet — Cattell-Horn-Carroll 어휘 모델 정합
//
// 역할: CEFR 6단계(A1~C2) 단어 수 분포 + 막대 클릭 시 browse 레벨 필터 진입
//
// 디자인 의도:
//   - Recognition > Recall: 6 옵션 시각 노출, 검색 입력 X
//   - Categorical color (color-blind safe): 라벨 텍스트 동시 표시
//   - 0개 레벨도 항상 6 행 표시 (consistency · 0=opacity-40 + aria-disabled)

'use client'

import { ArrowRight, Layers } from 'lucide-react'
import Link from 'next/link'

import type { CEFRLevel } from '@/types/library'

interface CEFRBucket {
  level: CEFRLevel
  count: number
}

interface CEFRDistributionProps {
  /** CEFR 6단계 카운트 — 호출자가 words 에서 집계 후 전달 */
  buckets: CEFRBucket[]
}

const LEVEL_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const LEVEL_FILL: Record<CEFRLevel, string> = {
  A1: 'var(--cefr-a1)',
  A2: 'var(--cefr-a2)',
  B1: 'var(--cefr-b1)',
  B2: 'var(--cefr-b2)',
  C1: 'var(--cefr-c1)',
  C2: 'var(--cefr-c2)',
}

const LEVEL_DESC: Record<CEFRLevel, string> = {
  A1: '입문',
  A2: '기초',
  B1: '중급',
  B2: '중상급',
  C1: '상급',
  C2: '최상급',
}

export function CEFRDistribution({ buckets }: CEFRDistributionProps) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0)
  if (total === 0) return null

  const max = Math.max(...buckets.map((b) => b.count), 1)

  // Order-stable map of level → count
  const countMap = new Map<CEFRLevel, number>()
  for (const b of buckets) countMap.set(b.level, b.count)

  return (
    <section
      aria-label="CEFR 레벨별 단어 분포"
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
    >
      <header className="mb-4 flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p)]/10 text-[var(--p)]"
          aria-hidden="true"
        >
          <Layers size={13} strokeWidth={2} />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
            레벨별
          </h2>
          <p className="font-body text-[11px] text-[var(--t2)]">CEFR 6단계 분포</p>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
          {total}개
        </span>
      </header>

      {/* 6 행 — 항상 모두 렌더 */}
      <ul className="flex flex-col gap-1">
        {LEVEL_ORDER.map((level) => {
          const count = countMap.get(level) ?? 0
          const widthPct = (count / max) * 100
          const isEmpty = count === 0
          const a11y = isEmpty
            ? `${level} ${LEVEL_DESC[level]} — 단어 없음`
            : `${level} ${LEVEL_DESC[level]} 레벨 — ${count}개 단어`

          if (isEmpty) {
            return (
              <li
                key={level}
                aria-label={a11y}
                className="flex h-9 select-none items-center gap-3 rounded-[var(--r-md)] px-2 opacity-40"
              >
                <LevelLabel level={level} />
                <Bar widthPct={0} fill={LEVEL_FILL[level]} count={0} max={max} />
                <CountLabel count={0} />
              </li>
            )
          }

          return (
            <li key={level}>
              <Link
                href={`/wordvault?view=browse&level=${level}`}
                aria-label={a11y}
                className="group flex h-9 items-center gap-3 rounded-[var(--r-md)] px-2 transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]/40 focus-visible:ring-offset-1"
              >
                <LevelLabel level={level} />
                <Bar widthPct={widthPct} fill={LEVEL_FILL[level]} count={count} max={max} />
                <CountLabel count={count} />
                <ArrowRight
                  size={12}
                  className="shrink-0 text-[var(--t2)] transition-transform duration-[var(--dur-normal)] group-hover:translate-x-0.5 group-hover:text-[var(--p)]"
                  aria-hidden="true"
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function LevelLabel({ level }: { level: CEFRLevel }) {
  return (
    <span className="w-9 shrink-0 font-display text-[12px] font-[700] tabular-nums text-[var(--t2)]">
      {level}
    </span>
  )
}

function Bar({
  widthPct,
  fill,
  count,
  max,
}: {
  widthPct: number
  fill: string
  count: number
  max: number
}) {
  return (
    <div className="flex flex-1 items-center">
      <div
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-1.5 w-full overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]"
      >
        <div
          className="h-full rounded-[var(--r-full)] transition-[width] duration-[var(--dur-slow)]"
          style={{ width: `${widthPct}%`, backgroundColor: fill }}
        />
      </div>
    </div>
  )
}

function CountLabel({ count }: { count: number }) {
  return (
    <span className="w-12 shrink-0 text-right font-display text-[14px] font-[700] tabular-nums text-[var(--t1)]">
      {count}
    </span>
  )
}
