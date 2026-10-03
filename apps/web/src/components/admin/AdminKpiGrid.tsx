// apps/web/src/components/admin/AdminKpiGrid.tsx
// 관리자 KPI 카드 — admin/page.tsx 대시보드와 동일한 시각 언어

import type { LucideIcon } from 'lucide-react'

export interface AdminKpi {
  label: string
  value: string | number
  delta?: { value: number; positive: boolean; suffix?: string }
  icon: LucideIcon
  accent: string
  bg: string
  hint?: string
}

export interface AdminKpiGridProps {
  kpis: AdminKpi[]
  cols?: 2 | 3 | 4
}

export function AdminKpiGrid({ kpis, cols = 4 }: AdminKpiGridProps) {
  const colClass =
    cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'

  return (
    <ul className={`mb-6 grid grid-cols-1 gap-3 ${colClass}`}>
      {kpis.map((k, index) => {
        const Icon = k.icon
        const tone = ['lavender', 'green', 'peach', 'teal'][index % 4]
        return (
          <li
            key={k.label}
            className={`tone-${tone} rounded-[var(--r-2xl)] border border-[var(--bd)] p-5 text-[var(--t1)] sm:p-6`}
          >
            <div className="flex items-start justify-between">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-lg)]"
                style={{ backgroundColor: k.bg, color: k.accent }}
                aria-hidden
              >
                <Icon size={22} strokeWidth={1.5} />
              </span>
              {k.delta && (
                <span
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-[700] tabular-nums"
                  style={{
                    color: k.delta.positive ? 'var(--success-ink)' : 'var(--error-ink)',
                  }}
                >
                  {k.delta.positive ? '▲' : '▼'} {Math.abs(k.delta.value)}
                  {k.delta.suffix ?? '%'}
                </span>
              )}
            </div>
            <p className="mt-5 break-keep font-display text-[13px] font-[600]">
              {k.label}
            </p>
            <p className="mt-2 font-display text-[32px] font-[600] tabular-nums leading-none">
              {k.value}
            </p>
            {k.hint && <p className="mt-3 break-keep font-body text-[12px] leading-relaxed">{k.hint}</p>}
          </li>
        )
      })}
    </ul>
  )
}
