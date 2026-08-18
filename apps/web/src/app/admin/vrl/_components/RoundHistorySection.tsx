// apps/web/src/app/admin/vrl/_components/RoundHistorySection.tsx
//
// Section 7-B — Round History.
//
// 6 Round 카드 (R1-R6) + 5 패턴 색상 매핑 + 잔여 Roadmap (R7-R10).
//
// 패턴 색상:
//   over-tagging        → amber (R1)
//   noisy bidirectional → gray  (R2)
//   under-promotion     → green up (R3)
//   over-leveling       → red down (R4 + R6)
//   strong under-leveling → purple up (R5)

import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  History,
  Minus,
} from 'lucide-react'
import type { DictHealthSnapshot } from '@/lib/admin/dict/types'

interface RoundHistorySectionProps {
  snapshot: DictHealthSnapshot
}

type RoundPattern =
  | 'over-tagging'
  | 'noisy'
  | 'under-promotion'
  | 'over-leveling'
  | 'strong-under-leveling'

interface RoundEntry {
  id: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6'
  ruleLevel: string
  rows: number
  retentionPct: number
  pattern: RoundPattern
  oneLine: string
  /** 주요 변화 방향 — up/down/mixed */
  direction: 'up' | 'down' | 'mixed' | 'flat'
}

const ROUNDS: RoundEntry[] = [
  {
    id: 'R1',
    ruleLevel: 'L7',
    rows: 3202,
    retentionPct: 38.65,
    pattern: 'over-tagging',
    oneLine: 'L7 over-tagging 하향 편향 확정',
    direction: 'down',
  },
  {
    id: 'R2',
    ruleLevel: 'L6',
    rows: 1933,
    retentionPct: 31.87,
    pattern: 'noisy',
    oneLine: 'L6 bidirectional noisy — 상향 26% / 하향 42%',
    direction: 'mixed',
  },
  {
    id: 'R3',
    ruleLevel: 'L5',
    rows: 965,
    retentionPct: 52.98,
    pattern: 'under-promotion',
    oneLine: 'L5 안정 band · under-promotion 39.18%',
    direction: 'up',
  },
  {
    id: 'R4',
    ruleLevel: 'L0/L1/L2',
    rows: 581,
    retentionPct: 99.14,
    pattern: 'over-leveling',
    oneLine: 'L0-L2 systematic over-leveling — 모두 V1-V2 권역',
    direction: 'down',
  },
  {
    id: 'R5',
    ruleLevel: 'L8',
    rows: 3254,
    retentionPct: 28.03,
    pattern: 'strong-under-leveling',
    oneLine: 'L8 strong under-leveling — V9-V10 상향 60.39%',
    direction: 'up',
  },
  {
    id: 'R6',
    ruleLevel: 'L3',
    rows: 895,
    retentionPct: 99.32,
    pattern: 'over-leveling',
    oneLine: 'L3 over-leveling — 거의 모두 V1-V2',
    direction: 'down',
  },
]

const PATTERN_META: Record<
  RoundPattern,
  { label: string; bg: string; fg: string; icon: typeof ArrowUp }
> = {
  'over-tagging': {
    label: 'over-tagging',
    bg: 'var(--warning-light)',
    fg: 'var(--active)',
    icon: ArrowDownRight,
  },
  noisy: {
    label: 'noisy bidirectional',
    bg: 'var(--bg3)',
    fg: 'var(--t2)',
    icon: Minus,
  },
  'under-promotion': {
    label: 'under-promotion',
    bg: 'var(--success-light)',
    fg: 'var(--success)',
    icon: ArrowUpRight,
  },
  'over-leveling': {
    label: 'over-leveling',
    bg: 'var(--error-light)',
    fg: 'var(--error)',
    icon: ArrowDown,
  },
  'strong-under-leveling': {
    label: 'strong under-leveling',
    bg: '#8B5CF61A',
    fg: '#8B5CF6',
    icon: ArrowUp,
  },
}

interface RoadmapEntry {
  id: string
  ruleLevel: string
  estimatedRows: number
  status: 'in_progress' | 'pending'
}

const ROADMAP: RoadmapEntry[] = [
  { id: 'R7', ruleLevel: 'L4', estimatedRows: 1030, status: 'in_progress' },
  { id: 'R8', ruleLevel: 'L9', estimatedRows: 9254, status: 'pending' },
  { id: 'R9', ruleLevel: 'L10', estimatedRows: 12149, status: 'pending' },
  { id: 'R10', ruleLevel: 'L11', estimatedRows: 5363, status: 'pending' },
]

export function RoundHistorySection({ snapshot }: RoundHistorySectionProps) {
  const v = snapshot.raw.vrlClassification
  const completedRows = ROUNDS.reduce((s, r) => s + r.rows, 0)
  const remainingRows = ROADMAP.reduce((s, r) => s + r.estimatedRows, 0)
  const totalEstimated = completedRows + remainingRows
  const progressPct = totalEstimated > 0 ? (completedRows / totalEstimated) * 100 : 0
  const classifiedRatioPct = v.classifiedRatio * 100

  return (
    <section aria-label="Round History (Day 3 reclassification)" className="flex flex-col gap-4">
      {/* ── 섹션 헤더 ── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)]"
            style={{ backgroundColor: '#8B5CF61A', color: '#8B5CF6' }}
            aria-hidden
          >
            <History size={17} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-display text-[18px] font-[800] leading-tight text-[var(--t1)]">
              Round History (rule_v1 → v_level reclassification)
            </h2>
            <p className="font-body text-[12px] text-[var(--t2)]">
              6 Rounds 완료 · 4 Rounds 잔여 — 5 패턴 매트릭스 (rule_v1 systematic noisy 확정)
            </p>
          </div>
        </div>
        <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 text-right">
          <p className="font-mono text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
            Classified
          </p>
          <p className="font-display text-[18px] font-[800] leading-none text-[var(--t1)]">
            {v.totalClassified.toLocaleString()}
            <span className="ml-1 font-body text-[11px] font-[500] text-[var(--t2)]">
              ({classifiedRatioPct.toFixed(1)}%)
            </span>
          </p>
        </div>
      </header>

      {/* ── 진행도 bar ── */}
      <div
        className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3"
        aria-label="overall reclassification progress"
      >
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <p className="font-mono text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
            Reclassification Progress
          </p>
          <p className="font-mono text-[10px] text-[var(--t2)]">
            {completedRows.toLocaleString()} / {totalEstimated.toLocaleString()} (
            {progressPct.toFixed(1)}%)
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg3)]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${progressPct}%`,
              background:
                'linear-gradient(90deg, var(--success) 0%, var(--info) 50%, #8B5CF6 100%)',
            }}
            aria-hidden
          />
        </div>
      </div>

      {/* ── 6 Round 카드 (완료) ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {ROUNDS.map((r) => (
          <RoundCard key={r.id} round={r} />
        ))}
      </div>

      {/* ── 잔여 Roadmap ── */}
      <section
        className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4"
        aria-label="remaining roadmap"
      >
        <h3 className="mb-2 font-display text-[12px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
          Remaining Roadmap (R7-R10)
        </h3>
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {ROADMAP.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-[12px] font-[800] text-[var(--t1)]">
                  {r.id}
                </span>
                <span
                  className="rounded-full px-1.5 py-0.5 font-mono text-[9px] font-[700]"
                  style={{
                    backgroundColor:
                      r.status === 'in_progress' ? 'var(--warning-light)' : 'var(--bg3)',
                    color:
                      r.status === 'in_progress' ? 'var(--active)' : 'var(--t3)',
                  }}
                >
                  {r.status === 'in_progress' ? '진행 중' : '대기'}
                </span>
              </div>
              <p className="font-mono text-[10px] text-[var(--t2)]">{r.ruleLevel}</p>
              <p className="font-mono text-[10px] text-[var(--t2)]">
                ~{r.estimatedRows.toLocaleString()} rows
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-2 font-body text-[10px] text-[var(--t2)]">
          잔여 estimated: {remainingRows.toLocaleString()} rows (
          {((remainingRows / totalEstimated) * 100).toFixed(1)}% of total)
        </p>
      </section>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// RoundCard — 단일 Round
// ─────────────────────────────────────────────────────────────

function RoundCard({ round }: { round: RoundEntry }) {
  const meta = PATTERN_META[round.pattern]
  const Icon = meta.icon

  return (
    <article
      className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-3 shadow-[var(--sh-sm)] transition-shadow duration-[var(--dur-normal)] hover:shadow-[var(--sh-md)]"
      aria-label={`${round.id} ${round.ruleLevel} ${meta.label}`}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-display text-[14px] font-[800] text-[var(--t1)]">
            {round.id}
          </span>
          <span className="font-mono text-[10px] font-[700] text-[var(--t2)]">
            rule {round.ruleLevel}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-[9px] font-[700]"
          style={{ backgroundColor: meta.bg, color: meta.fg }}
        >
          <Icon size={11} strokeWidth={2} aria-hidden />
          {meta.label}
        </span>
      </header>

      <div className="flex items-baseline gap-2">
        <p
          className="font-display text-[22px] font-[800] leading-none"
          style={{ color: meta.fg }}
        >
          {round.retentionPct.toFixed(1)}%
        </p>
        <p className="font-mono text-[10px] text-[var(--t2)]">retention</p>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg3)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(2, Math.min(100, round.retentionPct))}%`,
            backgroundColor: meta.fg,
          }}
          aria-hidden
        />
      </div>

      <p className="font-body text-[11px] leading-snug text-[var(--t2)]">
        {round.oneLine}
      </p>

      <p className="font-mono text-[9px] text-[var(--t2)]">
        {round.rows.toLocaleString()} rows
      </p>
    </article>
  )
}
