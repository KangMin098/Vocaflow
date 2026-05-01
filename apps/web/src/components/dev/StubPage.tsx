// apps/web/src/components/dev/StubPage.tsx
// 미구현 페이지 공통 placeholder — 개발/검증 용도

import { Construction } from 'lucide-react'
import Link from 'next/link'

interface StubPageProps {
  title: string
  description: string
  upcoming?: string[]
}

export function StubPage({ title, description, upcoming = [] }: StubPageProps) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-10 text-center shadow-[var(--sh-sm)]">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--warning-light)]">
          <Construction size={22} className="text-[var(--warning)]" />
        </span>
        <p className="mt-4 font-display text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--warning)]">
          구현 예정
        </p>
        <h1 className="mt-2 font-display text-[28px] font-[800] tracking-tight text-[var(--t1)]">
          {title}
        </h1>
        <p className="mt-3 font-body text-[14px] leading-relaxed text-[var(--t2)]">
          {description}
        </p>

        {upcoming.length > 0 && (
          <div className="mt-6 rounded-[var(--r-md)] bg-[var(--bg2)] p-4 text-left">
            <p className="font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
              예정 기능
            </p>
            <ul className="mt-2 space-y-1 font-body text-[13px] text-[var(--t2)]">
              {upcoming.map((u, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--t3)]" aria-hidden="true" />
                  <span>{u}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-[var(--r-md)] border border-[var(--bd)] px-5 py-2.5 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
          >
            화면 목록
          </Link>
          <Link
            href="/hub"
            className="rounded-[var(--r-md)] bg-[var(--p)] px-5 py-2.5 font-display text-[13px] font-[600] text-[var(--ti)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--p-hover)]"
          >
            허브로
          </Link>
        </div>
      </div>
    </div>
  )
}
