// apps/web/src/components/wordvault/hub/VaultIdentity.tsx
//
// WordVault Section 1 (v06.36) — Activity Ring + 거대한 hero + 캡슐 메타.
// iOS Foundation 프리미티브 사용 (Card / Capsule / ActivityRing / PrimaryButton / StatPill).

'use client'

import { useEffect, useState } from 'react'

import { ActivityRing, Capsule, Card, PrimaryButton, StatPill } from '@/components/ui/ios'
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

// 4 메모리 상태 색 = iOS systemColor 1:1 (--memory-{stable/shaky/risk/new} 토큰과 정합)
// 학습 효과 — 의미별 명확 매핑 (green=달성, orange=주의, red=회복, gray=중립)
const BUCKET_META: Record<
  MemoryState,
  { label: string; color: string; accent: 'green' | 'orange' | 'red' | 'neutral' }
> = {
  stable: { label: '확실', color: 'var(--memory-stable)', accent: 'green' },
  shaky: { label: '익숙', color: 'var(--memory-shaky)', accent: 'orange' },
  risk: { label: '회복', color: 'var(--memory-risk)', accent: 'red' },
  new: { label: '신규', color: 'var(--memory-new)', accent: 'neutral' },
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
  let ctaTone: 'critical' | 'warning' | 'info' | 'brand' | 'neutral' = 'neutral'
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
    // Reading Room navy 정합 — info(ios-blue) → brand(var(--p))
    ctaTone = 'brand'
  }

  return (
    <Card aria-label="내 어휘 자산" size="lg">
      {/* Hero row */}
      <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
        <ActivityRing
          pct={goalPct}
          reached={goalReached}
          capLabel="이번 주"
          centerValue={weeklyDone}
          centerSub={`/ ${weeklyTarget}`}
          ariaLabel={`이번 주 ${weeklyDone} / ${weeklyTarget}`}
        />

        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-2.5">
            <span className="font-editorial text-[72px] font-[500] leading-[0.95] tracking-[-0.022em] tabular-nums text-[var(--t1)] md:text-[96px]">
              {NF.format(total)}
            </span>
            <span className="mb-2 font-body text-[14px] font-[500] text-[var(--t3)]">
              단어
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {vLevel != null && (
              <Capsule label="수준" value={`V${vLevel}`} tone="brand" />
            )}
            <Capsule label="단어장" value={`${NF.format(collections)}권`} />
            <Capsule label="누적" value={`${NF.format(accumulatedDays)}일`} />
          </div>
        </div>
      </div>

      {/* 4 bucket — iOS Health Categories */}
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {(['stable', 'shaky', 'risk', 'new'] as MemoryState[]).map((state) => {
          const meta = BUCKET_META[state]
          const count = buckets[state]
          const sharePct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <StatPill
              key={state}
              label={meta.label}
              value={NF.format(count)}
              ratio={`${sharePct}%`}
              accent={meta.accent}
              dotColor={meta.color}
            />
          )
        })}
      </div>

      {/* iOS Primary CTA */}
      <PrimaryButton
        href={ctaHref}
        tone={ctaTone}
        count={ctaCount}
        className="mt-5"
      >
        {ctaLabel}
      </PrimaryButton>
    </Card>
  )
}
