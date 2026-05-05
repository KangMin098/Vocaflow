// apps/web/src/components/pairflip/PairFlipLogo.tsx
// Logo v2 — editorial: 네이비 본체 + 골드 액센트 (P, F)
// 호버 시 미세 letter rise

'use client'

const LETTERS: Array<{ ch: string; color: string; accent?: boolean }> = [
  { ch: 'P', color: '#F59E0B', accent: true }, // 골드
  { ch: 'a', color: '#1E1B4B' },
  { ch: 'i', color: '#1E1B4B' },
  { ch: 'r', color: '#1E1B4B' },
  { ch: 'F', color: '#F59E0B', accent: true }, // 골드
  { ch: 'l', color: '#1E1B4B' },
  { ch: 'i', color: '#1E1B4B' },
  { ch: 'p', color: '#1E1B4B' },
]

export function PairFlipLogo() {
  return (
    <div className="flex flex-col items-center gap-2">
      <h1
        className="group flex font-display font-[900] leading-none"
        style={{
          fontSize: 'clamp(44px, 11vw, 64px)',
          letterSpacing: '-0.03em',
          filter: 'drop-shadow(0 2px 0 rgba(245, 158, 11, 0.15))',
        }}
        aria-label="PairFlip"
      >
        {LETTERS.map((l, i) => (
          <span
            key={i}
            className="motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[var(--ease-spring)] motion-safe:group-hover:-translate-y-1.5"
            style={{
              color: l.color,
              transitionDelay: `${i * 35}ms`,
            }}
            aria-hidden="true"
          >
            {l.ch}
          </span>
        ))}
      </h1>
      <p
        className="font-body text-[13px] font-[500] tracking-[0.18em] uppercase"
        style={{ color: '#78350F', opacity: 0.6 }}
      >
        짝맞추기 · Pair Match
      </p>
    </div>
  )
}
