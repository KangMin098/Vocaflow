// apps/web/src/components/spellforge/ConfirmButton.tsx

'use client'

interface ConfirmButtonProps {
  visible: boolean
  disabled: boolean
  onClick: () => void
}

export function ConfirmButton({ visible, disabled, onClick }: ConfirmButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`mt-4 inline-flex cursor-pointer items-center gap-2 rounded-[var(--r-md)] border-none px-6 py-2.5 font-display text-[13px] font-[700] text-[var(--on-p)] shadow-[0_4px_12px_rgba(59,130,246,0.25)] transition-all duration-[var(--dur-normal)] ${
        visible
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none -translate-y-1 opacity-0'
      } ${
        disabled
          ? 'cursor-not-allowed !opacity-40'
          : 'hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(59,130,246,0.35)]'
      } `}
      style={{
        background: 'linear-gradient(135deg, var(--p) 0%, var(--p-dark) 100%)',
      }}
    >
      <span>정답 확인</span>
      <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] font-[700]">
        Enter
      </kbd>
    </button>
  )
}
