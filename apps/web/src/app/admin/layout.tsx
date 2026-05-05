// apps/web/src/app/admin/layout.tsx

import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { MockBanner } from '@/components/admin/MockBanner'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--bg2)]">
      <AdminSidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <MockBanner />
        <div className="flex-1">{children}</div>
      </main>
    </div>
  )
}
