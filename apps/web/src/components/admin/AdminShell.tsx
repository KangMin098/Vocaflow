// apps/web/src/components/admin/AdminShell.tsx
// tokens-from: ./AdminShell.module.css
'use client'
import { Suspense, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { AdminSidebar } from './AdminSidebar'
import { getAdminLocation, withFactoryContext } from '@/lib/admin/navigation'
import styles from './AdminShell.module.css'
import { parseFactoryScope, factoryScopeDescription } from '@/lib/admin/factory-scope'

const LINK =
  'inline-flex min-h-11 items-center rounded-[var(--r-sm)] px-3 text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bdf)]'
function SectionNavigation() {
  const location = getAdminLocation(usePathname() ?? '/admin')
  const search = useSearchParams()
  if (!location?.section.workspaces.length) return null
  const { section, workspace, tool } = location
  const target = (href: string) =>
    section.id === 'factory' ? withFactoryContext(href, search) : href
  return (
    <div className="border-b border-[var(--bd)] px-4 py-2 sm:px-6" data-admin-local-nav>
      {section.id === 'factory' && (
        <p className="mb-2 break-keep text-xs text-[var(--t2)]">
          {factoryScopeDescription(parseFactoryScope(search), ['/admin/csat/review', '/admin/csat/press'].includes(location.tool?.href ?? ''))}
        </p>
      )}
      <nav aria-label={`${section.label} 화면`}>
        <ul className="flex flex-wrap gap-1">
          {section.workspaces.map((item) => (
            <li key={item.id}>
              <Link
                href={target(item.href)}
                aria-current={item.id === workspace?.id ? 'page' : undefined}
                className={`${LINK} ${item.id === workspace?.id ? 'bg-[var(--bg3)] font-semibold text-[var(--t1)]' : 'text-[var(--t2)] hover:bg-[var(--bg2)]'}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {!!workspace?.tools?.length && (
        <nav
          aria-label={`${workspace.label} 작업`}
          className="mt-1 border-t border-[var(--bd)] pt-1"
        >
          <ul className="flex flex-wrap gap-1">
            {workspace.tools.map((item) => (
              <li key={item.id}>
                <Link
                  href={target(item.href)}
                  aria-current={item.id === tool?.id ? 'page' : undefined}
                  className={`${LINK} ${item.id === tool?.id ? 'font-semibold text-[var(--t1)] underline underline-offset-4' : 'text-[var(--t2)] hover:text-[var(--t1)]'}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {!!section.utilities?.length && (
        <nav aria-label={`${section.label} 안내`} className="mt-1">
          {section.utilities.map((item) => (
            <Link key={item.id} href={item.href} className={`${LINK} text-[var(--t2)] underline underline-offset-4`}>
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}

export function AdminShell({ children }: { children: ReactNode }) {
  const location = getAdminLocation(usePathname() ?? '/admin')
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setReady(true)
  }, [])
  return (
    <div
      data-area="admin"
      data-admin-ready={ready || undefined}
      className={`${styles.shell} admin-frame flex min-h-screen bg-[var(--bg2)]`}
    >
      <a
        href="#admin-content"
        className="sr-only min-h-11 focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:flex focus:items-center focus:bg-[var(--bg)] focus:px-4"
      >
        본문으로 이동
      </a>
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <header className="admin-site-header flex h-[var(--admin-header-height)] items-center justify-between border-b border-[var(--bd)] px-4 sm:px-6">
          <p className="text-sm font-semibold text-[var(--t1)]">
            {location?.section.label ?? '관리자'}
          </p>
          <p className="hidden break-keep text-xs text-[var(--t2)] lg:block">
            {location?.section.description}
          </p>
        </header>
        <main
          id="admin-content"
          tabIndex={-1}
          className="min-w-0 px-[var(--admin-frame-gap)] pb-[var(--admin-frame-gap)] pt-[var(--admin-panel-top-gap)] outline-none"
        >
          <div
            data-admin-panel
            className="min-h-[var(--admin-panel-min-height)] rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]"
          >
            <Suspense>
              <SectionNavigation />
            </Suspense>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
