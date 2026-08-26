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
        className="flex items-center gap-3 rounded-[var(--r-xl)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-5"
        aria-label="distribution analysis unavailable"
      >
        <BarChart3 size={18} className="text-[var(--t2)]" aria-hidden />
        <p className="font-body text-[12px] text-[var(--t2)]">
          dict_categorical_distributions RPC 결과 없음 — Distribution Analysis 표시 불가.
        </p>
      </section>
    )
  }

  return (
    <section aria-label="Distribution Analysis" className="flex flex-col gap-4">
      {/* ── 섹션 헤더 ── */}
      <header className="flex items-center gap-3">
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
          <p className="font-body text-[12px] text-[var(--t2)]">
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
  /**
   * ⚠️ **`null` 이 올 수 있다.** 타입은 `Record<string, number>` 라고 말하지만 거짓말이었다.
   *
   * RPC 본문의 `jsonb_object_agg` 는 **그룹이 0행이면 SQL NULL** 을 돌려준다.
   * 그래서 다음 두 경우에 이 자리가 통째로 null 이 된다:
   *   ① 그 컬럼에 비-NULL 값이 하나도 없을 때 (정상적으로 가능하다)
   *   ② 호출자 역할이 RLS 로 0행을 보게 될 때 — **dev admin 우회가 정확히 이 경우다.**
   *      우회는 합성 admin 이라 실제 Supabase 세션이 없어 `anon` 으로 질의하는데,
   *      `shared_dictionary` 의 정책은 `authenticated`·`service_role` 뿐이고
   *      **`anon` 정책이 없다** → 7개 집계 전부 NULL.
   *
   * 2026-08-27 이전에는 이 크래시가 **숨어 있었다.** RPC 가 7회 전체 스캔이라 anon 의
   * `statement_timeout=3s` 를 넘겨 **항상 먼저 죽었고**, 상위 `!categorical` 가드가
   * 그것을 받아 빈 상태를 그렸다. RPC 를 1회 스캔으로 고쳐 성공하기 시작하자
   * `Object.entries(null)` 로 터졌다 — 성능 수정이 **가려져 있던 결함을 드러낸 것**이다.
   */
  data: Record<string, number> | null | undefined
  total: number
}) {
  const sortedEntries = (() => {
    // 없는 분포를 0개 항목으로 다룬다 — 화면 전체를 에러 경계로 떨어뜨리지 않는다.
    const entries = Object.entries(data ?? {})
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
        <p className="font-body text-[10px] text-[var(--t2)]">{cfg.description}</p>
      </header>

      {/*
        빈 차트를 **말없이** 그리지 않는다. 막대가 0개인 상자는 "분포가 균일하다" 로도
        "데이터가 없다" 로도 읽혀서, 관리자가 어느 쪽인지 알 수 없다.
        분포 자체가 없으면(= RPC 가 그 키에 null 을 준 경우) 그렇다고 적는다.
      */}
      {display.length === 0 ? (
        <p className="font-body text-[11px] text-[var(--t2)]">
          이 분포는 비어 있어요 — 해당 값을 가진 낱말이 없거나, 지금 계정 권한으로는 사전 행이
          보이지 않습니다.
        </p>
      ) : (
      <ul className="flex flex-col gap-2" aria-label={`${cfg.label} bars`}>
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
              <span className="font-mono text-[10px] tabular-nums text-[var(--t2)]">
                {n.toLocaleString()}
                <span className="ml-1 text-[var(--t2)]">({sharePct}%)</span>
              </span>
            </li>
          )
        })}
      </ul>
      )}

      <footer className="border-t border-[var(--bd)] pt-2 font-mono text-[9px] text-[var(--t2)]">
        sum: {sumCount.toLocaleString()} / total {total.toLocaleString()}
      </footer>
    </article>
  )
}
