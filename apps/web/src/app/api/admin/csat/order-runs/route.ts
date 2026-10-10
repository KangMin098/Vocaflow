// apps/web/src/app/api/admin/csat/order-runs/route.ts
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createAdminClient } from '@/lib/supabase/admin'
import { readOrderRuns } from '@/lib/csat/order-run-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const noStore = { 'cache-control': 'no-store' }

export async function GET(request: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  if (admin.role !== 'admin') return NextResponse.json({ error: 'Administrator required' }, { status: 403 })
  const orderId = new URL(request.url).searchParams.get('order_id')?.trim()
  if (!orderId || orderId.length > 128) return NextResponse.json({ error: 'INVALID_ORDER_ID' }, { status: 400 })
  const root = process.env.TEXTBOOK_ORDER_RUN_DIR
  if (!root) return NextResponse.json({ error: 'ORDER_RUN_DIR_UNCONFIGURED' }, { status: 503, headers: noStore })
  // The registered revision decides whether a run is still current; a failed read is unmeasured, not current.
  const db = createAdminClient() as unknown as SupabaseClient
  const order = await db.from('reading_product_order_revision')
    .select('order_revision').eq('order_id', orderId).maybeSingle()
  if (order.error) return NextResponse.json({ error: 'ORDER_RUN_REVISION_UNAVAILABLE' }, { status: 503, headers: noStore })
  try {
    const runs = await readOrderRuns(root, orderId, order.data?.order_revision ?? null)
    return NextResponse.json({ order_id: orderId, registered_revision: order.data?.order_revision ?? null, runs },
      { headers: noStore })
  } catch {
    return NextResponse.json({ error: 'ORDER_RUN_STATUS_UNAVAILABLE' }, { status: 503, headers: noStore })
  }
}
