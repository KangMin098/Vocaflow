// apps/web/src/app/admin/csat/layout.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getAdminLocation } from '@/lib/admin/navigation'
export default function AdminCsatLayout({ children }: { children: React.ReactNode }) {
  const location = getAdminLocation(usePathname() ?? '/admin/csat')!
  const title =
    location.section.id === 'factory'
      ? '교재 제작'
      : (location.workspace?.label ?? location.section.label)
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <h1>
        <Link
          href={location.workspace?.href ?? location.section.href}
          className="inline-flex min-h-11 items-center text-[22px] font-bold text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bdf)]"
        >
          {title}
        </Link>
      </h1>
      {children}
    </div>
  )
}
