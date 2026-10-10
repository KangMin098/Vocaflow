// apps/web/src/app/api/admin/csat/synthetic-production/route.ts
import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { runAdminSyntheticProduction, SYNTHETIC_PRODUCTION_ORDERS,
  type SyntheticProductionOrder } from '@/lib/csat/synthetic-production'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  if (admin.role !== 'admin') return NextResponse.json({ error: 'Administrator required' }, { status: 403 })
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).join(',') !== 'order' ||
      !SYNTHETIC_PRODUCTION_ORDERS.includes((body as { order: SyntheticProductionOrder }).order))
    return NextResponse.json({ error: 'INVALID_REFERENCE_ORDER' }, { status: 400 })
  try {
    const result = await runAdminSyntheticProduction((body as { order: SyntheticProductionOrder }).order)
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'SYNTHETIC_PRODUCTION_FAILED' },
      { status: 503, headers: { 'cache-control': 'no-store' } })
  }
}
