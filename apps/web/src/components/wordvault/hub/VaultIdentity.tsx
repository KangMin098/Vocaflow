// apps/web/src/components/wordvault/hub/VaultIdentity.tsx
//
// WordVault Section 1 (v06.35 iOS) — Activity Ring + 거대한 hero 숫자 + 캡슐.
//
// iOS Activity·Fitness app 감성:
//   · 그레이 캔버스 위에 흰 카드 (border 없이 soft shadow)
//   · 좌측: iOS Activity Ring (이번 주 목표 진행도)
//   · 우측: 거대한 hero 숫자 (SF Display-style, tight tracking)
//   · 4 bucket = 캡슐 (capsule) row — Apple Stocks/Health 스타일
//   · 단일 CTA 큰 캡슐 버튼 (iOS Primary)

'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { MemoryState } from '@/lib/srs'

export interface VaultIdentityProps {
  total: number
  buckets: Record<MemoryState, number>
  collections: number
  accumulatedDays: number
  weeklyDone: number
  weeklyTarget: number
}

const NF = new Intl.NumberFormat('en-US')

const BUCKET_META: Record<
  MemoryState,
  { label: string; color: string }
> = {
  stable: { label: '확실', color: '#34C759' /* iOS green */ },
  shaky: { label: '익숙', color: '#FF9F0A' /* iOS orange */ },
  risk: { label: '회복', color: '#FF453A' /* iOS red */ },
  new: { label: '신규', color: '#8E8E93' /* iOS gray */ },
}

export function VaultIdentity({
  total,
  buckets,
  collections,
  accumulatedDays,
  weeklyDone,
  weeklyTarget,
}: VaultIdentityProps) {
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

  // CTA
  let ctaLabel = '단어 둘러보기'
  let ctaHref = '/wordvault/browse'
  let ctaCount = 0
  let ctaTone: 'critical' | 'warning' | 'info' | 'neutral' = 'neutral'
  if (buckets.risk > 0) {
    ctaLabel = '지금 다시 만나기'
    ctaHref = `/wordvault/browse?filter=state:risk`
    ctaCount = buckets.risk
    ctaTone = 'critical'
  } else if (buckets.shaky > 0) {
    ctaLabel = '익숙해지는 단어 다지기'
    ctaHref = `/wordvault/browse?filter=state:shaky`
    ctaCount = buckets.shaky
    ctaTone = 'warning'
  } else if (buckets.new > 0) {
    ctaLabel = '새 단어 익히기'
    ctaHref = `/wordvault/browse?filter=state:new`
    ctaCount = buckets.new
    ctaTone = 'info'
  }

  return (
    <section
      aria-label="내 어휘 자산"
      className="rounded-[24px] bg-[var(--bg)] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] md:p-7"
    >
      {/* Hero row — Activity Ring + 거대한 숫자 + 메타 캡슐 */}
      <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
        {/* iOS Activity Ring */}
        <ActivityRing
          pct={goalPct}
          done={weeklyDone}
          target={weeklyTarget}
          reached={goalReached}
        />

        {/* 거대 hero 숫자 */}
        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-2.5">
            <span className="font-display text-[64px] font-[800] leading-[0.85] tracking-[-0.045em] tabular-nums text-[var(--t1)] md:text-[88px]">
              {NF.format(total)}
            </span>
            <span className="mb-2 font-body text-[14px] font-[500] text-[var(--t3)]">
              단어
            </span>
          </div>

          {/* 메타 캡슐 row — iOS Stats 스타일 */}
          <div className="flex flex-wrap items-center gap-2">
            {vLevel != null && (
              <Capsule
                label="수준"
                value={`V${vLevel}`}
                accent="brand"
              />
            )}
            <Capsule label="단어장" value={`${NF.format(collections)}권`} />
            <Capsule label="누적" value={`${NF.format(accumulatedDays)}일`} />
          </div>
        </div>
      </div>

      {/* 4 bucket 캡슐 row — iOS Health Categories 스타일 */}
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <BucketCell state="stable" count={buckets.stable} total={total} />
        <BucketCell state="shaky" count={buckets.shaky} total={total} />
        <BucketCell state="risk" count={buckets.risk} total={total} />
        <BucketCell state="new" count={buckets.new} total={total} />
      </div>

      {/* iOS Primary CTA — 캡슐 버튼 */}
      <Link
        href={ctaHref}
        className={`mt-5 flex w-full items-center justify-between rounded-[18px] px-5 py-4 font-display text-[15px] font-[600] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] active:scale-[0.98] ${
          ctaTone === 'critical'
            ? 'bg-[#FF453A] text-white shadow-[0_4px_16px_rgba(255,69,58,0.25)] hover:bg-[#FF3B30]'
            : ctaTone === 'warning'
              ? 'bg-[#FF9F0A] text-white shadow-[0_4px_16px_rgba(255,159,10,0.22)] hover:bg-[#FF9500]'
              : ctaTone === 'info'
                ? 'bg-[var(--p)] text-white shadow-[0_4px_16px_rgba(59,130,246,0.22)] hover:bg-[var(--p-hover)]'
                : 'bg-[var(--t1)] text-[var(--bg)] hover:bg-[var(--p)]'
        }`}
      >
        <span>{ctaLabel}</span>
        <span className="flex items-center gap-2">
          {ctaCount > 0 && (
            <span className="rounded-[var(--r-full)] bg-white/20 px-2.5 py-0.5 font-mono text-[12px] tabular-nums">
              {NF.format(ctaCount)}
            </span>
          )}
          <ArrowRight size={16} aria-hidden />
        </span>
      </Link>
    </section>
  )
}

// ─── iOS Activity Ring ──────────────────────────────────
function ActivityRing({
  pct,
  done,
  target,
  reached,
}: {
  pct: number
  done: number
  target: number
  reached: boolean
}) {
  const size = 140
  const stroke = 14
  const r = (size - stroke) / 2
  const cx = size / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(1, pct / 100))
  const ringColor = reached ? '#34C759' /* iOS green */ : 'var(--p)'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ringColor} stopOpacity="0.95" />
            <stop offset="100%" stopColor={ringColor} stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="var(--bg3)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Progress */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: `${cx}px ${cx}px`,
            transition: 'stroke-dashoffset 700ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </svg>
      {/* 중앙 텍스트 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0">
        <span className="font-mono text-[9px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
          이번 주
        </span>
        <span className="font-display text-[26px] font-[800] leading-none tracking-[-0.025em] tabular-nums text-[var(--t1)]">
          {done}
        </span>
        <span className="font-mono text-[10.5px] tabular-nums text-[var(--t3)]">
          / {target}
        </span>
      </div>
    </div>
  )
}

// ─── Capsule (iOS Stats 메타 칩) ──────────────────────────
function Capsule({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'brand'
}) {
  return (
    <div
      className={`inline-flex items-baseline gap-1.5 rounded-[var(--r-full)] px-3 py-1 ${
        accent === 'brand'
          ? 'bg-[var(--p-light)]'
          : 'bg-[var(--bg2)]'
      }`}
    >
      <span
        className={`font-mono text-[9.5px] font-[700] uppercase tracking-[0.14em] ${
          accent === 'brand' ? 'text-[var(--p-dark)]/80' : 'text-[var(--t3)]'
        }`}
      >
        {label}
      </span>
      <span
        className={`font-display text-[12.5px] font-[700] tabular-nums ${
          accent === 'brand' ? 'text-[var(--p-dark)]' : 'text-[var(--t1)]'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Bucket Cell (iOS Health Categories) ───────────────
function BucketCell({
  state,
  count,
  total,
}: {
  state: MemoryState
  count: number
  total: number
}) {
  const meta = BUCKET_META[state]
  const sharePct = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <div className="flex flex-col gap-2 rounded-[18px] bg-[var(--bg2)] p-3.5">
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-[8px] w-[8px] rounded-full"
          style={{ backgroundColor: meta.color, boxShadow: `0 0 0 3px ${meta.color}22` }}
        />
        <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-[var(--t3)]">
          {meta.label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className="font-display text-[26px] font-[800] leading-none tracking-[-0.03em] tabular-nums"
          style={{ color: meta.color }}
        >
          {NF.format(count)}
        </span>
        <span className="font-mono text-[10.5px] tabular-nums text-[var(--t3)]">
          {sharePct}%
        </span>
      </div>
    </div>
  )
}
