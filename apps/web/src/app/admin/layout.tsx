// apps/web/src/app/admin/layout.tsx

import type { SupabaseClient } from '@supabase/supabase-js'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { MockBanner } from '@/components/admin/MockBanner'
import { createClient } from '@/lib/supabase/server'

async function fetchPendingReportsCount(): Promise<number> {
  try {
    const client = (await createClient()) as unknown as SupabaseClient
    const { count } = await client
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')
    return count ?? 0
  } catch {
    return 0
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const reportsBadge = await fetchPendingReportsCount()
  return (
    <div className="flex min-h-screen bg-[var(--bg2)]">
      <AdminSidebar reportsBadge={reportsBadge} />
      <main className="flex min-w-0 flex-1 flex-col">
        <MockBanner />
        <div className="flex-1">{children}</div>
      </main>
    </div>
  )
}
