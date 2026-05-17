// apps/web/src/components/admin/vcb/VcbPipelineGuide.tsx
// VCB Pipeline Guide — visual map of "where you are + what to do next".
// Server Component: receives precomputed step states, no client state.
// Pairs with PIPELINE_STEPS in lib/vcb/pipeline-steps.ts.

import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  DollarSign,
  Info,
  Loader2,
  PlayCircle,
  Shield,
  Sparkles,
  Wand2,
} from 'lucide-react'
import {
  PIPELINE_STEPS,
  type PipelineStep,
  type StepKind,
  type StepStatus,
  nextActionableStep,
  progressPercent,
} from '@/lib/vcb/pipeline-steps'

interface Props {
  runId: number
  collectionSlug: string
  statuses: Record<string, StepStatus>
}

const KIND_LABEL: Record<StepKind, string> = {
  generate: '생성',
  safety: '안전망',
  transform: '변환',
  enrich: '보강',
  review: '검토',
  publish: '발행',
}

const KIND_COLOR: Record<StepKind, string> = {
  generate: 'var(--p)',
  safety: 'var(--warning)',
  transform: 'var(--info)',
  enrich: 'var(--combo)',
  review: 'var(--active)',
  publish: 'var(--success)',
}

const STATUS_ICON: Record<StepStatus, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  done: CheckCircle2,
  'optional-done': CheckCircle2,
  'in-progress': Loader2,
  ready: PlayCircle,
  'optional-pending': Shield,
  'not-started': CircleDot,
  blocked: AlertTriangle,
}

const STATUS_LABEL: Record<StepStatus, string> = {
  done: '완료',
  'optional-done': '완료 (선택)',
  'in-progress': '진행 중',
  ready: '다음 실행',
  'optional-pending': '선택 (권장)',
  'not-started': '대기',
  blocked: '차단됨',
}

const STATUS_COLOR: Record<StepStatus, string> = {
  done: 'var(--success)',
  'optional-done': 'var(--success)',
  'in-progress': 'var(--info)',
  ready: 'var(--p)',
  'optional-pending': 'var(--warning)',
  'not-started': 'var(--t3)',
  blocked: 'var(--error)',
}

function isHighlighted(status: StepStatus): boolean {
  return status === 'ready' || status === 'in-progress'
}

function substituteSlug(text: string, slug: string, runId: number): string {
  return text.replace(/\{slug\}/g, slug).replace(/\<N\>/g, String(runId))
}

export function VcbPipelineGuide({ runId, collectionSlug, statuses }: Props) {
  const pct = progressPercent(statuses)
  const next = nextActionableStep(statuses)

  return (
    <section className="mb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3
            className="font-display font-semibold text-sm uppercase tracking-wider"
            style={{ color: 'var(--t2)' }}
          >
            VCB 파이프라인 가이드
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
            단계별 안내 — 잘못된 순서로 진행하지 않도록 현재 위치와 다음 액션을
            안내합니다.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div style={{ color: 'var(--t3)' }}>전체 진행</div>
          <div
            className="font-display font-semibold text-base"
            style={{ color: pct === 100 ? 'var(--success)' : 'var(--p)' }}
          >
            {pct}%
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-1.5 rounded-full mb-4 overflow-hidden"
        style={{ background: 'var(--bg3)' }}
      >
        <div
          className="h-full transition-[width] duration-500"
          style={{
            width: `${pct}%`,
            background:
              pct === 100 ? 'var(--success)' : 'var(--p)',
          }}
        />
      </div>

      {/* Next action callout */}
      {next && (
        <NextActionCallout
          step={next}
          runId={runId}
          collectionSlug={collectionSlug}
        />
      )}

      {pct === 100 && !next && (
        <div
          className="flex items-center gap-3 p-4 rounded-[var(--r-lg)] mb-4"
          style={{
            background: 'var(--success-light)',
            color: 'var(--success)',
          }}
        >
          <CheckCircle2 className="w-5 h-5" />
          <div className="font-display font-semibold">
            전체 파이프라인 완료 — published 상태
          </div>
        </div>
      )}

      {/* Timeline */}
      <ol className="relative pl-8 space-y-3">
        <span
          aria-hidden
          className="absolute top-0 left-3 w-[2px] h-full"
          style={{ background: 'var(--bd)' }}
        />
        {PIPELINE_STEPS.map((step) => (
          <StepCard
            key={step.id}
            step={step}
            status={statuses[step.id] ?? 'not-started'}
            runId={runId}
            collectionSlug={collectionSlug}
            highlight={isHighlighted(statuses[step.id] ?? 'not-started')}
          />
        ))}
      </ol>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Next-action callout (top banner)
// ─────────────────────────────────────────────────────────────────────────

function NextActionCallout({
  step,
  runId,
  collectionSlug,
}: {
  step: PipelineStep
  runId: number
  collectionSlug: string
}) {
  return (
    <div
      className="p-4 rounded-[var(--r-lg)] border-l-4 mb-4"
      style={{
        background: 'var(--p-light)',
        borderLeftColor: 'var(--p)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <PlayCircle className="w-4 h-4" style={{ color: 'var(--p)' }} />
        <span
          className="font-display font-semibold text-sm uppercase tracking-wider"
          style={{ color: 'var(--p)' }}
        >
          다음 실행 — Step {step.number}
        </span>
      </div>
      <div className="font-display font-semibold text-lg mb-1" style={{ color: 'var(--t1)' }}>
        {step.title}
      </div>
      <p className="text-sm mb-3" style={{ color: 'var(--t2)' }}>
        {step.oneLine}
      </p>
      {step.how[0] && (
        <HowItemRow
          item={step.how[0]}
          runId={runId}
          collectionSlug={collectionSlug}
          primary
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Step Card (timeline item)
// ─────────────────────────────────────────────────────────────────────────

function StepCard({
  step,
  status,
  runId,
  collectionSlug,
  highlight,
}: {
  step: PipelineStep
  status: StepStatus
  runId: number
  collectionSlug: string
  highlight: boolean
}) {
  const Icon = STATUS_ICON[status]
  const statusColor = STATUS_COLOR[status]
  const kindColor = KIND_COLOR[step.kind]

  return (
    <li
      className="relative rounded-[var(--r-lg)] border transition-shadow"
      style={{
        background: highlight ? 'var(--p-light)' : 'var(--bg)',
        borderColor: highlight ? 'var(--p)' : 'var(--bd)',
        boxShadow: highlight ? 'var(--sh-md)' : 'none',
      }}
    >
      {/* Status dot on timeline */}
      <span
        aria-hidden
        className="absolute -left-[1.4rem] top-4 w-6 h-6 rounded-full flex items-center justify-center"
        style={{ background: 'var(--bg)', border: `2px solid ${statusColor}` }}
      >
        <Icon
          className={`w-3.5 h-3.5 ${status === 'in-progress' ? 'animate-spin' : ''}`}
          style={{ color: statusColor }}
        />
      </span>

      <details open={highlight}>
        <summary
          className="flex items-center gap-3 p-4 cursor-pointer list-none rounded-[var(--r-lg)]"
          style={{ color: 'var(--t1)' }}
        >
          {/* Number badge */}
          <div
            className="w-12 h-8 rounded-[var(--r-md)] flex items-center justify-center font-display font-bold text-sm shrink-0"
            style={{
              background: `${kindColor}1a`,
              color: kindColor,
            }}
          >
            {step.number}
          </div>

          {/* Title + one-line */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display font-semibold text-base">
                {step.title}
              </span>
              <span
                className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-display font-semibold"
                style={{ background: `${kindColor}15`, color: kindColor }}
              >
                {KIND_LABEL[step.kind]}
              </span>
              {!step.required && (
                <span
                  className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-display font-semibold"
                  style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}
                >
                  선택
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>
              {step.oneLine}
            </div>
          </div>

          {/* Status pill + meta */}
          <div className="flex items-center gap-2 shrink-0">
            {step.timeEstimate && (
              <span
                className="text-[11px] flex items-center gap-1"
                style={{ color: 'var(--t3)' }}
              >
                <Clock className="w-3 h-3" />
                {step.timeEstimate}
              </span>
            )}
            <span
              className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full font-display font-semibold"
              style={{
                background: `${statusColor}1a`,
                color: statusColor,
              }}
            >
              {STATUS_LABEL[status]}
            </span>
            <ChevronRight
              className="w-4 h-4 transition-transform"
              style={{ color: 'var(--t3)' }}
            />
          </div>
        </summary>

        {/* Expanded details */}
        <div className="px-4 pb-4 pt-2 space-y-4 border-t" style={{ borderColor: 'var(--bd)' }}>
          {/* Why (safety steps) */}
          {step.why && (
            <div className="flex gap-2">
              <Info
                className="w-4 h-4 mt-0.5 shrink-0"
                style={{ color: 'var(--info)' }}
              />
              <div className="text-sm" style={{ color: 'var(--t2)' }}>
                <span className="font-semibold">왜 필요한가:</span> {step.why}
              </div>
            </div>
          )}

          {/* Prerequisites */}
          {step.prerequisites.length > 0 && (
            <Section title="사전 조건" icon={Shield} color="var(--t2)">
              <ul className="space-y-1">
                {step.prerequisites.map((p, i) => (
                  <li
                    key={i}
                    className="text-sm flex gap-2"
                    style={{ color: 'var(--t2)' }}
                  >
                    <span style={{ color: 'var(--t3)' }}>•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* How */}
          <Section title="실행 방법" icon={Wand2} color="var(--p)">
            <div className="space-y-2">
              {step.how.map((item, i) => (
                <HowItemRow
                  key={i}
                  item={item}
                  runId={runId}
                  collectionSlug={collectionSlug}
                  primary={i === 0}
                />
              ))}
            </div>
          </Section>

          {/* Verify */}
          {step.verify.length > 0 && (
            <Section title="완료 확인" icon={CheckCircle2} color="var(--success)">
              <ul className="space-y-1">
                {step.verify.map((v, i) => (
                  <li
                    key={i}
                    className="text-sm flex gap-2"
                    style={{ color: 'var(--t2)' }}
                  >
                    <span style={{ color: 'var(--success)' }}>✓</span>
                    <span>{substituteSlug(v, collectionSlug, runId)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Warnings */}
          {step.warnings.length > 0 && (
            <Section
              title="주의 / 흔한 실수"
              icon={AlertTriangle}
              color="var(--warning)"
            >
              <ul className="space-y-1">
                {step.warnings.map((w, i) => (
                  <li
                    key={i}
                    className="text-sm flex gap-2"
                    style={{ color: 'var(--t2)' }}
                  >
                    <span style={{ color: 'var(--warning)' }}>!</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--t3)' }}>
            {step.timeEstimate && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                예상 시간: {step.timeEstimate}
              </span>
            )}
            {step.costEstimate && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                예상 비용: {step.costEstimate}
              </span>
            )}
          </div>
        </div>
      </details>
    </li>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  color,
  children,
}: {
  title: string
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>
  color: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span
          className="text-[11px] uppercase tracking-wider font-display font-semibold"
          style={{ color }}
        >
          {title}
        </span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function HowItemRow({
  item,
  runId,
  collectionSlug,
  primary,
}: {
  item: {
    label: string
    type: 'slash' | 'pnpm' | 'admin' | 'editor' | 'manual'
    command?: string
    href?: string
    note?: string
  }
  runId: number
  collectionSlug: string
  primary?: boolean
}) {
  const cmd = item.command ? substituteSlug(item.command, collectionSlug, runId) : null
  const href = item.href
    ? item.href.replace('[run_id]', String(runId)).startsWith('/')
      ? item.href.replace('[run_id]', String(runId))
      : `/admin/vocab/runs/${runId}${item.href}`
    : null

  const typeColors: Record<string, { bg: string; fg: string }> = {
    slash: { bg: 'var(--p-light)', fg: 'var(--p)' },
    pnpm: { bg: 'var(--bg3)', fg: 'var(--t1)' },
    admin: { bg: 'var(--info-light)', fg: 'var(--info)' },
    editor: { bg: 'var(--bg3)', fg: 'var(--t2)' },
    manual: { bg: 'var(--bg3)', fg: 'var(--t2)' },
  }
  const tc = typeColors[item.type]

  return (
    <div
      className="rounded-[var(--r-md)] border p-2.5"
      style={{
        background: primary ? 'var(--bg)' : 'var(--bg2)',
        borderColor: primary ? 'var(--p)' : 'var(--bd)',
      }}
    >
      <div className="flex items-start gap-2 flex-wrap">
        <span
          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-display font-semibold shrink-0"
          style={{ background: tc.bg, color: tc.fg }}
        >
          {item.type}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-display font-medium" style={{ color: 'var(--t1)' }}>
            {item.label}
            {primary && <span className="ml-2 text-[11px]" style={{ color: 'var(--p)' }}>★ 권장</span>}
          </div>
          {cmd && (
            <code
              className="block mt-1 text-xs font-mono px-2 py-1 rounded select-all break-all"
              style={{ background: 'var(--bg3)', color: 'var(--t1)' }}
            >
              {cmd}
            </code>
          )}
          {href && (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs mt-1 font-display font-semibold"
              style={{ color: 'var(--p)' }}
            >
              {href} <ChevronRight className="w-3 h-3" />
            </Link>
          )}
          {item.note && (
            <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
              {item.note}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
