// apps/web/src/app/admin/csat/sources/page.tsx
import { requireAdmin } from '@/lib/auth/require-admin'
import { buildSourceEligibilityPanel } from '@/lib/textbook/source-eligibility-view'
import { buildSourceInventoryPanel } from '@/lib/textbook/source-inventory-view'
import { parseSourceWorkspace } from '@/lib/textbook/source-workspace'
import { SourceEligibilityClient } from './SourceEligibilityClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatSourcesPage({ searchParams }: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  await requireAdmin('/admin/csat/sources')
  return <SourceEligibilityClient panel={buildSourceEligibilityPanel()} inventory={buildSourceInventoryPanel()} initialState={parseSourceWorkspace(searchParams)} />
}
