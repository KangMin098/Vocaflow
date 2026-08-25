// apps/web/src/app/admin/vrl/_components/BacklogSection.tsx
//
// Section 8-A — Improvement Backlog.
//
// 17 items 그룹화 (P0/P1/P2/P3):
//   P0 (4) red — 즉시 정정 (B1 본질 페인 ring)
//   P1 (7) amber — 우선 개선 (M2 best ROI)
//   P2 (3) blue — 모니터링
//   P3 (3) gray — 미래 작업

import { AlertTriangle, CheckCircle2, Clock3, Info, ListTodo, Target } from 'lucide-react'
import type { DefectPriority } from '@/lib/admin/dict/types'
import { BACKLOG_ITEMS, summarizeBacklog } from './backlog-items'
import { BacklogItemCard } from './BacklogItemCard'

interface GroupConfig {
  priority: DefectPriority
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
    icon: Clock3,
  },
  {
    priority: 'P2',
    label: 'P2 Info — 모니터링',
    color: 'var(--info)',
    bg: 'var(--info-light)',
    icon: Info,
  },
  {
    priority: 'P3',
    label: 'P3 Future — 미래 작업',
    color: 'var(--t3)',
    bg: 'var(--bg3)',
    icon: Clock3,
  },
]

export function BacklogSection() {
  const summary = summarizeBacklog(BACKLOG_ITEMS)

  return (
    <section aria-label="Improvement Backlog" className="flex flex-col gap-4">
      {/* ── 섹션 헤더 ── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)]"
            style={{ backgroundColor: '#8B5CF61A', color: '#8B5CF6' }}
            aria-hidden
          >
            <ListTodo size={17} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-display text-[18px] font-[800] leading-tight text-[var(--t1)]">
              Improvement Backlog
            </h2>
            <p className="font-body text-[12px] text-[var(--t2)]">
              남은 {summary.total} · P0 {summary.byPriority.P0} · P1 {summary.byPriority.P1} ·
              P2 {summary.byPriority.P2} · P3 {summary.byPriority.P3} · 완료 {summary.done}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--t2)]">
          <span>affects:</span>
          <span className="rounded-[var(--r-sm)] bg-[var(--bg2)] px-2 py-1">
            R1 <strong className="text-[var(--p)]">{summary.byResponsibility.R1}</strong>
          </span>
          <span className="rounded-[var(--r-sm)] bg-[var(--bg2)] px-2 py-1">
            R2 <strong className="text-[var(--success)]">{summary.byResponsibility.R2}</strong>
          </span>
          <span className="rounded-[var(--r-sm)] bg-[var(--bg2)] px-2 py-1 ring-1 ring-[var(--error)]">
            R3 <strong className="text-[var(--error-ink)]">{summary.byResponsibility.R3}</strong>
          </span>
          <span className="rounded-[var(--r-sm)] bg-[var(--bg2)] px-2 py-1">
            R4 <strong className="text-[var(--active)]">{summary.byResponsibility.R4}</strong>
          </span>
        </div>
      </header>

      {/* ── 본질 페인 + Best ROI highlights ── */}
      {(summary.corePain || summary.bestRoi) && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {summary.corePain && (
            <div
              className="flex items-start gap-2 rounded-[var(--r-md)] border-l-[3px] border-l-[var(--error)] border border-[var(--bd)] bg-[var(--error-light)] p-3"
              role="alert"
            >
              <Target
                size={14}
                strokeWidth={2}
                className="mt-0.5 shrink-0 text-[var(--error-ink)]"
                aria-hidden
              />
              <div>
                <p className="font-mono text-[9px] font-[700] uppercase tracking-[0.06em] text-[var(--error-ink)]">
                  본질 페인
                </p>
                <p className="mt-0.5 font-display text-[12px] font-[700] text-[var(--t1)]">
                  {summary.corePain.id} — {summary.corePain.title}
                </p>
                <p className="font-mono text-[10px] text-[var(--t2)]">
                  {summary.corePain.value}
                </p>
              </div>
            </div>
          )}
          {summary.bestRoi && (
            <div className="flex items-start gap-2 rounded-[var(--r-md)] border-l-[3px] border-l-[var(--success)] border border-[var(--bd)] bg-[var(--success-light)] p-3">
              <span
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-white"
                aria-hidden
              >
                <span className="text-[10px] font-[800]">!</span>
              </span>
              <div>
                <p className="font-mono text-[9px] font-[700] uppercase tracking-[0.06em] text-[var(--success)]">
                  Best ROI
                </p>
                <p className="mt-0.5 font-display text-[12px] font-[700] text-[var(--t1)]">
                  {summary.bestRoi.id} — {summary.bestRoi.title}
                </p>
                <p className="font-mono text-[10px] text-[var(--t2)]">
                  {summary.bestRoi.effort} · {summary.bestRoi.value}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── P0/P1/P2/P3 그룹 (미완료만) ── */}
      {GROUPS.map((g) => {
        const items = BACKLOG_ITEMS.filter(
          (it) => it.priority === g.priority && it.status !== 'done',
        )
        if (items.length === 0) return null
        const GIcon = g.icon
        return (
          <section
            key={g.priority}
            aria-label={`${g.priority} items`}
            className="flex flex-col gap-3"
          >
            <header
              className="flex items-center gap-2 rounded-[var(--r-md)] px-3 py-2"
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
                className="ml-auto rounded-full bg-[var(--bg)] px-2 py-1 font-mono text-[10px] font-[700]"
                style={{ color: g.color }}
              >
                {items.length}
              </span>
            </header>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map((it) => (
                <BacklogItemCard key={it.id} item={it} />
              ))}
            </div>
          </section>
        )
      })}

      {/* ── 완료 그룹 ── */}
      {summary.done > 0 && (
        <section aria-label="완료 items" className="flex flex-col gap-3">
          <header className="flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--success-light)] px-3 py-2">
            <CheckCircle2
              size={13}
              strokeWidth={2}
              className="text-[var(--success)]"
              aria-hidden
            />
            <h3 className="font-display text-[12px] font-[700] text-[var(--success)]">
              완료 — 실측으로 종결 확인
            </h3>
            <span className="ml-auto rounded-full bg-[var(--bg)] px-2 py-1 font-mono text-[10px] font-[700] text-[var(--success)]">
              {summary.done}
            </span>
          </header>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {BACKLOG_ITEMS.filter((it) => it.status === 'done').map((it) => (
              <BacklogItemCard key={it.id} item={it} />
            ))}
          </div>
        </section>
      )}
    </section>
  )
}
