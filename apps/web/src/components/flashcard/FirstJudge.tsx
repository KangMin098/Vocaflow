// apps/web/src/components/flashcard/FirstJudge.tsx

'use client'

interface FirstJudgeProps {
  visible: boolean
  onJudge: (answer: 'yes' | 'no') => void
}

export function FirstJudge({ visible, onJudge }: FirstJudgeProps) {
  return (
    <div
      className={`mt-4 flex w-full max-w-[540px] gap-2 transition-all duration-[var(--dur-slow)] ease-[var(--ease)] ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2.5 opacity-0'
      } `}
      aria-hidden={!visible}
    >
      <button
        onClick={() => onJudge('no')}
        className="flex flex-1 items-center justify-center gap-2 rounded-[var(--r-lg)] border border-[rgba(239,68,68,0.25)] bg-[var(--bg)] px-4 py-4 font-display text-[14px] font-[600] text-[var(--error-ink)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[var(--error)] hover:bg-[var(--error-light)] hover:shadow-[var(--sh-md)]"
      >
        <span className="text-[18px]">😅</span>
        <span>모르겠어요</span>
      </button>

      <button
        onClick={() => onJudge('yes')}
        className="flex flex-1 items-center justify-center gap-2 rounded-[var(--r-lg)] border border-[rgba(34,197,94,0.25)] bg-[var(--bg)] px-4 py-4 font-display text-[14px] font-[600] text-[var(--success)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[var(--success)] hover:bg-[var(--success-light)] hover:shadow-[var(--sh-md)]"
      >
        <span className="text-[18px]">💡</span>
        <span>떠올렸어요</span>
      </button>
    </div>
  )
}
