// apps/web/src/app/(main)/hub-lab/LabBar.tsx
//
// 후보 전환 바 — 랩 전용. 본 화면에는 절대 나가지 않는 UI 다.
// 후보를 같은 계정·같은 뷰포트에서 한 클릭으로 갈아 끼워야 캡처 비교가 성립한다.

import Link from 'next/link'

interface LabBarProps {
  variants: { key: string; label: string; caption: string }[]
  active: string
}

export function LabBar({ variants, active }: LabBarProps) {
  const current = variants.find((v) => v.key === active)

  return (
    <nav
      aria-label="허브 후보 전환"
      className="flex flex-wrap items-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg)] px-3 py-2.5"
    >
      <span className="mr-1 font-mono text-[10px] font-[700] uppercase tracking-[0.14em] text-[var(--t3)]">
        LAB
      </span>

      {variants.map((v) => {
        const isActive = v.key === active
        return (
          <Link
            key={v.key}
            href={`/hub-lab?v=${v.key}`}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'inline-flex min-h-[36px] items-center rounded-[var(--r-md)] px-3 font-display text-[12px] font-[700] no-underline',
              'transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
              isActive
                ? 'bg-[var(--p)] text-[var(--on-p)]'
                : 'border border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[var(--p)] hover:bg-[var(--p-light)] hover:text-[var(--on-p-tint)] active:translate-y-px',
            ].join(' ')}
          >
            {v.label}
          </Link>
        )
      })}

      {current && (
        <span className="ml-auto font-body text-[11.5px] text-[var(--t3)]">{current.caption}</span>
      )}

      <Link
        href="/hub"
        className="inline-flex min-h-[36px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12px] font-[700] text-[var(--t2)] no-underline transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:text-[var(--on-p-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        현행 →
      </Link>
    </nav>
  )
}
