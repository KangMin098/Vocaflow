// apps/web/src/app/admin/vrl/_components/RoundHistorySection.tsx
//
// Section 7-B — Round History.
//
// 6 Round 카드 (R1-R6) + 5 패턴 색상 매핑 + 잔여 Roadmap (R7-R10).
//
// ⚠️ 2026-09-05 — 이 섹션의 카드·로드맵은 **작업 기록(고정값)** 이다. DB 를 읽지 않는다.
//   그런데 진행률 막대가 그 고정값들을 합산해 `10,830 / 38,626 (28.0%)` 라고 그리고 있었다.
//   실측처럼 보이지만 재분류를 아무리 더 돌려도 이 막대는 영원히 28.0% 다.
//   지금은 막대를 `snapshot.raw.vrlClassification`(v_level 실측)에서 계산하고,
//   고정값 카드 그룹에는 **상시 보이는** 「기록(고정값)」 배지를 달아 둘을 갈라 놓는다.
//   (배지를 hover·tooltip 로 숨기면 안 된다 — 오해하는 순간에 안 보이면 아무 소용이 없다.)
// 패턴 색상:
//   over-tagging        → amber (R1)
//   noisy bidirectional → gray  (R2)
//   under-promotion     → green up (R3)
//   over-leveling       → red down (R4 + R6)
//   strong under-leveling → purple up (R5)

import {
  Archive,
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  History,
  Minus,
} from 'lucide-react'
import type { DictHealthSnapshot } from '@/lib/admin/dict/types'
import { reclassificationProgress } from '@/lib/admin/vrl/derive'

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

/** 고정값 구역임을 늘 보이게 하는 배지 — 실측 막대와 한 화면에 섞여 있어서 필수다. */
function RecordedBadge({ detail }: { detail: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-[var(--bd)] bg-[var(--bg3)] px-2 py-1 font-display text-[9px] font-[700] text-[var(--t2)]"
      title={detail}
    >
      <Archive size={10} strokeWidth={2} aria-hidden />
      기록(고정값)
    </span>
  )
}

export function RoundHistorySection({ snapshot }: RoundHistorySectionProps) {
  const v = snapshot.raw.vrlClassification
  // 진행률은 **DB 실측**에서만 나온다. 아래 ROUNDS/ROADMAP 합산은 근거가 아니다.
  const progress = reclassificationProgress(v)
  const classifiedRatioPct = v.classifiedRatio * 100
  const roadmapRows = ROADMAP.reduce((s, r) => s + r.estimatedRows, 0)

  return (
    <section aria-label="Round History (Day 3 reclassification)" className="flex flex-col gap-4">
      {/* ── 섹션 헤더 ── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
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

      {/* ── 진행도 bar — v_level 실측 (라운드 상수 합산 아님) ── */}
      <div
        className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3"
        aria-label="overall reclassification progress"
      >
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <p className="font-mono text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
            v_level 분류 진행 (실측)
          </p>
          <p className="font-mono text-[10px] text-[var(--t2)]">
            {progress.classified.toLocaleString()} / {progress.total.toLocaleString()} (
            {progress.pct.toFixed(1)}%)
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg3)]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(0, Math.min(100, progress.pct))}%`,
              background:
                'linear-gradient(90deg, var(--success) 0%, var(--info) 50%, #8B5CF6 100%)',
            }}
            aria-hidden
          />
        </div>
        <p className="mt-1.5 font-body text-[10px] text-[var(--t2)]">
          shared_dictionary 의 v_level NOT NULL 비율이다 — 아래 라운드 카드의 rows 합계와는
          다른 축이며, 미분류 {progress.unclassified.toLocaleString()}행이 남아 있다.
        </p>
      </div>

      {/* ── 6 Round 카드 (완료 · 작업 기록) ── */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-[12px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
            완료 라운드 R1-R6
          </h3>
          <RecordedBadge detail="Day 3 재분류 작업 당시 기록한 값 — DB 를 다시 읽지 않는다." />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {ROUNDS.map((r) => (
            <RoundCard key={r.id} round={r} />
          ))}
        </div>
      </div>

      {/* ── 잔여 Roadmap (계획값) ── */}
      <section
        className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4"
        aria-label="remaining roadmap"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="font-display text-[12px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
            Remaining Roadmap (R7-R10)
          </h3>
          <RecordedBadge detail="착수 시 추정한 계획값 — 진행률 막대의 근거가 아니다." />
        </div>
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {ROADMAP.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-[12px] font-[800] text-[var(--t1)]">
                  {r.id}
                </span>
                <span
                  className="rounded-full px-2 py-1 font-mono text-[9px] font-[700]"
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
          계획 당시 추정 합계 {roadmapRows.toLocaleString()} rows — 착수 시점의 추정이라
          현재 미분류 {progress.unclassified.toLocaleString()}행과 일치하지 않는다.
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
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-display text-[9px] font-[700]"
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
