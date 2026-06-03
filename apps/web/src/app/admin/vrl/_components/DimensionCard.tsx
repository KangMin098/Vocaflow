// apps/web/src/app/admin/vrl/_components/DimensionCard.tsx
//
// 9 차원 개별 카드 — DimensionsGrid 의 자식.
// 각 차원: score (0-100) + status + bar + summary + weight.

import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  Database,
  GraduationCap,
  Layers,
  Network,
  Sparkles,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import type { DimensionId, DimensionScore } from '@/lib/admin/dict/types'

interface DimensionCardProps {
  dimension: DimensionScore
}

const DIMENSION_ICON: Record<DimensionId, LucideIcon> = {
  volume: Database,
  coverage: BarChart3,
  linguistic: BookOpen,
  learning: GraduationCap,
  vrl_classification: Layers,
  integrity: CheckCircle2,
  pipeline_fitness: Workflow,
  freshness: Clock3,
  schema_evolution: Network,
}

const STATUS_COLOR: Record<DimensionScore['status'], { fg: string; bg: string }> = {
  excellent: { fg: 'var(--success)', bg: 'var(--success-light)' },
  ok: { fg: 'var(--success)', bg: 'var(--success-light)' },
  warning: { fg: 'var(--active)', bg: 'var(--warning-light)' },
  critical: { fg: 'var(--error)', bg: 'var(--error-light)' },
}

const STATUS_ICON_DOT: Record<DimensionScore['status'], string> = {
  excellent: '🟢',
  ok: '🟢',
  warning: '🟡',
  critical: '🔴',
}

export function DimensionCard({ dimension: d }: DimensionCardProps) {
  const Icon = DIMENSION_ICON[d.id] ?? Sparkles
  const color = STATUS_COLOR[d.status]
  const weightPct = Math.round(d.weight * 100)

  return (
    <article
      aria-label={`${d.label} dimension card`}
      className="flex flex-col gap-2.5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)] transition-shadow duration-[var(--dur-normal)] hover:shadow-[var(--sh-md)]"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-md)]"
            style={{ backgroundColor: color.bg, color: color.fg }}
            aria-hidden
          >
            <Icon size={15} strokeWidth={1.75} />
          </span>
          <h3 className="font-display text-[13px] font-[700] text-[var(--t1)]">
            {d.label}
          </h3>
        </div>
        <span aria-hidden className="text-[12px]">
          {STATUS_ICON_DOT[d.status]}
        </span>
      </header>

      <div className="flex items-end gap-2">
        <p
          className="font-display text-[28px] font-[800] leading-none"
          style={{ color: color.fg }}
        >
          {d.score}
        </p>
        <p className="mb-0.5 font-body text-[10px] text-[var(--t3)]">/ 100</p>
        <p className="ml-auto mb-0.5 rounded-full bg-[var(--bg2)] px-1.5 py-0.5 font-mono text-[9px] font-[700] text-[var(--t3)]">
          w={weightPct}%
        </p>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg3)]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${Math.max(0, Math.min(100, d.score))}%`,
            backgroundColor: color.fg,
          }}
          aria-hidden
        />
      </div>

      <p className="font-body text-[11px] leading-snug text-[var(--t2)] line-clamp-2">
        {d.summary}
      </p>
    </article>
  )
}
