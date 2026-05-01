// apps/web/src/components/library/CEFRBadge.tsx

import type { CEFRLevel } from '@/types/library'

interface CEFRBadgeProps {
  level: CEFRLevel
  className?: string
}

const CEFR_STYLES: Record<CEFRLevel, { bg: string; text: string }> = {
  A1: { bg: 'var(--cefr-A1-bg)', text: 'var(--cefr-A1-text)' },
  A2: { bg: 'var(--cefr-A2-bg)', text: 'var(--cefr-A2-text)' },
  B1: { bg: 'var(--cefr-B1-bg)', text: 'var(--cefr-B1-text)' },
  B2: { bg: 'var(--cefr-B2-bg)', text: 'var(--cefr-B2-text)' },
  C1: { bg: 'var(--cefr-C1-bg)', text: 'var(--cefr-C1-text)' },
  C2: { bg: 'var(--cefr-C2-bg)', text: 'var(--cefr-C2-text)' },
}

export function CEFRBadge({ level, className = '' }: CEFRBadgeProps) {
  const style = CEFR_STYLES[level]
  return (
    <span
      className={`inline-flex h-[18px] min-w-[24px] items-center justify-center rounded-[3px] px-[5px] font-display text-[10px] font-[800] tracking-[0.02em] ${className} `}
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {level}
    </span>
  )
}
