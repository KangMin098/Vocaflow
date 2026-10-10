// apps/web/src/app/api/admin/csat/product-order-draft/route.ts
import { NextResponse } from 'next/server'
import { buildStructuredProductOrderDraft } from '@vocaflow/library-pipeline/product-planning'
import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  if (admin.role !== 'admin') return NextResponse.json({ error: 'Administrator required' }, { status: 403 })
  const raw = await request.text()
  if (raw.length > 32_768) return NextResponse.json({ error: 'REQUEST_TOO_LARGE' }, { status: 413 })
  try {
    // The clock is captured once at the request boundary and passed into pure order construction.
    const sealed = buildStructuredProductOrderDraft(JSON.parse(raw), new Date().toISOString())
    return NextResponse.json(sealed, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'INVALID_OR_STALE_PRODUCT_ORDER_DRAFT' }, { status: 400 })
  }
}
