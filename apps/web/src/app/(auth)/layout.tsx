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

  // ⚠️ **저장값이 없을 때 `'light'` 로 접지 않는다.**
  //    루트 레이아웃의 선행 스크립트는 `stored || (prefersDark ? 'dark' : 'light')` 로
  //    OS 선호를 반영해 `data-theme` 을 미리 칠하는데, 여기가 하이드레이션 뒤에
  //    `'light'` 로 덮어써서 **다크 사용자가 인증 4화면에서만 흰 화면으로 튕겼다**
  //    (한 번도 테마를 고른 적 없는 사용자 — 저장값이 없는 상태가 정확히 그 경우다).
  //    두 곳이 같은 규칙을 각자 적으면 다시 갈라지므로 문장까지 루트와 동일하게 맞춘다.
  useEffect(() => {
    const stored = localStorage.getItem('vocaflow-theme')
    const resolved: 'light' | 'dark' =
      stored === 'dark' || stored === 'light'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
    setTheme(resolved)
    document.documentElement.setAttribute('data-theme', resolved)
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
            /* 108×28 이었다 — 44px 미만 탭 대상이었다(CLAUDE.md 절대 금지 · 실측 390px). 로그인·가입·재설정·인증 네 화면이 공유한다. */
            className="group flex min-h-[44px] items-center gap-s-2 text-t1 transition-opacity duration-normal hover:opacity-80"
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
              /* 40×32 였다 — 44px 미만 탭 대상이었다(CLAUDE.md 절대 금지 · 실측 390px). 로그인·가입·재설정·인증 네 화면이 공유한다. */
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-s-3 py-s-2 font-display text-xs font-medium text-t2 transition-colors duration-normal hover:bg-bg2 hover:text-t1"
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
