// apps/web/src/app/api/admin/csat/structural-planning/route.ts
import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { loadStructuralPlanningCatalog, planProductOrderStructure } from '@/lib/csat/structural-planning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function catalog() {
  const dir = process.env.TEXTBOOK_STRUCTURAL_REFERENCE_DIR
  if (!dir) throw new Error('STRUCTURAL_REFERENCE_UNCONFIGURED')
  return loadStructuralPlanningCatalog(dir)
}

export async function GET() {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  try {
    return NextResponse.json(await catalog(), { headers: { 'cache-control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'STRUCTURAL_REFERENCE_UNAVAILABLE' },
      { status: 503, headers: { 'cache-control': 'no-store' } })
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  const { order, selected_source_ids } = body as Record<string, unknown>
  try {
    const note = planProductOrderStructure(order, await catalog(), selected_source_ids)
    return NextResponse.json(note, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const inputError = (error instanceof Error && error.name === 'ZodError') ||
      message === 'STRUCTURAL_SELECTION_INVALID'
    return NextResponse.json({ error: inputError ? 'INVALID_REQUEST' : 'STRUCTURAL_REFERENCE_UNAVAILABLE' },
      { status: inputError ? 400 : 503, headers: { 'cache-control': 'no-store' } })
  }
}
