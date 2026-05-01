// apps/web/src/components/flashcard/HonestyHint.tsx

'use client'

interface HonestyHintProps {
  visible: boolean
}

export function HonestyHint({ visible }: HonestyHintProps) {
  return (
    <p
      className={`mx-auto mt-3 w-full max-w-[540px] text-center font-body text-[11px] italic text-[var(--t3)] transition-opacity duration-[var(--dur-slow)] ${visible ? 'opacity-100' : 'opacity-0'} `}
      aria-hidden={!visible}
    >
      정직한 평가가 학습 효과를 높여요. 어려우면 어렵다고 표시해주세요.
    </p>
  )
}
