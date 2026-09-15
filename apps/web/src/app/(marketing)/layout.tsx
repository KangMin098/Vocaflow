// apps/web/src/app/(marketing)/layout.tsx
// 마케팅/공개 페이지 공통 레이아웃 — 헤더/푸터 슬롯, 차분한 배경

'use client'

import Link from 'next/link'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-t1">
      <header className="sticky top-0 z-30 flex h-[60px] items-center gap-s-4 border-b border-bd bg-bg/90 px-s-4 backdrop-blur lg:px-s-8">
        <Link href="/" className="flex min-h-[44px] items-center gap-s-2">
          {/* v07 워드마크 — 주묵 각인 + Lora + 권점. 학습자 셸(Sidebar)·인증 화면과 같은 서명이다.
              이전의 «그라디언트 라운드 사각형 + Sparkles» 는 지금 전 세계 AI 생성 UI 의 공통
              표식이라, 로고가 아니라 출신 표시가 된다. */}
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] bg-[var(--ju)] font-english text-[15px] font-[500] leading-none text-[var(--on-ju)]"
            aria-hidden
          >
            V
          </span>
          <span className="font-english text-[17px] font-[500] tracking-[0.01em]">
            Vocaflow
            <span
              aria-hidden
              className="ml-[3px] inline-block h-[4px] w-[4px] rounded-full bg-[var(--ju)] align-[3px]"
            />
          </span>
        </Link>

        {/* ⚠️ 390px 실측(2026-09-16): «지문 진 / 단», «요금 / 제» 처럼 **낱말이 쪼개졌다.**
            한글은 음절 단위로 줄바꿈되므로 폭이 빠듯한 자리에서는 명시적으로 막아야 한다
            (CLAUDE.md I7 «한글에 break-keep»). 그래도 좁으면 가로 스크롤로 흘린다 —
            글자를 깨뜨리는 것보다 낫다. */}
        <nav className="ml-auto flex min-w-0 items-center gap-s-3 overflow-x-auto whitespace-nowrap font-display text-sm [scrollbar-width:none] lg:gap-s-4">
          {/* 가입 전에 써볼 수 있는 유일한 기능 — 헤더 첫 자리에 둔다. */}
          <Link href="/fit" className="inline-flex min-h-[44px] items-center text-t2 hover:text-t1">
            지문 진단
          </Link>
          <Link href="/pricing" className="inline-flex min-h-[44px] items-center text-t2 hover:text-t1">
            요금제
          </Link>
          <Link href="/about" className="inline-flex min-h-[44px] items-center text-t2 hover:text-t1">
            소개
          </Link>
          {/* 글보다 영상이 빠른 사람이 있다 — 특히 3분 안에 판단하는 교사(디자인 렌즈 6). */}
          <Link href="/video" className="inline-flex min-h-[44px] items-center text-t2 hover:text-t1">
            영상
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center rounded-md bg-[var(--ju)] px-s-4 py-s-2 font-semibold text-[var(--on-ju)] hover:opacity-90"
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
                <p className="font-display text-[11px] font-[600] tracking-[0.04em] text-t3">
                  {col.title}
                </p>
                <ul className="mt-s-3 space-y-s-2">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="inline-flex min-h-[44px] items-center font-body text-[13px] text-t2 transition-colors hover:text-t1"
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
            <Link href="/" className="flex min-h-[44px] items-center gap-s-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--ju)] font-english text-[13px] font-[500] leading-none text-[var(--on-ju)]"
                aria-hidden
              >
                V
              </span>
              <span className="font-english text-[14px] font-[500] tracking-[0.01em] text-t1">
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
