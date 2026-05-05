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

      <footer className="border-t border-bd bg-bg2">
        <div className="mx-auto max-w-6xl px-s-4 py-s-10 lg:px-s-8">
          {/* 4 컬럼 nav */}
          <nav
            aria-label="footer"
            className="grid grid-cols-2 gap-s-6 md:grid-cols-4"
          >
            {[
              {
                title: '제품',
                links: [
                  { label: '소개', href: '/about' },
                  { label: '요금제', href: '/pricing' },
                  { label: '학습 모듈', href: '/about#modules' },
                ],
              },
              {
                title: '시작하기',
                links: [
                  { label: '회원가입', href: '/signup' },
                  { label: '로그인', href: '/login' },
                  { label: '비밀번호 재설정', href: '/reset-password' },
                ],
              },
              {
                title: '지원',
                links: [
                  { label: '도움말', href: '/about' },
                  { label: '문의', href: 'mailto:hello@vocaflow.app' },
                  { label: '학교·기관', href: 'mailto:hello@vocaflow.app?subject=Team' },
                ],
              },
              {
                title: '정책',
                links: [
                  { label: '이용약관', href: '/terms' },
                  { label: '개인정보처리방침', href: '/privacy' },
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <p className="font-display text-[11px] font-[700] uppercase tracking-[0.10em] text-t3">
                  {col.title}
                </p>
                <ul className="mt-s-3 space-y-s-2">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="font-body text-[13px] text-t2 transition-colors hover:text-t1"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* 하단 줄 */}
          <div className="mt-s-8 flex flex-col items-start justify-between gap-s-3 border-t border-bd pt-s-6 sm:flex-row sm:items-center">
            <Link href="/" className="flex items-center gap-s-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md text-white"
                style={{ background: 'linear-gradient(135deg, var(--p) 0%, var(--combo) 100%)' }}
                aria-hidden
              >
                <Sparkles size={13} />
              </span>
              <span className="font-display text-[13px] font-extrabold tracking-tight text-t1">
                Vocaflow
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-t3">
                © {new Date().getFullYear()}
              </span>
            </Link>
            <p className="font-english text-[12px] italic text-t3">
              Slow is smooth, smooth is fast.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
