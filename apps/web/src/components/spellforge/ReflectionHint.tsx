// apps/web/src/components/spellforge/ReflectionHint.tsx

'use client'

interface ReflectionHintProps {
  visible: boolean
  message: string
}

export function ReflectionHint({ visible, message }: ReflectionHintProps) {
  if (!visible) return null

  return (
    <div
      role="status"
      className="mt-4 flex max-w-[480px] animate-[gentle-bounce_300ms_cubic-bezier(.34,1.56,.64,1)] items-center gap-3 rounded-[var(--r-md)] border border-l-[3px] border-[rgba(245,158,11,0.3)] border-l-[var(--active)] bg-[var(--bg)] px-4 py-4 font-english text-[13px] italic leading-snug text-[var(--t1)]"
    >
      <span className="flex-shrink-0 text-[20px]" aria-hidden="true">
        🤔
      </span>
      <span className="flex-1">{message}</span>
    </div>
  )
}
