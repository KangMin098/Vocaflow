// apps/web/src/components/admin/vcb/VcbSectionNav.tsx
// VCB 어드민 섹션 탭 (Runs · Sources · 발행 컬렉션) — layout 상단 고정.
// 기존엔 섹션 내비가 없어 Sources 가 URL 직입력으로만 도달 가능했음(고아).

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, Database, Layers, type LucideIcon } from 'lucide-react'

const TABS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: '/admin/vocab/runs', label: 'Runs', Icon: Sparkles },
  { href: '/admin/vocab/sources', label: 'Sources', Icon: Database },
  { href: '/admin/vocab/collections', label: '발행 컬렉션', Icon: Layers },
]

export function VcbSectionNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav
      aria-label="VCB 섹션"
      className="flex gap-1 border-b mb-8"
      style={{ borderColor: 'var(--bd)' }}
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className="inline-flex min-h-[44px] items-center gap-2 -mb-px border-b-2 px-4 font-display text-sm font-medium transition-colors duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--combo)] focus-visible:ring-offset-1"
            style={{
              borderColor: active ? 'var(--combo)' : 'transparent',
              color: active ? 'var(--combo)' : 'var(--t3)',
            }}
          >
            <Icon className="w-4 h-4" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
