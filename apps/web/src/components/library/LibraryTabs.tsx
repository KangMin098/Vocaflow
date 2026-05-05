// apps/web/src/components/library/LibraryTabs.tsx
//
// /library 하위 2탭 네비게이션 — 스크립트 / 단어장.
// usePathname 기반 활성 표현, 보라(#8B5CF6 — Sidebar "스크립트" accent) 일관.

'use client'

import { Compass, Layers } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: '스크립트', href: '/library/scripts', icon: Compass },
  { label: '단어장', href: '/library/vocab', icon: Layers },
] as const

export function LibraryTabs() {
  const pathname = usePathname()

  return (
    <nav
      role="tablist"
      aria-label="라이브러리 탭"
      className="flex gap-1 border-b border-[var(--bd)]"
    >
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`flex min-h-[44px] items-center gap-2 border-b-2 px-4 py-3 font-display text-[14px] font-[600] transition-colors duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1 ${
              isActive
                ? 'border-[#8B5CF6] text-[var(--t1)]'
                : 'border-transparent text-[var(--t3)] hover:text-[var(--t1)]'
            }`}
          >
            <Icon size={16} aria-hidden />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
