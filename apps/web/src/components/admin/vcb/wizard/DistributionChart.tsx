// apps/web/src/components/admin/vcb/wizard/DistributionChart.tsx
// V-Level 11-bar + CEFR 6-bar 분포 차트. fetch on filters change.

'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { distributionForFilters, type DistributionResult } from '@/lib/vcb/server/filter-actions'
import { ALL_V_LEVELS, ALL_CEFR } from '@/lib/vcb/filters'
import type { VocabFilters } from '@/lib/vcb/filters'

// Calm UI — saturation 낮춘 ramp (long-session fatigue 저감 · Stone 2010)
// 단계 구분은 유지하되 C1/C2 진한 보라 → 보라/인디고 라이트 보정
const CEFR_COLORS: Record<string, string> = {
  A1: '#A7F3D0', // emerald-200 (was #86EFAC)
  A2: '#6EE7B7', // emerald-300 (was #22C55E 풀 그린)
  B1: '#93C5FD', // blue-300 (was #3B82F6)
  B2: '#60A5FA', // blue-400 (was #1D4ED8 진청)
  C1: '#C4B5FD', // violet-300 (was #7C3AED)
  C2: '#A78BFA', // violet-400 (was #581C87 검보라)
}
const V_LEVEL_BAR = '#C4B5FD' // violet-300 — solid #8B5CF6 보다 1.5단 라이트

interface Props {
  filters: VocabFilters
}

export function DistributionChart({ filters }: Props) {
  const [dist, setDist] = useState<DistributionResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      const result = await distributionForFilters(filters)
      if (cancelled) return
      if (result.ok && result.data) setDist(result.data)
      setLoading(false)
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [filters])

  if (loading && !dist) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--t3)' }} />
      </div>
    )
  }

  if (!dist || dist.total === 0) {
    return (
      <div className="text-sm font-body py-6 text-center" style={{ color: 'var(--t3)' }}>
        분포 데이터 없음
      </div>
    )
  }

  const vMax = Math.max(...Object.values(dist.v_level), 1)
  const cefrMax = Math.max(...Object.values(dist.cefr), 1)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* V-Level 분포 */}
      <div>
        <h4 className="font-display font-medium text-sm mb-3" style={{ color: 'var(--t1)' }}>
          V-Level 분포
        </h4>
        <div className="flex items-end gap-1 h-32">
          {ALL_V_LEVELS.map((v) => {
            const count = dist.v_level[String(v)] ?? 0
            const heightPct = count === 0 ? 2 : (count / vMax) * 100
            return (
              <div key={v} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${heightPct}%`,
                    background: count === 0 ? 'var(--bg3)' : V_LEVEL_BAR,
                    opacity: count === 0 ? 0.4 : 1,
                  }}
                  aria-label={`V${v}: ${count}`}
                />
                <span className="text-[10px] font-mono" style={{ color: 'var(--t3)' }}>
                  {v}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* CEFR 분포 */}
      <div>
        <h4 className="font-display font-medium text-sm mb-3" style={{ color: 'var(--t1)' }}>
          CEFR 분포
        </h4>
        <div className="flex items-end gap-2 h-32">
          {ALL_CEFR.map((c) => {
            const count = dist.cefr[c] ?? 0
            const heightPct = count === 0 ? 2 : (count / cefrMax) * 100
            return (
              <div key={c} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[11px] font-mono" style={{ color: 'var(--t2)' }}>
                  {count > 0 ? count.toLocaleString() : ''}
                </div>
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${heightPct}%`,
                    background: count === 0 ? 'var(--bg3)' : CEFR_COLORS[c],
                    opacity: count === 0 ? 0.4 : 1,
                  }}
                  aria-label={`${c}: ${count}`}
                />
                <span className="text-[10px] font-mono" style={{ color: 'var(--t3)' }}>
                  {c}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
