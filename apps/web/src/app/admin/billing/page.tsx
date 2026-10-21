// apps/web/src/app/admin/billing/page.tsx
import { redirect } from 'next/navigation'
import { adminCompatibilityHref, type AdminSearchParams } from '@/lib/admin/navigation'
export default function AdminBillingPage({ searchParams }: { searchParams?: AdminSearchParams }) {
  redirect(adminCompatibilityHref('/admin/settings#billing', searchParams))
}
