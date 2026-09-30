// apps/web/src/app/api/admin/csat/evidence/route.ts
import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { loadEvidenceOperations } from '@/lib/csat/evidence-operations-loader'
import { parseEvidenceScope } from '@/lib/csat/evidence-fold'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Read-only revalidation. No process launch, DB mutation, or learner-cache reuse. */
export async function GET(request: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  const data = await loadEvidenceOperations(parseEvidenceScope(new URL(request.url).searchParams))
  return NextResponse.json(data, {
    status: data.loadError || data.readinessError ? 503 : 200,
    headers: { 'cache-control': 'no-store' },
  })
}
