// apps/web/src/app/api/admin/csat/evidence/route.ts
import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { loadEvidenceOperations } from '@/lib/csat/evidence-operations-loader'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Read-only revalidation. No process launch, DB mutation, or learner-cache reuse. */
export async function GET() {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  const data = await loadEvidenceOperations()
  return NextResponse.json(data, {
    status: data.loadError || data.readinessError ? 503 : 200,
    headers: { 'cache-control': 'no-store' },
  })
}
