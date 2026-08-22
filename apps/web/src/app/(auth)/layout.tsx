// apps/web/src/app/(auth)/layout.tsx
// 인증 페이지 공통 레이아웃 — Parts Kit + Linear/Vercel 미니멀 접목
//   - 차분한 배경 (--bg)
//   - 미니멀 헤더 (로고만)
//   - 충분한 여백

'use client'

import { Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const stored = (localStorage.getItem('vocaflow-theme') as 'light' | 'dark') || 'light'
    setTheme(stored)
    document.documentElement.setAttribute('data-theme', stored)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('vocaflow-theme', next)
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* ── Header — 미니멀 ── */}
      <header className="border-b border-bd">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-s-6 py-s-4">
          {/* 로고 */}
          <Link
            href="/"
            className="group flex items-center gap-s-2 text-t1 transition-opacity duration-normal hover:opacity-80"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-p transition-transform duration-normal group-hover:scale-105">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="font-display text-base font-extrabold tracking-tight">Vocaflow</span>
          </Link>

          {/* 우측 — 미세한 액션 */}
          <div className="flex items-center gap-s-4">
            <button
              onClick={toggleTheme}
              aria-label="테마 전환"
              className="rounded-md px-s-3 py-s-2 font-display text-xs font-medium text-t2 transition-colors duration-normal hover:bg-bg2 hover:text-t1"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex flex-1 items-center justify-center px-s-4 py-s-8 sm:py-s-12">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* ── Footer — 작고 절제 ── */}
      <footer className="border-t border-bd py-s-4">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-s-4 px-s-6 text-xs text-t3">
          <Link href="/terms" className="transition-colors duration-normal hover:text-t1">
            이용약관
          </Link>
          <span className="text-t3">·</span>
          <Link href="/privacy" className="transition-colors duration-normal hover:text-t1">
            개인정보 처리방침
          </Link>
          <span className="text-t3">·</span>
          <span>© 2026 Vocaflow</span>
        </div>
      </footer>
    </div>
  )
}
