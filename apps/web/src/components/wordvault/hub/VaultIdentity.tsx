// apps/web/src/components/wordvault/hub/VaultIdentity.tsx
//
// WordVault Mastery Hero (v06.35 패치) — 한눈에 학습 진행도.
//
// "학습자의 단어 학습 정보를 한눈에" 요청 정합 — collection grid 폐기 후
// 1 zone 안에 핵심 학습 정보를 모두 packed:
//   · 큰 숫자 (총 단어) + V-Level 배지 + 누적
//   · 4 bucket 가로 비교 막대 (각각 수치 인라인)
//   · 단일 CTA (risk → shaky → new → review)
//   · 이번 주 목표 진행 바
//
// Editorial monochrome — 회색 + brand --p 액센트.

'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { MemoryState } from '@/lib/srs'

export interface VaultIdentityProps {
  /** 총 단어 (vocabularies 전체) */
  total: number
  /** 4색 분포 — R(t) 기반 */
  buckets: Record<MemoryState, number>
  /** 단어장 수 — 보조 metadata only */
  collections: number
  /** 학습 시작 후 누적일 */
  accumulatedDays: number
  /** 이번 주 (월~일) 학습한 단어 수 */
  weeklyDone: number
  /** 이번 주 목표 단어 수 */
  weeklyTarget: number
}

const NF = new Intl.NumberFormat('en-US')

const BUCKET_META: Record<
  MemoryState,
  { label: string; color: string; hint: string }
> = {
  stable: { label: '확실히 기억', color: '#22C55E', hint: '정복한 단어' },
  shaky: { label: '익숙해지는 중', color: '#F59E0B', hint: '한 번 더 다지면 안정' },
  risk: { label: '잊혀가는 중', color: '#EF4444', hint: '지금 다시 만나면 회복' },
  new: { label: '새로 만난', color: '#94A3B8', hint: '아직 학습 시작 전' },
}

export function VaultIdentity({
  total,
  buckets,
  collections,
  accumulatedDays,
  weeklyDone,
  weeklyTarget,
}: VaultIdentityProps) {
  // V-Level (user_profiles) — at-a-glance 메타로 inline 표시
  const [vLevel, setVLevel] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled || !user) return
      const { data } = await supabase
        .from('user_profiles')
        .select('current_v_level')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      const lv = (data as { current_v_level: number | null } | null)?.current_v_level
      if (lv != null) setVLevel(lv)
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const goalPct = weeklyTarget > 0 ? Math.min(100, (weeklyDone / weeklyTarget) * 100) : 0
  const goalReached = weeklyTarget > 0 && weeklyDone >= weeklyTarget

  // 가장 큰 bucket — 가로 bar 정규화 기준
  const maxBucket = Math.max(buckets.stable, buckets.shaky, buckets.risk, buckets.new, 1)

  // CTA 우선순위
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
      aria-label="내 어휘 학습 현황"
      className="rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 md:p-8"
    >
      {/* ─── 상단 Hero ─── */}
      <div className="mb-7 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-end">
        {/* 큰 숫자 */}
        <div className="flex flex-col">
          <span className="mb-1 font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
            내 어휘
          </span>
          <div className="flex items-end gap-2">
            <span className="font-display text-[68px] font-[800] leading-[0.9] tracking-[-0.04em] tabular-nums text-[var(--t1)] md:text-[88px]">
              {NF.format(total)}
            </span>
            <span className="mb-2 font-body text-[13px] text-[var(--t3)]">단어</span>
          </div>
        </div>

        {/* 메타 칩 row */}
        <div className="flex flex-wrap items-end justify-start gap-4 sm:justify-end">
          {vLevel != null && (
            <MetaBadge label="현재 수준" value={`V${vLevel}`} highlight />
          )}
          <MetaBadge label="누적" value={`${NF.format(accumulatedDays)}일`} />
          <MetaBadge label="단어장" value={`${NF.format(collections)}권`} />
        </div>
      </div>

      {/* ─── 학습 상태 — 4 bucket 가로 비교 ─── */}
      <div className="mb-6 flex flex-col gap-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
            학습 상태
          </span>
          <span className="font-mono text-[10.5px] tabular-nums text-[var(--t3)]">
            {total > 0 && (
              <>
                기억{' '}
                <strong className="font-display text-[var(--t1)]">
                  {Math.round(((buckets.stable + buckets.shaky) / total) * 100)}%
                </strong>
              </>
            )}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <BucketRow state="stable" count={buckets.stable} total={total} maxBucket={maxBucket} />
          <BucketRow state="shaky" count={buckets.shaky} total={total} maxBucket={maxBucket} />
          <BucketRow state="risk" count={buckets.risk} total={total} maxBucket={maxBucket} />
          <BucketRow state="new" count={buckets.new} total={total} maxBucket={maxBucket} />
        </div>
      </div>

      {/* ─── 단일 CTA + 주간 목표 ─── */}
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
            className="h-[3px] w-[220px] overflow-hidden rounded-full bg-[var(--bg3)]"
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

// ─── Bucket Row (가로 막대 + 레이블 + 수치) ─────────────
function BucketRow({
  state,
  count,
  total,
  maxBucket,
}: {
  state: MemoryState
  count: number
  total: number
  maxBucket: number
}) {
  const meta = BUCKET_META[state]
  const widthPct = maxBucket > 0 ? (count / maxBucket) * 100 : 0
  const sharePct = total > 0 ? (count / total) * 100 : 0

  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
      {/* 레이블 + dot */}
      <div className="flex items-center gap-1.5 font-display text-[11.5px] font-[600] text-[var(--t2)]">
        <span
          aria-hidden
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ backgroundColor: meta.color }}
        />
        {meta.label}
      </div>

      {/* 가로 막대 */}
      <div
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={maxBucket}
        className="h-[6px] w-full overflow-hidden rounded-full bg-[var(--bg3)]"
      >
        <div
          className="h-full rounded-full transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out)]"
          style={{ width: `${widthPct}%`, backgroundColor: meta.color }}
        />
      </div>

      {/* 수치 + 비율 */}
      <div className="flex items-baseline gap-1.5 font-mono text-[11px] tabular-nums">
        <span className="font-display font-[700] text-[var(--t1)]">
          {new Intl.NumberFormat('en-US').format(count)}
        </span>
        <span className="text-[var(--t3)]">{sharePct.toFixed(0)}%</span>
      </div>
    </div>
  )
}

// ─── Meta Badge (V-Level / 누적 / 단어장 chip) ─────────
function MetaBadge({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex flex-col items-end gap-0.5 ${
        highlight ? 'rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p-light)] px-3 py-1.5' : ''
      }`}
    >
      <span className="font-mono text-[9.5px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
        {label}
      </span>
      <span
        className={`font-display tabular-nums ${
          highlight
            ? 'text-[16px] font-[800] text-[var(--p-dark)]'
            : 'text-[14px] font-[700] text-[var(--t1)]'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
