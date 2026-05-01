// apps/web/src/components/spellforge/InputSlots.tsx

'use client'

interface InputSlotsProps {
  target: string
  input: string
  mode: 'realtime' | 'delayed'
  isHintActive: boolean
  isSuccess: boolean
  onClick?: () => void
}

export function InputSlots({
  target,
  input,
  mode,
  isHintActive,
  isSuccess,
  onClick,
}: InputSlotsProps) {
  const chars = target.split('')

  return (
    <div
      onClick={onClick}
      className={`flex min-h-[60px] flex-wrap justify-center gap-1.5 ${isSuccess ? 'animate-[success-glow_500ms_ease]' : ''} `}
    >
      {chars.map((char, idx) => {
        const isSpace = char === ' '

        if (isSpace) {
          return <div key={idx} className="w-6 border-none bg-transparent" aria-hidden="true" />
        }

        const typedChar = input[idx]
        const isTyped = idx < input.length
        const isCurrent = idx === input.length

        // 표시할 문자 결정
        let displayChar = ''
        let className = `
          relative w-12 h-[60px]
          border-2 rounded-[var(--r-md)]
          flex items-center justify-center
          font-mono text-[28px] font-[700]
          lowercase
          transition-all duration-[var(--dur-fast)]
        `

        if (isHintActive && !isTyped) {
          // Active Hint: 정답 노출
          displayChar = char
          className += ' animate-[hint-flash_1500ms_ease_forwards]'
          className += ' bg-[var(--p-light)] border-[var(--p)] text-[var(--p)]'
        } else if (isTyped) {
          displayChar = typedChar

          if (mode === 'realtime') {
            // 즉시 평가
            if (typedChar === char.toLowerCase()) {
              className +=
                ' bg-[var(--slot-correct-bg)] border-[var(--slot-correct-bd)] text-[var(--slot-correct-text)]'
              className += ' animate-[correct-pop_300ms_cubic-bezier(.34,1.56,.64,1)]'
            } else {
              className +=
                ' bg-[var(--slot-error-bg)] border-[var(--slot-error-bd)] text-[var(--slot-error-text)]'
              className += ' animate-[error-shake_400ms_ease]'
            }
          } else {
            // delayed: 중성 표시
            className +=
              ' bg-[var(--slot-typed-bg)] border-[var(--slot-typed-bd)] text-[var(--slot-typed-text)]'
          }
        } else if (isCurrent) {
          // 현재 입력 슬롯
          className +=
            ' bg-[var(--slot-current-bg)] border-[var(--slot-current-bd)] text-[var(--slot-current-text)]'
          className += ' shadow-[var(--sh-input)]'
          className += ' animate-[cursor-blink_1.2s_ease-in-out_infinite]'
        } else {
          // 빈 슬롯
          className +=
            ' bg-[var(--slot-empty-bg)] border-[var(--slot-empty-bd)] text-[var(--slot-empty-text)]'
        }

        return (
          <div
            key={idx}
            className={className}
            aria-label={`글자 ${idx + 1}, ${isTyped ? `입력: ${typedChar}` : '비어있음'}`}
          >
            {displayChar}
            {isCurrent && !isHintActive && (
              <span
                className="absolute bottom-3 left-1/2 h-0.5 w-3/5 -translate-x-1/2 animate-[caret-blink_1s_ease-in-out_infinite] rounded-sm bg-[var(--p)]"
                aria-hidden="true"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
