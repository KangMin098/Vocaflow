// apps/web/src/components/wordvault/hub/VaultIdentity.tsx
//
// WordVault Zone 1 (v06.35 재설계) — 자산 + 이번 주 목표 + 단일 CTA.
//
// Editorial monochrome — gradient/이모지 제거, 회색 + --p 액센트만.
// 핵심 메시지 1개: "이번 주 X/Y · 지금 복습 (risk N)".

'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import type { MemoryState } from '@/lib/srs'

export interface VaultIdentityProps {
  /** 총 단어 (vocabularies 전체) */
  total: number
  /** 4색 분포 — R(t) 기반 */
  buckets: Record<MemoryState, number>
  /** 단어장 수 (스크립트 + 구독 단어장 합) */
  collections: number
  /** 학습 시작 후 누적일 */
  accumulatedDays: number
  /** 이번 주 (월~일) 학습한 단어 수 */
  weeklyDone: number
  /** 이번 주 목표 단어 수 (user_profiles.daily_word_goal × 7) */
  weeklyTarget: number
}

const NF = new Intl.NumberFormat('en-US')

export function VaultIdentity({
  total,
  buckets,
  collections,
  accumulatedDays,
  weeklyDone,
  weeklyTarget,
}: VaultIdentityProps) {
  const goalPct = weeklyTarget > 0 ? Math.min(100, (weeklyDone / weeklyTarget) * 100) : 0
  const goalReached = weeklyTarget > 0 && weeklyDone >= weeklyTarget

  const totalNonNew = buckets.stable + buckets.shaky + buckets.risk
  const sStable = totalNonNew > 0 ? (buckets.stable / totalNonNew) * 100 : 0
  const sShaky = totalNonNew > 0 ? (buckets.shaky / totalNonNew) * 100 : 0
  const sRisk = totalNonNew > 0 ? (buckets.risk / totalNonNew) * 100 : 0

  // 단일 CTA 우선순위: risk → shaky → new → 둘러보기
  let ctaLabel = '단어 둘러보기'
  let ctaHref = '/wordvault/browse'
  let ctaCount = 0
  if (buckets.risk > 0) {
    ctaLabel = '지금 다시 만나기'
    ctaHref = `/wordvault/browse?filter=state:risk`
    ctaCount = buckets.risk
  } else if (buckets.shaky > 0) {
    ctaLabel = '흔들리는 단어 다지기'
    ctaHref = `/wordvault/browse?filter=state:shaky`
    ctaCount = buckets.shaky
  } else if (buckets.new > 0) {
    ctaLabel = '새 단어 익히기'
    ctaHref = `/wordvault/browse?filter=state:new`
    ctaCount = buckets.new
  }

  return (
    <section
      aria-label="내 어휘 자산"
      className="rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 md:p-8"
    >
      {/* 상단 메타 row */}
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
          내 어휘
        </span>
        <div className="flex items-baseline gap-4 font-mono text-[11px] text-[var(--t3)]">
          <span>
            <strong className="font-display font-[700] tabular-nums text-[var(--t1)]">
              {NF.format(collections)}
            </strong>
            <span className="ml-1">단어장</span>
          </span>
          <span aria-hidden className="text-[var(--t4)]">·</span>
          <span>
            <strong className="font-display font-[700] tabular-nums text-[var(--t1)]">
              {NF.format(accumulatedDays)}
            </strong>
            <span className="ml-1">일</span>
          </span>
        </div>
      </div>

      {/* 큰 숫자 — 자산 전체 */}
      <div className="mb-7 flex items-end gap-3">
        <span className="font-display text-[64px] font-[800] leading-[0.9] tracking-[-0.04em] tabular-nums text-[var(--t1)] md:text-[88px]">
          {NF.format(total)}
        </span>
        <span className="mb-2 font-body text-[13px] text-[var(--t3)]">단어</span>
      </div>

      {/* 4색 분포 bar — stable/shaky/risk + new 별도 표시 */}
      <div className="mb-6">
        {totalNonNew > 0 ? (
          <div
            role="img"
            aria-label={`stable ${buckets.stable}, shaky ${buckets.shaky}, risk ${buckets.risk}`}
            className="flex h-[6px] w-full overflow-hidden rounded-full bg-[var(--bg3)]"
          >
            {sStable > 0 && (
              <div
                style={{ width: `${sStable}%`, backgroundColor: '#22C55E' }}
                title={`stable ${buckets.stable}`}
              />
            )}
            {sShaky > 0 && (
              <div
                style={{ width: `${sShaky}%`, backgroundColor: '#F59E0B' }}
                title={`shaky ${buckets.shaky}`}
              />
            )}
            {sRisk > 0 && (
              <div
                style={{ width: `${sRisk}%`, backgroundColor: '#EF4444' }}
                title={`risk ${buckets.risk}`}
              />
            )}
          </div>
        ) : (
          <div className="h-[6px] w-full rounded-full bg-[var(--bg3)]" />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11px] tabular-nums text-[var(--t2)]">
          <BucketLabel color="#22C55E" label="stable" count={buckets.stable} />
          <BucketLabel color="#F59E0B" label="shaky" count={buckets.shaky} />
          <BucketLabel color="#EF4444" label="risk" count={buckets.risk} />
          <BucketLabel color="#94A3B8" label="new" count={buckets.new} />
        </div>
      </div>

      {/* 이번 주 목표 + 단일 CTA */}
      <div className="flex flex-col gap-4 border-t border-[var(--bd)] pt-5 md:flex-row md:items-center md:justify-between">
        {/* 주간 목표 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2 font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
            <span>이번 주 목표</span>
            <span className="tabular-nums text-[var(--t2)]">
              {NF.format(weeklyDone)} / {NF.format(weeklyTarget)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={weeklyDone}
            aria-valuemin={0}
            aria-valuemax={weeklyTarget}
            className="h-[3px] w-[200px] overflow-hidden rounded-full bg-[var(--bg3)]"
          >
            <div
              className="h-full rounded-full transition-all duration-[var(--dur-slow)] ease-[var(--ease-out)]"
              style={{
                width: `${goalPct}%`,
                backgroundColor: goalReached ? '#22C55E' : 'var(--p)',
              }}
            />
          </div>
        </div>

        {/* CTA */}
        <Link
          href={ctaHref}
          className="inline-flex shrink-0 items-center justify-between gap-3 rounded-[var(--r-md)] bg-[var(--t1)] px-5 py-3 font-display text-[14px] font-[600] text-[var(--bg)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          <span>{ctaLabel}</span>
          {ctaCount > 0 && (
            <span className="rounded-[var(--r-full)] bg-[var(--bg)]/15 px-2 py-0.5 font-mono text-[11px] tabular-nums">
              {NF.format(ctaCount)}
            </span>
          )}
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </section>
  )
}

function BucketLabel({
  color,
  label,
  count,
}: {
  color: string
  label: string
  count: number
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="h-[7px] w-[7px] rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-[var(--t3)]">{label}</span>
      <span className="text-[var(--t1)]">{NF.format(count)}</span>
    </span>
  )
}
