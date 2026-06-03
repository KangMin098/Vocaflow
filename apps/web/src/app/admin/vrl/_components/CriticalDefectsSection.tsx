// apps/web/src/app/admin/vrl/_components/CriticalDefectsSection.tsx
//
// Section 4 — Critical Defects 자동 탐지 결과 (P0/P1/P2 그룹별 표시).
//
// 구성:
//   - 헤더: 결함 총수 + P0/P1/P2 분포 + severity 분포 + R1-R4 영향
//   - P0 group (red) — critical, 최우선
//   - P1 group (amber) — warning
//   - P2 group (blue) — info

import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import type { CriticalDefect } from '@/lib/admin/dict/types'
import { summarizeDefects } from '@/lib/admin/dict/critical-defects-detector'
import { DefectCard } from './DefectCard'

interface CriticalDefectsSectionProps {
  defects: CriticalDefect[]
}

interface GroupConfig {
  priority: CriticalDefect['priority']
  label: string
  color: string
  bg: string
  icon: typeof AlertTriangle
}

const GROUPS: GroupConfig[] = [
  {
    priority: 'P0',
    label: 'P0 Critical — 즉시 정정',
    color: 'var(--error)',
    bg: 'var(--error-light)',
    icon: AlertTriangle,
  },
  {
    priority: 'P1',
    label: 'P1 Warning — 우선 개선',
    color: 'var(--active)',
    bg: 'var(--warning-light)',
    icon: AlertTriangle,
  },
  {
    priority: 'P2',
    label: 'P2 Info — 모니터링',
    color: 'var(--info)',
    bg: 'var(--info-light)',
    icon: Info,
  },
]

export function CriticalDefectsSection({ defects }: CriticalDefectsSectionProps) {
  const summary = summarizeDefects(defects)

  if (defects.length === 0) {
    return (
      <section
        className="flex items-center gap-2.5 rounded-[var(--r-xl)] border border-dashed border-[var(--success)]/40 bg-[var(--success-light)] p-5"
        aria-label="critical defects empty state"
      >
        <CheckCircle2 size={18} className="text-[var(--success)]" aria-hidden />
        <p className="font-display text-[13px] font-[600] text-[var(--success)]">
          Critical Defects 없음 — 자동 탐지 통과.
        </p>
      </section>
    )
  }

  return (
    <section aria-label="Critical Defects (15 rules)" className="flex flex-col gap-4">
      {/* ── 섹션 헤더 ── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)]"
            style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}
            aria-hidden
          >
            <AlertTriangle size={17} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-display text-[18px] font-[800] leading-tight text-[var(--t1)]">
              Critical Defects
            </h2>
            <p className="font-body text-[12px] text-[var(--t3)]">
              자동 탐지 — P0 {summary.byPriority.P0} · P1 {summary.byPriority.P1} · P2 {summary.byPriority.P2}
            </p>
          </div>
        </div>
        <ImpactSummary
          counts={summary.byResponsibility}
        />
      </header>

      {/* ── P0 / P1 / P2 그룹 ── */}
      {GROUPS.map((g) => {
        const items = defects.filter((d) => d.priority === g.priority)
        if (items.length === 0) return null
        const GIcon = g.icon
        return (
          <section
            key={g.priority}
            aria-label={`${g.priority} defects`}
            className="flex flex-col gap-2.5"
          >
            <header
              className="flex items-center gap-2 rounded-[var(--r-md)] px-3 py-1.5"
              style={{ backgroundColor: g.bg }}
            >
              <GIcon size={13} strokeWidth={2} style={{ color: g.color }} aria-hidden />
              <h3
                className="font-display text-[12px] font-[700]"
                style={{ color: g.color }}
              >
                {g.label}
              </h3>
              <span
                className="ml-auto rounded-full bg-[var(--bg)] px-2 py-0.5 font-mono text-[10px] font-[700]"
                style={{ color: g.color }}
              >
                {items.length}
              </span>
            </header>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((d) => (
                <DefectCard key={d.id} defect={d} />
              ))}
            </div>
          </section>
        )
      })}
    </section>
  )
}

function ImpactSummary({
  counts,
}: {
  counts: Record<'R1' | 'R2' | 'R3' | 'R4', number>
}) {
  const maxR = (Object.keys(counts) as Array<'R1' | 'R2' | 'R3' | 'R4'>).reduce(
    (m, k) => (counts[k] > counts[m] ? k : m),
    'R1' as 'R1' | 'R2' | 'R3' | 'R4',
  )
  const RESP_COLOR: Record<'R1' | 'R2' | 'R3' | 'R4', string> = {
    R1: 'var(--p)',
    R2: 'var(--success)',
    R3: 'var(--error)',
    R4: 'var(--active)',
  }
  return (
    <div
      className="flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2.5 py-1.5"
      aria-label="affects per responsibility"
    >
      <p className="font-mono text-[9px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
        affects
      </p>
      {(['R1', 'R2', 'R3', 'R4'] as const).map((r) => {
        const isMax = r === maxR && counts[r] > 0
        return (
          <span
            key={r}
            className={`inline-flex items-center gap-1 rounded-[var(--r-sm)] px-1.5 py-0.5 font-mono text-[10px] font-[700] ${
              isMax ? 'ring-1' : ''
            }`}
            style={{
              backgroundColor: 'var(--bg2)',
              color: RESP_COLOR[r],
              ...(isMax
                ? { boxShadow: `0 0 0 1px ${RESP_COLOR[r]}` }
                : {}),
            }}
          >
            {r}
            <span className="font-display font-[800]">{counts[r]}</span>
          </span>
        )
      })}
    </div>
  )
}
