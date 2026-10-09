// apps/web/src/app/api/admin/csat/product-plan/route.ts
import { NextResponse } from 'next/server'
import { planProductBrief } from '@vocaflow/library-pipeline/product-planning'
import { PRODUCT_RUNTIME_EVIDENCE, productRuntimeCapability } from '@vocaflow/library-pipeline/product-capability-status'
import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  return NextResponse.json({ capability: Object.fromEntries(Object.keys(PRODUCT_RUNTIME_EVIDENCE).map(family =>
    [family, productRuntimeCapability(family as keyof typeof PRODUCT_RUNTIME_EVIDENCE)])) },
  { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  const raw = await request.text()
  if (raw.length > 16_384) return NextResponse.json({ error: 'REQUEST_TOO_LARGE' }, { status: 413 })
  try {
    const { plan, plan_hash } = planProductBrief(JSON.parse(raw))
    return NextResponse.json({ plan, plan_hash, runtime_capability: PRODUCT_RUNTIME_EVIDENCE[plan.product_family] },
      { headers: { 'cache-control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'INVALID_PRODUCT_BRIEF' }, { status: 400 })
  }
}
