// apps/web/src/app/admin/vrl/_components/DefectCard.tsx
//
// CriticalDefect 공통 카드 — CriticalDefectsSection / PipelineImpactMatrix 의 자식.
//
// 구성:
//   - severity dot + priority pill + title
//   - description (1-2 line)
//   - metrics (current vs target)
//   - affects 책임 칩 (R1-R4)
//   - pipelines mention
//   - improvement (action / cost / effect / backlog_id)

import { AlertTriangle, Info, Workflow } from 'lucide-react'
import type {
  CriticalDefect,
  ResponsibilityId,
} from '@/lib/admin/dict/types'

interface DefectCardProps {
  defect: CriticalDefect
}

const SEVERITY_META: Record<
  CriticalDefect['severity'],
  { dot: string; bg: string; border: string; icon: typeof AlertTriangle }
> = {
  critical: {
    dot: 'var(--error)',
    bg: 'var(--error-light)',
    border: 'var(--error)',
    icon: AlertTriangle,
  },
  warning: {
    dot: 'var(--active)',
    bg: 'var(--warning-light)',
    border: 'var(--active)',
    icon: AlertTriangle,
  },
  info: {
    dot: 'var(--info)',
    bg: 'var(--info-light)',
    border: 'var(--info)',
    icon: Info,
  },
}

const PRIORITY_COLOR: Record<CriticalDefect['priority'], string> = {
  P0: 'var(--error)',
  P1: 'var(--active)',
  P2: 'var(--info)',
  P3: 'var(--t3)',
}

const RESP_COLOR: Record<ResponsibilityId, string> = {
  R1: 'var(--p)',
  R2: 'var(--success)',
  R3: 'var(--error)',
  R4: 'var(--active)',
}

export function DefectCard({ defect }: DefectCardProps) {
  const sev = SEVERITY_META[defect.severity]
  const SevIcon = sev.icon

  return (
    <article
      aria-label={`${defect.priority} ${defect.id} defect`}
      className="flex flex-col gap-3 rounded-[var(--r-lg)] border-l-[3px] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)] transition-shadow duration-[var(--dur-normal)] hover:shadow-[var(--sh-md)]"
      style={{ borderLeftColor: sev.border }}
    >
      {/* ── 헤더 ── */}
      <header className="flex items-start gap-3">
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-sm)]"
          style={{ backgroundColor: sev.bg, color: sev.dot }}
          aria-hidden
        >
          <SevIcon size={14} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex rounded-full px-2 py-1 font-display text-[9px] font-[800] text-white"
              style={{ backgroundColor: PRIORITY_COLOR[defect.priority] }}
            >
              {defect.priority}
            </span>
            <span className="font-mono text-[10px] text-[var(--t2)]">{defect.id}</span>
          </div>
          <h3 className="mt-0.5 font-display text-[13px] font-[700] leading-snug text-[var(--t1)]">
            {defect.title}
          </h3>
        </div>
      </header>

      {/* ── description ── */}
      {defect.description && (
        <p className="font-body text-[11px] leading-relaxed text-[var(--t2)]">
          {defect.description}
        </p>
      )}

      {/* ── metrics ── */}
      {defect.metrics && (
        <div
          className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3"
          aria-label="defect metric"
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-mono text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
              current vs target
            </p>
            {defect.metrics.target != null && (
              <p className="font-mono text-[10px] text-[var(--t2)]">
                → {defect.metrics.target}
                {defect.metrics.unit}
              </p>
            )}
          </div>
          <p
            className="font-display text-[20px] font-[800] leading-tight"
            style={{ color: sev.dot }}
          >
            {defect.metrics.current}
            <span className="ml-0.5 font-body text-[10px] font-[500] text-[var(--t2)]">
              {defect.metrics.unit}
            </span>
          </p>
        </div>
      )}

      {/* ── evidence ── */}
      <p className="font-mono text-[10px] leading-snug text-[var(--t2)]">
        {defect.evidence}
      </p>

      {/* ── affects + pipelines ── */}
      <div className="flex flex-wrap gap-2">
        {defect.impactsOn.map((r) => (
          <span
            key={r}
            className="inline-flex h-5 items-center justify-center rounded-[var(--r-sm)] px-2 font-mono text-[9px] font-[800] text-white"
            style={{ backgroundColor: RESP_COLOR[r] }}
            title={`Affects ${r}`}
          >
            {r}
          </span>
        ))}
        {defect.pipelines && defect.pipelines.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--bd)] bg-[var(--bg2)] px-2 py-1 font-mono text-[9px] text-[var(--t2)]">
            pipelines: {defect.pipelines.join(' · ')}
          </span>
        )}
      </div>

      {/* ── improvement ── */}
      {defect.improvement && (
        <section
          className="rounded-[var(--r-md)] border-l-[2px] p-3"
          style={{
            borderLeftColor: PRIORITY_COLOR[defect.priority],
            backgroundColor: sev.bg,
          }}
          aria-label="improvement plan"
        >
          <div className="flex items-center gap-2">
            <Workflow
              size={12}
              strokeWidth={2}
              style={{ color: PRIORITY_COLOR[defect.priority] }}
              aria-hidden
            />
            <h4 className="font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
              Improvement
            </h4>
            {defect.improvement.backlogId && (
              <span
                className="ml-1 rounded-full bg-[var(--bg)] px-2 py-1 font-mono text-[9px] font-[700]"
                style={{ color: PRIORITY_COLOR[defect.priority] }}
              >
                {defect.improvement.backlogId}
              </span>
            )}
          </div>
          <p className="mt-1 font-body text-[11px] font-[600] leading-snug text-[var(--t1)]">
            {defect.improvement.action}
          </p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-body text-[10px] text-[var(--t2)]">
            <dt className="font-mono text-[var(--t2)]">cost</dt>
            <dd>{defect.improvement.cost}</dd>
            <dt className="font-mono text-[var(--t2)]">effect</dt>
            <dd>{defect.improvement.effect}</dd>
          </dl>
        </section>
      )}
    </article>
  )
}
