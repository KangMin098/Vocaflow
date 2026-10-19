// apps/web/src/components/admin/AdminSidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpenText,
  Compass,
  Factory,
  Gauge,
  Library,
  ShieldCheck,
  Users,
  ArrowLeft,
} from 'lucide-react'
import { ADMIN_SECTIONS, getAdminLocation } from '@/lib/admin/navigation'

const ICONS = [Gauge, Library, Factory, BookOpenText, Users, Compass, ShieldCheck]
/** Compatibility export for source audits. Only the seven parent entries appear in the rail. */
export const SIDEBAR_NAV = [
  {
    label: null,
    color: null,
    items: ADMIN_SECTIONS.map((section, index) => ({
      href: section.href,
      label: section.label,
      Icon: ICONS[index]!,
      children: section.workspaces.map((workspace) => ({
        href: workspace.href,
        label: workspace.label,
        Icon: ICONS[index]!,
      })),
    })),
  },
]

export function AdminSidebar() {
  const location = getAdminLocation(usePathname() ?? '/admin')
  return (
    <aside
      aria-label="관리자 메뉴"
      className="sticky top-0 hidden h-screen w-[var(--admin-rail-width)] shrink-0 flex-col bg-[var(--bg2)] md:flex"
    >
      <Link
        href="/admin"
        className="flex h-[var(--admin-header-height)] min-h-11 items-center gap-2 px-5 text-sm font-semibold text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bdf)]"
      >
        <ShieldCheck size={19} aria-hidden /> Vocaflow{' '}
        <span className="font-mono text-[11px] text-[var(--t2)]">Admin</span>
      </Link>
      <nav aria-label="관리자 업무 영역" className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {ADMIN_SECTIONS.map((section, index) => {
            const Icon = ICONS[index]!
            const active = section.id === location?.section.id
            return (
              <li key={section.id}>
                <Link
                  href={section.href}
                  aria-current={active ? 'page' : undefined}
                  data-admin-section={section.id}
                  className={`flex min-h-11 items-center gap-3 rounded-[var(--r-md)] px-3 text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bdf)] ${active ? 'bg-[var(--bg3)] font-semibold text-[var(--t1)]' : 'text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]'}`}
                >
                  <Icon size={17} strokeWidth={1.8} aria-hidden />
                  {section.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <Link
        href="/hub"
        className="mx-3 mb-4 flex min-h-11 items-center gap-2 rounded-[var(--r-md)] px-3 text-[13px] text-[var(--t2)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bdf)]"
      >
        <ArrowLeft size={15} aria-hidden />
        학습 화면
      </Link>
    </aside>
  )
}
