// apps/web/src/components/admin/AdminPageHeader.tsx
// 관리자 sub-page 공통 헤더 — 일관된 컨텍스트 표시

import type { LucideIcon } from 'lucide-react'
import Image from 'next/image'

export interface AdminPageHeaderProps {
  icon: LucideIcon
  title: string
  description?: string
  /** 우측 액션 (검색/추가 버튼 등) */
  actions?: React.ReactNode
}

export function AdminPageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: AdminPageHeaderProps) {
  return (
    <header className="tines-admin-page-header tone-lavender dots relative mb-8 flex flex-wrap items-center gap-4 overflow-hidden rounded-[var(--r-2xl)] p-5 sm:p-8">
      <span
        className="relative z-10 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--r-lg)] border border-current bg-[var(--bg)] text-[var(--tint-lavender-ink)]"
        aria-hidden
      >
        <Icon size={24} strokeWidth={1.5} />
      </span>
      <div className="relative z-10 min-w-0 flex-1">
        <p className="font-mono text-[10px] font-[500] uppercase tracking-[0.10em] text-[var(--t3)]">
          Admin Console
        </p>
        <h1 className="mt-2 break-keep font-display text-[28px] font-[600] leading-[1.08] tracking-tight text-[var(--t1)] sm:text-[36px]">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-[620px] break-keep font-body text-[14px] leading-relaxed text-[var(--t2)]">{description}</p>
        )}
      </div>
      <Image src="/illustrations/tines/spot-vault.webp" alt="" width={160} height={160} className="ml-auto hidden h-24 w-24 shrink-0 lg:block" />
      {actions && <div className="relative z-10 flex w-full flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
