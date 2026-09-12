// apps/web/src/components/admin/vcb/VcbRunStatusBadge.tsx
// RunStatus 11종 → 라벨 + 색상. 인라인 Tailwind + var(--*) only.

import type { RunStatus } from '@/lib/vcb/types'

interface Props {
  status: RunStatus
  size?: 'sm' | 'md'
}

export const STATUS_LABELS: Record<RunStatus, string> = {
  created: '생성됨',
  ingesting: '수집 중',
  normalized: '정규화 완료',
  extracted: '추출 완료',
  looked_up: '사전 매칭 완료',
  enriching: '보강 중',
  qa: 'QA 검증 중',
  curating: '큐레이션 중',
  publishing: '발행 중',
  published: '발행됨',
  failed: '실패',
}

const STATUS_STYLE: Record<RunStatus, { color: string; bg: string; border: string }> = {
  created:    { color: 'var(--t3)',      bg: 'var(--bg2)',           border: 'var(--bd)' },
  ingesting:  { color: 'var(--info)',    bg: 'var(--info-light)',    border: 'var(--info)' },
  normalized: { color: 'var(--info)',    bg: 'var(--info-light)',    border: 'var(--info)' },
  extracted:  { color: 'var(--info)',    bg: 'var(--info-light)',    border: 'var(--info)' },
  looked_up:  { color: 'var(--info)',    bg: 'var(--info-light)',    border: 'var(--info)' },
  enriching:  { color: 'var(--p)',       bg: 'var(--p-light)',       border: 'var(--p)' },
  qa:         { color: 'var(--p)',       bg: 'var(--p-light)',       border: 'var(--p)' },
  curating:   { color: 'var(--warning)', bg: 'var(--warning-light)', border: 'var(--warning)' },
  publishing: { color: 'var(--p)',       bg: 'var(--p-light)',       border: 'var(--p)' },
  published:  { color: 'var(--success)', bg: 'var(--success-light)', border: 'var(--success)' },
  failed:     { color: 'var(--error)',   bg: 'var(--error-light)',   border: 'var(--error)' },
}

export function VcbRunStatusBadge({ status, size = 'md' }: Props) {
  const s = STATUS_STYLE[status]
  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-1' : 'text-xs px-3 py-1'

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-[var(--r-full)] font-display font-medium leading-none whitespace-nowrap border ${sizeClass}`}
      style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: 'currentColor' }}
        aria-hidden
      />
      {STATUS_LABELS[status]}
    </span>
  )
}
