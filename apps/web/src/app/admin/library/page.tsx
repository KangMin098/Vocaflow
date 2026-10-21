// apps/web/src/app/admin/library/page.tsx
import { redirect } from 'next/navigation'
import { adminCompatibilityHref, type AdminSearchParams } from '@/lib/admin/navigation'
export default function AdminLibraryPage({ searchParams }: { searchParams?: AdminSearchParams }) {
  redirect(adminCompatibilityHref('/admin/curation?view=library', searchParams))
}
