// apps/web/src/components/admin/AdminPageHeader.tsx
// 관리자 sub-page 공통 헤더 — 일관된 컨텍스트 표시

import type { LucideIcon } from 'lucide-react'

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
    <header className="mb-6 flex flex-wrap items-center gap-3">
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] bg-gradient-to-br from-[#A78BFA] to-[#8B5CF6] text-white shadow-[0_1px_4px_rgba(139,92,246,0.18)]"
        aria-hidden
      >
        <Icon size={16} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[#8B5CF6]">
          Admin Console
        </p>
        <h1 className="font-display text-[22px] font-[800] tracking-tight text-[var(--t1)]">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 font-body text-[13px] text-[var(--t3)]">{description}</p>
        )}
      </div>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
