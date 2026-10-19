// apps/web/src/app/admin/layout.tsx
import { AdminShell } from '@/components/admin/AdminShell'
import { requireAdmin } from '@/lib/auth/require-admin'
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <AdminShell>{children}</AdminShell>
}
