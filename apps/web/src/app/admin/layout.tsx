// apps/web/src/app/admin/layout.tsx

import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--bg2)]">
      <AdminSidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
