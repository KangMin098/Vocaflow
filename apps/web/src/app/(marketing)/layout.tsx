// apps/web/src/app/(marketing)/layout.tsx
// 마케팅/공개 페이지 공통 레이아웃 — 헤더/푸터 슬롯, 차분한 배경

'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-t1">
      <header className="sticky top-0 z-30 flex h-[60px] items-center gap-s-4 border-b border-bd bg-bg/90 px-s-4 backdrop-blur lg:px-s-8">
        <Link href="/" className="flex items-center gap-s-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
            style={{ background: 'linear-gradient(135deg, var(--p) 0%, var(--combo) 100%)' }}
            aria-hidden
          >
            <Sparkles size={16} />
          </span>
          <span className="font-display text-base font-extrabold tracking-tight">Vocaflow</span>
        </Link>

        <nav className="ml-auto flex items-center gap-s-4 font-display text-sm">
          <Link href="/pricing" className="text-t2 hover:text-t1">
            요금제
          </Link>
          <Link href="/about" className="text-t2 hover:text-t1">
            소개
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-p px-s-4 py-s-2 font-semibold text-white hover:opacity-90"
          >
            로그인
          </Link>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-bd px-s-4 py-s-6 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-t3 lg:px-s-8">
        © {new Date().getFullYear()} Vocaflow ·{' '}
        <Link href="/terms" className="hover:text-t1">
          이용약관
        </Link>{' '}
        ·{' '}
        <Link href="/privacy" className="hover:text-t1">
          개인정보처리방침
        </Link>
      </footer>
    </div>
  )
}
