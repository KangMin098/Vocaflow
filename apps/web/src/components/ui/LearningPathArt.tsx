// apps/web/src/components/ui/LearningPathArt.tsx
// 자체 벡터: 펼친 책·카드·연결선을 화면의 양옆에 배치하는 학습 소품.
export function LearningPathArt({ variant = 'books', className = '' }: { variant?: 'books' | 'cards' | 'growth' | 'calendar' | 'report'; className?: string }) {
  if (variant === 'growth' || variant === 'calendar' || variant === 'report') {
    return (
      <svg className={className} viewBox="0 0 280 240" fill="none" aria-hidden="true" focusable="false">
        <g stroke="var(--tint-lavender-ink)" strokeWidth="1.3" strokeLinejoin="round">
          <path d="m22 195 74-46 158 27-64 46Z" fill="var(--tint-pink)" />
          {variant === 'growth' ? <>
            <path d="M54 182v-36l40-16v36Zm48-18v-55l40-16v55Zm48-19V72l40-16v73Zm48-19V35l40-16v91Z" fill="var(--tint-green)" />
            <path d="m54 146 14 8 26-10m8-35 14 8 26-10m8-35 14 8 26-10m8-35 14 8 26-10M68 154v35m48-72v54m48-91v73m48-110v90" />
            <path d="M36 120C20 46 87 34 112 72s62 32 76-18" strokeDasharray="4 6" />
          </> : variant === 'calendar' ? <>
            <path d="m61 168 16-118 142 16-15 120Z" fill="var(--tint-peach)" />
            <path d="m77 50 142 16-4 29-142-17Z" fill="var(--tint-lavender)" />
            <path d="m103 39-4 28m85-19-4 28M87 112l103 13m-106 11 103 13m-106 11 103 13m-80-62-8 63m42-59-8 63m42-59-8 63" />
            <path d="m115 135 9 11 20-21" strokeWidth="3" />
            <circle cx="225" cy="157" r="22" fill="var(--tint-green)" />
            <path d="m215 156 8 9 13-16" />
          </> : <>
            <path d="m64 185 15-139 130 19-15 141Z" fill="var(--bg)" />
            <path d="m89 70 98 15m-101 9 64 10m-66 16 98 15m-101 7 98 15m-101 7 98 15" />
            <path d="m98 108 18 3-4 35-18-3Z" fill="var(--tint-green)" />
            <path d="m127 96 18 3-5 52-18-3Z" fill="var(--tint-peach)" />
            <path d="m158 77 18 3-8 76-18-3Z" fill="var(--tint-lavender)" />
            <circle cx="219" cy="78" r="26" fill="var(--tint-pink)" />
            <path d="m208 78 8 8 14-18" />
          </>}
          <circle cx="42" cy="78" r="5" fill="var(--tint-peach)" />
          <path d="m247 113 4 8 9 1-6 7 1 9-8-4-8 4 1-9-6-7 9-1Z" fill="var(--tint-lavender)" />
        </g>
      </svg>
    )
  }
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
