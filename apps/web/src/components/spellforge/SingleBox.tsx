// apps/web/src/components/spellforge/SingleBox.tsx

'use client'

interface SingleBoxProps {
  input: string
  showLength?: boolean
  targetLength?: number
  isSuccess?: boolean
  isError?: boolean
  revealValue?: string // 정답 노출 시
}

export function SingleBox({
  input,
  showLength,
  targetLength,
  isSuccess,
  isError,
  revealValue,
}: SingleBoxProps) {
  // 표시 문자열 결정
  const displayValue = revealValue !== undefined ? revealValue : '●'.repeat(input.length)

  let stateClass = 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)]'
  if (isSuccess) {
    stateClass = 'border-[var(--success)] bg-[var(--success-light)] text-[var(--success)]'
  } else if (isError) {
    stateClass = 'border-[var(--error)] bg-[var(--error-light)] text-[var(--error)]'
  }

  return (
    <div
      className={`flex h-[60px] w-full max-w-[480px] items-center justify-center rounded-[var(--r-md)] border-2 font-mono text-[28px] font-[700] lowercase tracking-[0.5em] transition-all duration-[var(--dur-normal)] ${stateClass} `}
      style={{
        minWidth: showLength && targetLength ? `${targetLength * 1.2}em` : undefined,
      }}
      role="textbox"
      aria-label="입력된 글자 (가려짐)"
    >
      {displayValue}
    </div>
  )
}
