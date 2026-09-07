// apps/web/src/app/admin/vrl/_components/HeroSection.tsx
//
// Section 1 — Overall Health Hero.
//
// 구성:
//   - 전체 점수 (큰 표시) + status 배지
//   - 4 책임 (R1-R4) inline 칩 — R3 critical 부각
//   - 핵심 차원 highlights (3개) — Pipeline Fitness / VRL Classification / Schema Evolution

import { Activity, AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react'
import type { DictHealthSnapshot, ResponsibilityId } from '@/lib/admin/dict/types'

interface HeroSectionProps {
  snapshot: DictHealthSnapshot
}

const RESP_COLOR: Record<ResponsibilityId, string> = {
  R1: 'var(--p)',
  R2: 'var(--success)',
  R3: 'var(--error)',
  R4: 'var(--active)',
}

const STATUS_BADGE: Record<
  DictHealthSnapshot['overallStatus'],
  { label: string; bg: string; fg: string; icon: typeof CheckCircle2 }
> = {
  excellent: {
    label: 'EXCELLENT',
    bg: 'var(--success-light)',
    fg: 'var(--success)',
    icon: CheckCircle2,
  },
  ok: {
    label: 'OK',
    bg: 'var(--success-light)',
    fg: 'var(--success)',
    icon: CheckCircle2,
  },
  warning: {
    label: 'WARNING',
    bg: 'var(--warning-light)',
    fg: 'var(--active)',
    icon: Clock3,
  },
  critical: {
    label: 'CRITICAL',
    bg: 'var(--error-light)',
    fg: 'var(--error)',
    icon: AlertTriangle,
  },
}

export function HeroSection({ snapshot }: HeroSectionProps) {
  const status = STATUS_BADGE[snapshot.overallStatus]
  const StatusIcon = status.icon

  // 핵심 차원 highlights — Pipeline Fitness (가중 20%) + VRL + Schema
  const pipeline = snapshot.dimensions.find((d) => d.id === 'pipeline_fitness')
  const vrl = snapshot.dimensions.find((d) => d.id === 'vrl_classification')
  const schema = snapshot.dimensions.find((d) => d.id === 'schema_evolution')

  const errorCount = snapshot.raw._errors?.length ?? 0

  return (
    <section
      aria-label="사전 데이터 품질 종합"
      className="from-[#8B5CF6]/8 relative overflow-hidden rounded-[var(--r-xl)] border border-[#8B5CF6]/20 bg-gradient-to-br via-[var(--bg)] to-[var(--bg)] p-6 shadow-[var(--sh-sm)]"
    >
      {/* ── 헤더 ── */}
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-md)] bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white shadow-[var(--sh-sm)]"
            aria-hidden
          >
            <Activity size={18} strokeWidth={1.75} />
          </span>
          <div>
            {/* ⚠️ 이 자리는 「Dictionary DB Health」 · 「사전DB 종합 모니터링 v3」 였다.
                그런데 메뉴에는 **다른 항목**이 「DB 헬스」(`/admin/db`)로 따로 있고, 그쪽은
                콘텐츠가 아니라 **그것을 담는 Postgres 자체**를 본다. 두 화면이 같은 이름을
                주장하면 관리자는 자기가 어디 있는지 알 방법이 없다 — 이름이 겹치는 것은
                취향 문제가 아니라 길을 잃게 만드는 결함이다.
                여기는 VRL 파이프라인(어휘 레벨)이 만든 **사전 데이터의 품질**을 본다.
                회귀 `components/admin/__tests__/sidebar-screen-titles.test.tsx`. */}
            <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.12em] text-[#8B5CF6]">
              VRL Pipeline
            </p>
            <h2 className="font-display text-[22px] font-[800] leading-tight text-[var(--t1)]">
              어휘 레벨 — 사전 데이터 품질
            </h2>
          </div>
        </div>

        {errorCount > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-[var(--warning-light)] px-2 py-1 font-mono text-[10px] font-[700] text-[var(--active)]"
            role="alert"
          >
            <AlertTriangle size={11} strokeWidth={2} aria-hidden />
            fetch errors: {errorCount}
          </span>
        )}
      </header>

      {/* ── Overall Score (큰 표시) ── */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--t2)]">
            Overall Health
          </p>
          <p
            className="font-display text-[64px] font-[800] leading-none"
            style={{ color: status.fg }}
          >
            {snapshot.overallScore}
            <span className="ml-1 font-body text-[18px] font-[500] text-[var(--t2)]">/ 100</span>
          </p>
        </div>
        <span
          className="mb-2 inline-flex items-center gap-1 rounded-full px-3 py-2 font-display text-[11px] font-[700]"
          style={{ backgroundColor: status.bg, color: status.fg }}
        >
          <StatusIcon size={13} strokeWidth={2} aria-hidden />
          {status.label}
        </span>
      </div>

      {/* ── Overall progress bar ── */}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg3)]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${Math.max(0, Math.min(100, snapshot.overallScore))}%`,
            backgroundColor: status.fg,
          }}
          aria-hidden
        />
      </div>

      {/* ── 4 Responsibilities inline chips ── */}
      <div
        className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4"
        aria-label="4 responsibilities summary"
      >
        {snapshot.responsibilities.map((r) => {
          const isMinScore =
            r.score === Math.min(...snapshot.responsibilities.map((rr) => rr.score))
          const accent = RESP_COLOR[r.id]
          return (
            <div
              key={r.id}
              className={`flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 transition-shadow duration-[var(--dur-normal)] ${
                isMinScore && r.status === 'critical'
                  ? 'shadow-[0_0_16px_rgba(239,68,68,0.18)] ring-2 ring-[var(--error)]'
                  : ''
              }`}
            >
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] font-mono text-[10px] font-[800] text-white"
                style={{ backgroundColor: accent }}
                aria-hidden
              >
                {r.id}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[11px] font-[600] text-[var(--t1)]">
                  {r.title.replace(/^R\d — /, '')}
                </p>
                <p
                  className="font-display text-[18px] font-[800] leading-none"
                  style={{ color: accent }}
                >
                  {r.score}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 핵심 차원 highlights ── */}
      <div
        className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3"
        aria-label="key dimension highlights"
      >
        {[pipeline, vrl, schema].filter(Boolean).map((d) => {
          if (!d) return null
          const accent =
            d.status === 'critical'
              ? 'var(--error)'
              : d.status === 'warning'
                ? 'var(--active)'
                : 'var(--success)'
          return (
            <div
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-mono text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
                  {d.label}
                </p>
                <p
                  className="font-display text-[20px] font-[800] leading-none"
                  style={{ color: accent }}
                >
                  {d.score}
                </p>
              </div>
              <div className="h-1.5 max-w-[80px] flex-1 overflow-hidden rounded-full bg-[var(--bg3)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, d.score))}%`,
                    backgroundColor: accent,
                  }}
                  aria-hidden
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* 장식: 우상단 광택 */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#8B5CF6]/10 blur-2xl"
        aria-hidden
      />
    </section>
  )
}
