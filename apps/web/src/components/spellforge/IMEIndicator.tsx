// apps/web/src/components/spellforge/IMEIndicator.tsx

'use client'

import type { IMEStatus } from '@/types/spellforge'

interface IMEIndicatorProps {
  status: IMEStatus
}

export function IMEIndicator({ status }: IMEIndicatorProps) {
  const styles: Record<
    IMEStatus,
    { bg: string; bd: string; color: string; text: string; animate: boolean }
  > = {
    en: {
      bg: 'var(--success-light)',
      bd: 'rgba(34,197,94,0.3)',
      color: 'var(--success-ink)',
      text: 'EN',
      animate: false,
    },
    'ko-warning': {
      bg: 'var(--active-light)',
      bd: 'rgba(245,158,11,0.3)',
      color: 'var(--active-ink)',
      text: 'KO ⚠',
      animate: false,
    },
    'ko-error': {
      bg: 'var(--error-light)',
      bd: 'rgba(239,68,68,0.3)',
      color: 'var(--error-ink)',
      text: 'KO!',
      animate: true,
    },
  }

  const s = styles[status]

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`입력 모드: ${s.text}`}
      className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-[var(--r-full)] border px-2.5 py-1 font-mono text-[10px] font-[700] transition-all duration-[var(--dur-normal)] ${s.animate ? 'animate-[ime-shake_400ms_ease]' : ''} `}
      style={{
        background: s.bg,
        borderColor: s.bd,
        color: s.color,
      }}
    >
      <span
        className="h-[5px] w-[5px] rounded-full"
        style={{ background: s.color }}
        aria-hidden="true"
      />
      <span>{s.text}</span>
    </div>
  )
}
