// apps/web/src/app/admin/vrl/_components/SchemaEvolutionSection.tsx
//
// Section 6 — Schema Evolution.
//
// 구성:
//   - 진행 ring (6/16 = 37.5%) + Migration history badge
//   - Next 권장 Tier 부각
//   - 5 Tier 카드 (priority 순):
//     · Tier 1 Learning Core (audio/image/mnemonic) ✅
//     · Tier 2 Korean Learner Specific
//     · Tier 3 Vocab Network
//     · Tier 4 Meta Ops (partial)
//     · Tier 5 Content Extension
//   - 각 카드: progress + 컬럼 리스트 (✅/❌)

import { CheckCircle2, Network, XCircle } from 'lucide-react'
import type {
  DictHealthSnapshot,
  SchemaEvolutionTier,
} from '@/lib/admin/dict/types'
import { summarizeEvolution } from '@/lib/admin/dict/schema-evolution-suggestions'

interface SchemaEvolutionSectionProps {
  snapshot: DictHealthSnapshot
}

const TIER_COLOR: Record<number, { bg: string; fg: string; gradient: string }> = {
  1: {
    bg: 'var(--success-light)',
    fg: 'var(--success)',
    gradient: 'linear-gradient(135deg, var(--success) 0%, #16a34a 100%)',
  },
  2: {
    bg: 'var(--error-light)',
    fg: 'var(--error)',
    gradient: 'linear-gradient(135deg, var(--error) 0%, #b91c1c 100%)',
  },
  3: {
    bg: 'var(--info-light)',
    fg: 'var(--info)',
    gradient: 'linear-gradient(135deg, var(--info) 0%, #0891b2 100%)',
  },
  4: {
    bg: 'var(--warning-light)',
    fg: 'var(--active)',
    gradient: 'linear-gradient(135deg, var(--active) 0%, #d97706 100%)',
  },
  5: {
    bg: 'var(--bg3)',
    fg: 'var(--t2)',
    gradient: 'linear-gradient(135deg, var(--t3) 0%, var(--t2) 100%)',
  },
}

export function SchemaEvolutionSection({ snapshot }: SchemaEvolutionSectionProps) {
  const evolution = snapshot.evolution
  const dim = snapshot.dimensions.find((d) => d.id === 'schema_evolution')
  const summary = summarizeEvolution(evolution)
  const overallPct =
    summary.totalColumns > 0
      ? Math.round((summary.totalPresent / summary.totalColumns) * 100)
      : 0

  return (
    <section aria-label="Schema Evolution Plan" className="flex flex-col gap-4">
      {/* ── 섹션 헤더 ── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)]"
            style={{ backgroundColor: '#8B5CF61A', color: '#8B5CF6' }}
            aria-hidden
          >
            <Network size={17} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-display text-[18px] font-[800] leading-tight text-[var(--t1)]">
              Schema Evolution Plan
            </h2>
            <p className="font-body text-[12px] text-[var(--t3)]">
              Tier 1-5 확장 컬럼 — 사전DB 미래 자산 ({summary.totalColumns} columns)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 진행 ring */}
          <ProgressRing pct={overallPct} dimScore={dim?.score ?? 0} />
          {/* Next 권장 Tier */}
          {summary.nextRecommendedTier && (
            <div
              className="rounded-[var(--r-md)] border border-[var(--bd)] px-3 py-2"
              style={{ backgroundColor: TIER_COLOR[summary.nextRecommendedTier]?.bg }}
            >
              <p className="font-mono text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]">
                Next Tier
              </p>
              <p
                className="font-display text-[18px] font-[800] leading-none"
                style={{
                  color: TIER_COLOR[summary.nextRecommendedTier]?.fg,
                }}
              >
                Tier {summary.nextRecommendedTier}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* ── 5 Tier 카드 grid ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {evolution.map((t) => (
          <TierCard
            key={t.tier}
            tier={t}
            isNext={t.tier === summary.nextRecommendedTier}
          />
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// ProgressRing — SVG 도넛
// ─────────────────────────────────────────────────────────────

function ProgressRing({ pct, dimScore }: { pct: number; dimScore: number }) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct / 100)
  const color =
    dimScore >= 65
      ? 'var(--success)'
      : dimScore >= 40
        ? 'var(--active)'
        : 'var(--error)'

  return (
    <div className="flex items-center gap-2.5">
      <svg width="58" height="58" viewBox="0 0 58 58" aria-hidden>
        <circle
          cx="29"
          cy="29"
          r={radius}
          fill="none"
          stroke="var(--bg3)"
          strokeWidth="6"
        />
        <circle
          cx="29"
          cy="29"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 29 29)"
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
        <text
          x="29"
          y="34"
          textAnchor="middle"
          fontSize="14"
          fontWeight="800"
          fill={color}
          fontFamily="Plus Jakarta Sans, sans-serif"
        >
          {pct}%
        </text>
      </svg>
      <div>
        <p className="font-mono text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--t3)]">
          Schema dim
        </p>
        <p
          className="font-display text-[18px] font-[800] leading-none"
          style={{ color }}
        >
          {dimScore}
          <span className="ml-0.5 font-body text-[11px] font-[500] text-[var(--t3)]">
            /100
          </span>
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TierCard
// ─────────────────────────────────────────────────────────────

function TierCard({
  tier,
  isNext,
}: {
  tier: SchemaEvolutionTier
  isNext: boolean
}) {
  const color = TIER_COLOR[tier.tier] ?? TIER_COLOR[5]
  const present = tier.columns.filter((c) => c.present).length
  const total = tier.columns.length
  const pct = total > 0 ? Math.round((present / total) * 100) : 0
  const isComplete = present === total
  const ringClass =
    isNext && !isComplete
      ? 'ring-2 ring-[var(--error)] shadow-[0_0_16px_rgba(239,68,68,0.15)]'
      : ''

  return (
    <article
      aria-label={`Tier ${tier.tier} ${tier.label}`}
      className={`flex flex-col gap-2.5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)] transition-shadow duration-[var(--dur-normal)] hover:shadow-[var(--sh-md)] ${ringClass}`}
    >
      {/* ── 헤더 ── */}
      <header className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] font-display text-[14px] font-[800] text-white shadow-[var(--sh-sm)]"
            style={{ background: color.gradient }}
            aria-hidden
          >
            T{tier.tier}
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[13px] font-[700] leading-tight text-[var(--t1)]">
              {tier.label}
            </h3>
            <p className="mt-0.5 font-mono text-[9px] text-[var(--t3)]">
              priority {tier.priority}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className="font-display text-[18px] font-[800] leading-none"
            style={{ color: color.fg }}
          >
            {present}
            <span className="font-body text-[12px] font-[500] text-[var(--t3)]">
              {' / '}
              {total}
            </span>
          </p>
          {isNext && !isComplete && (
            <p className="mt-0.5 font-mono text-[9px] font-[700] uppercase tracking-[0.06em] text-[var(--error)]">
              next
            </p>
          )}
          {isComplete && (
            <p className="mt-0.5 font-mono text-[9px] font-[700] uppercase tracking-[0.06em] text-[var(--success)]">
              done
            </p>
          )}
        </div>
      </header>

      {/* ── progress bar ── */}
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg3)]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: color.gradient }}
          aria-hidden
        />
      </div>

      {/* ── rationale ── */}
      <p className="font-body text-[11px] leading-snug text-[var(--t2)]">
        {tier.rationale}
      </p>

      {/* ── 컬럼 리스트 ── */}
      <ul className="flex flex-col gap-1" aria-label="tier columns">
        {tier.columns.map((c) => (
          <li
            key={c.name}
            className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2 font-body text-[11px]"
          >
            {c.present ? (
              <CheckCircle2
                size={13}
                strokeWidth={2}
                className="text-[var(--success)]"
                aria-label="present"
              />
            ) : (
              <XCircle
                size={13}
                strokeWidth={2}
                className="text-[var(--t4)]"
                aria-label="absent"
              />
            )}
            <div className="min-w-0">
              <p className="truncate font-mono text-[11px] font-[600] text-[var(--t1)]">
                {c.name}
              </p>
              <p className="truncate font-body text-[10px] text-[var(--t3)]">
                {c.purpose}
              </p>
            </div>
            <span
              className="font-mono text-[9px] text-[var(--t3)]"
              aria-hidden
            >
              {c.type}
              {!c.nullable ? ' NOT NULL' : ''}
            </span>
          </li>
        ))}
      </ul>
    </article>
  )
}
