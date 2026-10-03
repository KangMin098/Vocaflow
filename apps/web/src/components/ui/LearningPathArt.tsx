// apps/web/src/components/ui/LearningPathArt.tsx
// 자체 벡터: 펼친 책·카드·연결선을 화면의 양옆에 배치하는 학습 소품.
export function LearningPathArt({ variant = 'books', className = '' }: { variant?: 'books' | 'cards'; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 280 240" fill="none" aria-hidden="true" focusable="false">
      <g stroke="var(--tint-lavender-ink)" strokeWidth="1.3" strokeLinejoin="round">
        <path d="M24 185 89 88 201 109 145 205Z" fill="var(--tint-pink)" />
        <path d="m103 179 63-91 99 21-57 93Z" fill="var(--tint-green)" />
        {variant === 'books' ? <>
          <path d="m48 151 49-51 44 20 48-3-32 53-52-5Z" fill="var(--bg)" />
          <path d="m105 165 36-45M58 143l32-29m-22 35 30-26m45 9 26-2m-32 13 25-2" />
          <path d="m191 130 9-33 33 9-10 35Z" fill="var(--tint-peach)" />
        </> : <>
          <path d="m66 150 31-52 42 14-29 55Z" fill="var(--bg)" />
          <path d="m131 135 27-40 42 16-28 41Z" fill="var(--tint-lavender)" />
          <path d="m84 133 18-9 6 17-17 8Z" fill="var(--tint-teal)" />
          <path d="m155 119 11-8 7 10-12 8Z" fill="var(--tint-yellow)" />
        </>}
        <path d="M93 100C81 37 38 47 40 73m116 47c-2-63 49-100 74-56m-27 41c11-30 27-28 28-17" />
        <circle cx="40" cy="73" r="4" fill="var(--tint-peach)" />
        <path d="m223 49 6 9 11-1-5 10 5 10-11-1-7 9-3-11-11-4 10-6Z" fill="var(--tint-lavender)" />
        <path d="M18 112c-4-8 4-14 10-11 6-8 17-3 15 5 9 0 10 13 1 14H24c-5 0-8-3-6-8Z" fill="var(--tint-lavender)" />
        <path d="M184 212c-5-6 0-13 7-11 6-7 15-4 16 3 10-2 14 11 4 14h-21Z" fill="var(--bg)" />
        <circle cx="67" cy="58" r="3" fill="var(--tint-green)" />
        <circle cx="254" cy="164" r="4" fill="var(--tint-pink)" />
      </g>
    </svg>
  )
}
