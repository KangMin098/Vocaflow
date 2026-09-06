// apps/web/src/components/admin/vcb/preview/VcbPreviewHero.tsx

import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type {
  SeedPreviewItem,
  SeedPreviewSpec,
  SeedPreviewValidation,
} from '@/lib/vcb/server/seed'
import { VcbCefrDistributionBar } from './VcbCefrDistributionBar'

interface Props {
  items: SeedPreviewItem[]
  spec: SeedPreviewSpec
  validation: SeedPreviewValidation
}

function confidenceColor(avg: number): { bg: string; fg: string; label: string } {
  if (avg >= 0.85) return { bg: 'var(--success-light)', fg: 'var(--success)', label: '높음' }
  if (avg >= 0.70) return { bg: 'var(--warning-light)', fg: 'var(--warning)', label: '보통' }
  return { bg: 'var(--error-light)', fg: 'var(--error)', label: '낮음' }
}

function targetCefrCoverage(items: SeedPreviewItem[], specCefr: string[]): number {
  if (items.length === 0 || specCefr.length === 0) return 0
  const set = new Set(specCefr)
  const inRange = items.filter((it) => set.has(it.cefr_estimate)).length
  return inRange / items.length
}

export function VcbPreviewHero({ items, spec, validation }: Props) {
  const total = items.length
  const target = spec.target_count ?? null
  const targetRatio = target ? total / target : null

  const confAvg =
    validation.confidence_avg ??
    (items.length > 0
      ? items.reduce((s, x) => s + x.confidence, 0) / items.length
      : 0)
  const confStyle = confidenceColor(confAvg)

  const cefrCoverage = targetCefrCoverage(items, spec.target_cefr_range)

  // Compute distribution for the bar (from items, not validation, to be source-of-truth)
  const distribution: Record<string, number> = {
    A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0,
  }
  for (const it of items) {
    if (it.cefr_estimate in distribution) distribution[it.cefr_estimate]!++
  }

  return (
    <section
      className="rounded-[var(--r-lg)] border overflow-hidden"
      style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
    >
      <div className="grid grid-cols-3 gap-px" style={{ background: 'var(--bd)' }}>
        {/* Card 1: 총 / 목표 */}
        <div className="p-5" style={{ background: 'var(--bg)' }}>
          <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--t3)' }}>
            총 단어
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="font-display font-[800] leading-none"
              style={{ fontSize: '40px', color: 'var(--t1)' }}
            >
              {total.toLocaleString()}
            </span>
            {target !== null && (
              <span className="text-sm" style={{ color: 'var(--t3)' }}>
                / 목표 {target.toLocaleString()}
              </span>
            )}
          </div>
          {targetRatio !== null && (
            <div className="mt-3">
              <div
                className="h-1.5 rounded-[var(--r-full)] overflow-hidden"
                style={{ background: 'var(--bg3)' }}
              >
                <div
                  className="h-full rounded-[var(--r-full)] transition-all"
                  style={{
                    width: `${Math.min(150, targetRatio * 100)}%`,
                    background:
                      targetRatio >= 0.9 && targetRatio <= 1.2
                        ? 'var(--success)'
                        : targetRatio >= 0.7
                          ? 'var(--warning)'
                          : 'var(--error)',
                  }}
                />
              </div>
              <div className="mt-1 text-[11px]" style={{ color: 'var(--t3)' }}>
                {Math.round(targetRatio * 100)}%
              </div>
            </div>
          )}
        </div>

        {/* Card 2: target_cefr coverage */}
        <div className="p-5" style={{ background: 'var(--bg)' }}>
          <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--t3)' }}>
            목표 CEFR 포함률
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="font-display font-[800] leading-none"
              style={{
                fontSize: '40px',
                color: cefrCoverage >= 0.95 ? 'var(--success)' : 'var(--t1)',
              }}
            >
              {Math.round(cefrCoverage * 100)}%
            </span>
            <span className="text-sm" style={{ color: 'var(--t3)' }}>
              {spec.target_cefr_range.join(', ') || '미설정'}
            </span>
          </div>
          <div className="mt-3 text-[11px]" style={{ color: 'var(--t3)' }}>
            {Math.round(cefrCoverage * total)}건 spec 내 / {total - Math.round(cefrCoverage * total)}건 spec 외
          </div>
        </div>

        {/* Card 3: confidence + validation inline */}
        <div className="p-5 relative" style={{ background: 'var(--bg)' }}>
          <div className="text-[11px] uppercase tracking-wider mb-2 flex items-center justify-between" style={{ color: 'var(--t3)' }}>
            <span>평균 신뢰도</span>
            <span className="flex items-center gap-1" title={validation.ok === false ? 'validation 실패' : 'validation 통과'}>
              {validation.ok === true ? (
                <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--success)' }} />
              ) : validation.ok === false ? (
                <AlertTriangle className="w-4 h-4" style={{ color: 'var(--error)' }} />
              ) : null}
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span
              className="font-display font-[800] leading-none"
              style={{ fontSize: '40px', color: confStyle.fg }}
            >
              {confAvg.toFixed(2)}
            </span>
            <span
              className="text-xs font-mono px-2 py-1 rounded-[var(--r-sm)]"
              style={{ background: confStyle.bg, color: confStyle.fg }}
            >
              {confStyle.label}
            </span>
          </div>
          {/* sparkline-ish bar */}
          <div className="mt-3 flex items-center gap-1" aria-hidden="true">
            {[0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((threshold) => {
              const filled = confAvg >= threshold
              return (
                <div
                  key={threshold}
                  className="flex-1 h-1.5 rounded-[var(--r-full)]"
                  style={{ background: filled ? confStyle.fg : 'var(--bg3)' }}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* CEFR Distribution Bar — spec-aware */}
      <div className="p-5 border-t" style={{ borderColor: 'var(--bd)', background: 'var(--bg2)' }}>
        <div className="text-[11px] uppercase tracking-wider mb-3" style={{ color: 'var(--t3)' }}>
          CEFR 분포
        </div>
        <VcbCefrDistributionBar
          distribution={distribution}
          total={total}
          specRange={spec.target_cefr_range}
        />
      </div>
    </section>
  )
}
