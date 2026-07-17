// apps/web/src/app/admin/vrl/_components/BacklogItemCard.tsx
//
// BacklogSection 의 자식 카드.

import { CheckCircle2, Sparkles, Target } from 'lucide-react'
import type { ResponsibilityId } from '@/lib/admin/dict/types'
import type { BacklogItem } from './backlog-items'

interface BacklogItemCardProps {
  item: BacklogItem
}

const PRIORITY_COLOR: Record<BacklogItem['priority'], string> = {
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

export function BacklogItemCard({ item }: BacklogItemCardProps) {
  const isDone = item.status === 'done'
  const accent = isDone ? 'var(--success)' : PRIORITY_COLOR[item.priority]
  const ringClass = item.isCorePain && !isDone
    ? 'ring-2 ring-[var(--error)] shadow-[0_0_16px_rgba(239,68,68,0.18)]'
    : ''

  return (
    <article
      aria-label={`${item.id} ${item.title}`}
      className={`flex flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-3 shadow-[var(--sh-sm)] transition-shadow duration-[var(--dur-normal)] hover:shadow-[var(--sh-md)] ${ringClass} ${isDone ? 'opacity-75' : ''}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex rounded-full px-1.5 py-0.5 font-display text-[9px] font-[800] text-white"
            style={{ backgroundColor: accent }}
          >
            {item.priority}
          </span>
          <span
            className="font-display text-[12px] font-[800]"
            style={{ color: accent }}
          >
            {item.id}
          </span>
          {item.schemaTier && (
            <span className="rounded-[var(--r-sm)] bg-[var(--bg2)] px-1.5 py-0.5 font-mono text-[9px] font-[700] text-[var(--t3)]">
              Tier {item.schemaTier}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isDone && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-[var(--success-light)] px-1.5 py-0.5 font-display text-[9px] font-[700] text-[var(--success)]"
              aria-label="완료"
            >
              <CheckCircle2 size={9} strokeWidth={2} aria-hidden />
              완료
            </span>
          )}
          {item.isBestRoi && !isDone && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-[var(--success-light)] px-1.5 py-0.5 font-display text-[9px] font-[700] text-[var(--success)]"
              aria-label="best ROI"
              title="Best ROI — 비용 대비 효과 우수"
            >
              <Sparkles size={9} strokeWidth={2} aria-hidden />
              best ROI
            </span>
          )}
          {item.isCorePain && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-[var(--error-light)] px-1.5 py-0.5 font-display text-[9px] font-[700] text-[var(--error)]"
              aria-label="core pain"
              title="본질 페인"
            >
              <Target size={9} strokeWidth={2} aria-hidden />
              본질 페인
            </span>
          )}
        </div>
      </header>

      <h3 className="font-display text-[13px] font-[700] leading-snug text-[var(--t1)]">
        {item.title}
      </h3>

      <p className="font-body text-[11px] leading-snug text-[var(--t2)]">
        {item.oneLine}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {item.affects.map((r) => (
          <span
            key={r}
            className="inline-flex h-5 items-center justify-center rounded-[var(--r-sm)] px-1.5 font-mono text-[9px] font-[800] text-white"
            style={{ backgroundColor: RESP_COLOR[r] }}
          >
            {r}
          </span>
        ))}
        {item.defectId && (
          <span className="font-mono text-[9px] text-[var(--t3)]">
            ↳ {item.defectId}
          </span>
        )}
      </div>

      {isDone && item.doneNote ? (
        <p className="border-t border-[var(--bd)] pt-2 font-body text-[10px] leading-snug text-[var(--success)]">
          {item.doneNote}
        </p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 border-t border-[var(--bd)] pt-2 font-body text-[10px] text-[var(--t2)]">
          <dt className="font-mono text-[var(--t3)]">effort</dt>
          <dd>{item.effort}</dd>
          <dt className="font-mono text-[var(--t3)]">value</dt>
          <dd className="font-[600] text-[var(--t1)]">{item.value}</dd>
        </dl>
      )}
    </article>
  )
}
