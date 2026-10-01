// apps/web/src/components/admin/csat-diagnosis/ui.tsx
//
// 진단 관리 화면 공통 — 하위 메뉴와 버튼·표 클래스. 값은 앱 스킨 토큰(--bd · --t1 · --admin)만 쓴다.

import Link from 'next/link'

export const btnCls =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-display text-[12.5px] font-[700] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--admin)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)]'

export const primaryBtnCls =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--admin)] px-4 font-display text-[12.5px] font-[700] text-[var(--bg)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)]'

export const inputCls =
  'min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[13px] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--admin)]'

export const thCls = 'border-b border-[var(--bd)] px-2 py-2 text-left font-display text-[12px] font-[700] text-[var(--t2)]'
export const tdCls = 'border-b border-[var(--bd)] px-2 py-2 align-top font-body text-[13px] text-[var(--t1)]'

const NAV = [
  { href: '/admin/csat/diagnosis', label: '현황' },
  { href: '/admin/csat/diagnosis/exams', label: '시험·태깅' },
  { href: '/admin/csat/diagnosis/pool', label: '진단 테스트 풀' },
  { href: '/admin/csat/diagnosis/learners', label: '학습자' },
  { href: '/admin/csat/diagnosis/settings', label: '엔진 설정' },
]

export function DxNav({ current }: { current: string }) {
  return (
    <nav aria-label="진단 관리" className="flex flex-wrap gap-2">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={current === n.href ? 'page' : undefined}
          className={`min-h-[44px] ${btnCls} ${current === n.href ? 'border-[var(--admin)] text-[var(--admin)]' : ''}`}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  )
}

/** heading 을 넘기면 title 대신 그 요소를 제목으로 쓴다(사이드바 메뉴와 맞추는 화면은 h2 를 글자로 적는다) */
export function DxHeader({ title, heading, lead, children }: { title?: string; heading?: React.ReactNode; lead: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex max-w-[760px] flex-col gap-1">
        {heading ?? <h2 className="font-display text-[18px] font-[800] text-[var(--t1)]">{title}</h2>}
        <p className="break-keep font-body text-[14px] leading-relaxed text-[var(--t1)]">{lead}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : '—'
}
