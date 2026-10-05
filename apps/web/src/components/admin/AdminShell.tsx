// apps/web/src/components/admin/AdminShell.tsx
import Link from 'next/link'
import { ShieldCheck, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { AdminSidebar } from './AdminSidebar'
import { BTN } from '@/components/ui/tines-kit'

/** 관리자 PC는 3B 앱의 상단 줄 + 운영 레일 + 흰 작업 패널. 인증은 서버 layout이 소유한다. */
export function AdminShell({ children, reportsBadge }: { children: ReactNode; reportsBadge: number | null }) {
  return (
    <div data-area="admin" className="min-h-screen bg-[var(--bg)]">
      {/* 건너뛰기 링크 — 포커스 때만 보인다. 탭 영역 44px 를 명시한다(학습자 셸의 같은 링크와 같은 규칙 · 정적 스캔이 읽을 수 있게). */}
      <a href="#admin-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:bg-[var(--p)] focus:p-4 focus:text-[var(--on-p)]">본문으로 이동</a>
      <header className="admin-site-header sticky top-0 z-30 hidden border-b border-[var(--bd)] bg-[var(--bg)] md:block">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/admin" className="flex min-h-11 items-center gap-3 rounded-full px-2 font-display text-[20px] font-[700] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--p)]">
            <ShieldCheck size={26} aria-hidden /> Vocaflow
            <span className="rounded-full bg-[var(--tint-lavender)] px-3 py-1 font-mono text-[11px] text-[var(--tint-lavender-ink)]">Admin</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/hub" className={`${BTN.secondary} hidden sm:inline-flex`}>학습 화면 <ArrowUpRight size={16} aria-hidden /></Link>
          </div>
        </div>
      </header>
      <div className="admin-frame mx-auto flex max-w-[1440px] gap-4 px-2 md:gap-8 md:px-8">
        <AdminSidebar reportsBadge={reportsBadge} />
        <main id="admin-content" tabIndex={-1} className="admin-main min-w-0 flex-1 py-4 outline-none md:py-8"><div data-admin-panel className="contents md:block">{children}</div></main>
      </div>
    </div>
  )
}
