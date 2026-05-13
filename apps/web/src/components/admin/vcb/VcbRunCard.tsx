import Link from 'next/link'
import { VcbRunStatusBadge } from './VcbRunStatusBadge'
import type { VcbRunSummary } from '@/lib/vcb/types'

const SEGMENT_LABELS: Record<string, string> = {
  middle_school: '중학',
  high_school: '고교',
  toeic: 'TOEIC',
  business: '비즈니스',
  academic: '학술',
  civil_service: '공무원',
  general: '범용',
}

function calcProgress(run: VcbRunSummary): number {
  if (run.seed_count === 0) return 0
  const done = run.enriched_count + run.failed_count
  return Math.round((done / run.seed_count) * 100)
}

export function VcbRunCard({ run }: { run: VcbRunSummary }) {
  const progress = calcProgress(run)
  const segmentLabel = run.target_segment
    ? SEGMENT_LABELS[run.target_segment] ?? run.target_segment
    : '미지정'

  return (
    <Link
      href={`/admin/vocab/runs/${run.id}`}
      className="block p-5 rounded-[var(--r-lg)] border transition-all hover:-translate-y-px no-underline"
      style={{
        background: 'var(--bg)',
        borderColor: 'var(--bd)',
        color: 'inherit',
      }}
    >
      <header className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-display font-semibold text-base m-0" style={{ color: 'var(--t1)' }}>
          {run.collection_title}
        </h3>
        <VcbRunStatusBadge status={run.status} size="sm" />
      </header>

      <p className="font-mono text-xs m-0 mb-4" style={{ color: 'var(--t3)' }}>
        {run.collection_slug}
      </p>

      <dl
        className="grid grid-cols-3 gap-3 m-0 py-3 border-t border-b"
        style={{ borderColor: 'var(--bd)' }}
      >
        <div>
          <dt className="text-[11px] mb-0.5" style={{ color: 'var(--t3)' }}>
            대상
          </dt>
          <dd className="font-display font-semibold text-sm m-0" style={{ color: 'var(--t1)' }}>
            {segmentLabel}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] mb-0.5" style={{ color: 'var(--t3)' }}>
            단어
          </dt>
          <dd className="font-display font-semibold text-sm m-0" style={{ color: 'var(--t1)' }}>
            {run.enriched_count.toLocaleString()} / {run.seed_count.toLocaleString()}
          </dd>
        </div>
        {run.flagged_count > 0 && (
          <div>
            <dt className="text-[11px] mb-0.5" style={{ color: 'var(--t3)' }}>
              플래그
            </dt>
            <dd
              className="font-display font-semibold text-sm m-0"
              style={{ color: 'var(--warning)' }}
            >
              {run.flagged_count}
            </dd>
          </div>
        )}
      </dl>

      <div
        className="h-1.5 rounded-[var(--r-full)] overflow-hidden mt-4"
        style={{ background: 'var(--bg2)' }}
      >
        <div
          className="h-full transition-all"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--p), var(--p-hover))',
          }}
        />
      </div>
      <p className="text-xs m-0 mt-2 text-right" style={{ color: 'var(--t3)' }}>
        {progress}% 완료
      </p>
    </Link>
  )
}
