// apps/web/src/app/admin/reports/page.tsx
import { redirect } from 'next/navigation'
import { adminCompatibilityHref, type AdminSearchParams } from '@/lib/admin/navigation'
export default function AdminReportsPage({ searchParams }: { searchParams?: AdminSearchParams }) {
  redirect(adminCompatibilityHref('/admin/settings#reports', searchParams))
}
