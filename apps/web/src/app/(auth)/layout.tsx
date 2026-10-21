// apps/web/src/app/(auth)/layout.tsx
// 인증 페이지 공통 레이아웃 — PC Tines 열린 지면·자체 계정 삽화·명확한 입력면.
// 폼/인증 로직은 각 페이지가 소유하고, PC 표현은 auth-reference.css가 소유한다.

'use client'

import { Moon, Sun } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import '@/components/layout/auth-reference.css'

import { LogoMark } from '@/components/marketing/site/LogoMark'
import { useEffect, useState } from 'react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const intro = pathname === '/signup'
    ? { title: '읽고, 익히고, 내 것으로.', body: '한 계정으로 읽기와 단어 학습을 이어가세요.' }
    : pathname === '/reset-password'
      ? { title: '다시 이어갈 수 있어요.', body: '이메일로 계정을 확인하고 비밀번호를 다시 설정해요.' }
      : pathname === '/verify-email'
        ? { title: '메일함에서 한 번만 더.', body: '인증 링크를 확인하면 학습을 시작할 수 있어요.' }
        : { title: '읽던 곳에서 이어가요.', body: '모아 둔 단어와 읽던 이야기가 기다리고 있어요.' }
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
    <div className="auth-reference flex min-h-screen flex-col bg-bg">
      {/* ── Header — 미니멀 ── */}
      <header className="border-b border-bd">
        {/* 본문(main · max 1360 · lg:px-10)과 같은 틀 — 예전 max-w-6xl 은 로고 x≈168 · 폼 x=80 으로 시작선이 갈렸다(2026-10-19 실측) */}
        <div className="mx-auto flex w-full max-w-[1360px] items-center justify-between px-4 py-s-4 lg:px-10">
          {/* 로고 */}
          <Link
            href="/"
            /* 108×28 이었다 — 44px 미만 탭 대상이었다(CLAUDE.md 절대 금지 · 실측 390px). 로그인·가입·재설정·인증 네 화면이 공유한다. */
            className="group flex min-h-[44px] items-center gap-s-2 text-t1 transition-opacity duration-normal hover:opacity-80"
          >
            {/* v07 워드마크 — 주묵 각인 + Lora. `Sparkles` 아이콘은 지금 전 세계 AI 생성 UI 가
                공통으로 쓰는 표식이라, 그걸 로고로 쓰면 로고가 아니라 출신 표시가 된다.
                (실측: public/ 에 로고 자산 0개 — docs/design/00-inventory.md §0-5) */}
            <LogoMark />
            <span className="font-display text-[22px] font-[500] tracking-[-0.02em] text-[var(--ju)]">vocaflow</span>
          </Link>

          {/* 우측 — 미세한 액션 */}
          <div className="flex items-center gap-s-4">
            <button
              onClick={toggleTheme}
              aria-label="테마 전환"
              /* 40×32 였다 — 44px 미만 탭 대상이었다(CLAUDE.md 절대 금지 · 실측 390px). 로그인·가입·재설정·인증 네 화면이 공유한다. */
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-s-3 py-s-2 font-display text-xs font-medium text-t2 transition-colors duration-normal hover:bg-bg2 hover:text-t1"
            >
              {theme === 'light' ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      {/* 기존 작은 화면의 카드 구조를 유지한다. PC는 최신 사용자 지시에 따라
          열린 안내/자체 삽화와 폼 두 열로 표시하며, 중첩 Card의 테두리·그림자는 끈다. */}
      <main className="mx-auto flex w-full max-w-[1360px] flex-1 items-center justify-center px-4 py-8 sm:py-12 lg:px-10">
        <div className="auth-reference__grid grid w-full max-w-[920px] overflow-hidden rounded-[16px] border border-[color-mix(in_srgb,var(--ju)_14%,transparent)] bg-[var(--bg)] shadow-[0_20px_60px_color-mix(in_srgb,var(--t1)_5%,transparent)] lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
          <div className="auth-reference__art tone-green hidden items-center justify-center p-10 lg:flex">
            <div className="hidden lg:block"><h2>{intro.title}</h2><p>{intro.body}</p></div>
            <Image src="/illustrations/tines/spot-welcome.webp" alt="" width={1328} height={1328} sizes="280px" className="h-auto w-[260px] select-none" />
            <Image src="/illustrations/tines/scene-auth-v1.webp" alt="" width={1200} height={800} sizes="(min-width: 1024px) 520px, 50vw" className="reference-scene hidden select-none lg:block" />
          </div>
          <div className="auth-reference__form w-full [&>*]:!rounded-none [&>*]:!border-0 [&>*]:!shadow-none">{children}</div>
        </div>
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
