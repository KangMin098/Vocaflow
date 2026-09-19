// apps/web/src/app/admin/csat/evidence/page.tsx
import { requireAdmin } from '@/lib/auth/require-admin'
import { loadEvidenceOperations } from '@/lib/csat/evidence-operations-loader'
import { parseOperationsState } from '@/lib/csat/evidence-operations'
import { EvidenceConsole } from './EvidenceConsole'

export const dynamic = 'force-dynamic'

export default async function AdminCsatEvidencePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  await requireAdmin('/admin/csat/evidence')
  const data = await loadEvidenceOperations()
  return <EvidenceConsole data={data} initialState={parseOperationsState(searchParams)} />
}
