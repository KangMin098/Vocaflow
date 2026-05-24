// apps/web/src/app/admin/vrl/_components/DistributionAnalysisSection.tsx
//
// Section 7-A — Distribution Analysis.
//
// 6 분포 차트 (SVG horizontal bars):
//   1. CEFR (A1-C2)           — 역피라미드 시각화
//   2. V-Level (L0-L11)       — 한국 학습자 V5-V7 peak
//   3. v_level_rule_v1 (L0-L11) — 원본 Day 3 분류 (Round 비교용)
//   4. Primary POS (noun dominant)
//   5. Frequency Band
//   6. Source
//
// 데이터: snapshot.raw.categorical (dict_categorical_distributions RPC)

import { BarChart3 } from 'lucide-react'
import type {
  DictCategoricalDistributions,
  DictHealthSnapshot,
} from '@/lib/admin/dict/types'

interface DistributionAnalysisSectionProps {
  snapshot: DictHealthSnapshot
}

interface ChartConfig {
  key: keyof Pick<
    DictCategoricalDistributions,
    | 'by_cefr_level'
    | 'by_v_level'
    | 'by_v_level_rule_v1'
    | 'by_primary_pos'
    | 'by_frequency_band'
    | 'by_source'
  >
  label: string
  description: string
  accent: string
  /** 표시할 최대 항목 수 (나머지는 합산하여 'others') */
  maxItems: number
  /** key 정렬 함수 (없으면 count 내림차순) */
  keyOrder?: (a: string, b: string) => number
}

const NUMERIC_KEY_ORDER = (a: string, b: string): number =>
  Number(a) - Number(b)

const CHARTS: ChartConfig[] = [
  {
    key: 'by_cefr_level',
    label: 'CEFR Distribution',
    description: '학습자 수준 — C2 56.2% (역피라미드, P2 결함)',
    accent: 'var(--p)',
    maxItems: 6,
    keyOrder: (a, b) =>
      ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(a) -
      ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(b),
  },
  {
    key: 'by_v_level',
    label: 'VRL V-Level (current)',
    description: '한국 학습자 12 단계 — V5-V7 peak',
    accent: '#8B5CF6',
    maxItems: 12,
    keyOrder: NUMERIC_KEY_ORDER,
  },
  {
    key: 'by_v_level_rule_v1',
    label: 'rule_v1 (Day 3 baseline)',
    description: 'Round 1-6 reclassification 비교 baseline',
    accent: 'var(--t3)',
    maxItems: 12,
    keyOrder: NUMERIC_KEY_ORDER,
  },
  {
    key: 'by_primary_pos',
    label: 'Primary POS',
    description: 'noun 66.1% dominant (P2 결함)',
    accent: 'var(--active)',
    maxItems: 7,
  },
  {
    key: 'by_frequency_band',
    label: 'Frequency Band',
    description: 'NGSL 31K — phrase/compound 포함',
    accent: 'var(--info)',
    maxItems: 8,
  },
  {
    key: 'by_source',
    label: 'Source',
    description: 'imported / ai-generated / kice-orphan',
    accent: 'var(--success)',
    maxItems: 5,
  },
]

export function DistributionAnalysisSection({
  snapshot,
}: DistributionAnalysisSectionProps) {
  const categorical = snapshot.raw.categorical
  const total = snapshot.raw.volume.total

  if (!categorical) {
    return (
      <section
        className="flex items-center gap-2.5 rounded-[var(--r-xl)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-5"
        aria-label="distribution analysis unavailable"
      >
        <BarChart3 size={18} className="text-[var(--t3)]" aria-hidden />
        <p className="font-body text-[12px] text-[var(--t2)]">
          dict_categorical_distributions RPC 결과 없음 — Distribution Analysis 표시 불가.
        </p>
      </section>
    )
  }

  return (
    <section aria-label="Distribution Analysis" className="flex flex-col gap-4">
      {/* ── 섹션 헤더 ── */}
      <header className="flex items-center gap-2.5">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)]"
          style={{ backgroundColor: '#8B5CF61A', color: '#8B5CF6' }}
          aria-hidden
        >
          <BarChart3 size={17} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-[18px] font-[800] leading-tight text-[var(--t1)]">
            Distribution Analysis
          </h2>
          <p className="font-body text-[12px] text-[var(--t3)]">
            6 차원 분포 — Critical Defects P2 evidence + 학습자 분포 통찰
          </p>
        </div>
      </header>

      {/* ── 6 charts grid ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {CHARTS.map((cfg) => (
          <DistributionChart
            key={cfg.key}
            cfg={cfg}
            data={categorical[cfg.key]}
            total={total}
          />
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// DistributionChart — 단일 SVG horizontal bar chart
// ─────────────────────────────────────────────────────────────

function DistributionChart({
  cfg,
  data,
  total,
}: {
  cfg: ChartConfig
  data: Record<string, number>
  total: number
}) {
  const sortedEntries = (() => {
    const entries = Object.entries(data)
    if (cfg.keyOrder) {
      return entries.sort(([a], [b]) => cfg.keyOrder!(a, b))
    }
    return entries.sort(([, a], [, b]) => b - a)
  })()

  // maxItems 초과 시 합산 → 'others'
  let display: Array<[string, number]> = sortedEntries
  if (sortedEntries.length > cfg.maxItems) {
    const head = sortedEntries.slice(0, cfg.maxItems - 1)
    const tail = sortedEntries.slice(cfg.maxItems - 1)
    const tailSum = tail.reduce((s, [, n]) => s + n, 0)
    display = [...head, ['others', tailSum]]
  }

  const maxCount = display.reduce((m, [, n]) => Math.max(m, n), 0)
  const sumCount = display.reduce((s, [, n]) => s + n, 0)

  return (
    <article
      className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]"
      aria-label={cfg.label}
    >
      <header>
        <h3 className="font-display text-[12px] font-[700] text-[var(--t1)]">
          {cfg.label}
        </h3>
        <p className="font-body text-[10px] text-[var(--t3)]">{cfg.description}</p>
      </header>

      <ul className="flex flex-col gap-1.5" aria-label={`${cfg.label} bars`}>
        {display.map(([k, n]) => {
          const pct = maxCount > 0 ? (n / maxCount) * 100 : 0
          const sharePct = sumCount > 0 ? ((n / sumCount) * 100).toFixed(1) : '0.0'
          return (
            <li
              key={k}
              className="grid grid-cols-[44px_1fr_auto] items-center gap-2 font-body text-[11px]"
            >
              <span className="truncate font-mono text-[10px] font-[700] text-[var(--t2)]">
                {k}
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--bg3)]">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max(2, pct)}%`,
                    backgroundColor: cfg.accent,
                  }}
                  aria-hidden
                />
              </div>
              <span className="font-mono text-[10px] tabular-nums text-[var(--t3)]">
                {n.toLocaleString()}
                <span className="ml-1 text-[var(--t4)]">({sharePct}%)</span>
              </span>
            </li>
          )
        })}
      </ul>

      <footer className="border-t border-[var(--bd)] pt-1.5 font-mono text-[9px] text-[var(--t3)]">
        sum: {sumCount.toLocaleString()} / total {total.toLocaleString()}
      </footer>
    </article>
  )
}
