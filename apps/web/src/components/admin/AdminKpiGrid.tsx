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
      {kpis.map((k) => {
        const Icon = k.icon
        return (
          <li
            key={k.label}
            className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]"
          >
            <div className="flex items-start justify-between">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)]"
                style={{ backgroundColor: k.bg, color: k.accent }}
                aria-hidden
              >
                <Icon size={14} strokeWidth={2} />
              </span>
              {k.delta && (
                <span
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-[700] tabular-nums"
                  style={{
                    color: k.delta.positive ? 'var(--success)' : 'var(--error)',
                  }}
                >
                  {k.delta.positive ? '▲' : '▼'} {Math.abs(k.delta.value)}
                  {k.delta.suffix ?? '%'}
                </span>
              )}
            </div>
            <p className="mt-3 font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
              {k.label}
            </p>
            <p className="mt-1 font-display text-[24px] font-[800] tabular-nums leading-none text-[var(--t1)]">
              {k.value}
            </p>
            {k.hint && <p className="mt-1.5 font-body text-[11px] text-[var(--t2)]">{k.hint}</p>}
          </li>
        )
      })}
    </ul>
  )
}
