// apps/web/src/app/api/admin/articles/reading-promotion/route.ts
import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Action = 'register-order' | 'register-authority' | 'approve'
const procedures: Record<Action, { fields: string[] }> = {
  'register-order': { fields: ['p_order_id', 'p_order_revision', 'p_order_hash'] },
  'register-authority': { fields: ['p_generation', 'p_trust_policy_hash', 'p_benchmark_version', 'p_benchmark_snapshot_hash', 'p_revoked_certificate_hashes', 'p_revoked_eligibility_hashes', 'p_valid_until'] },
  approve: { fields: ['p_request', 'p_rationale'] },
}

// This route deliberately uses the caller's authenticated session. A service
// role or the development admin bypass cannot mint an owner approval here.
export async function POST(request: Request): Promise<NextResponse> {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  if (admin.role !== 'admin') return NextResponse.json({ error: 'Administrator required' }, { status: 403 })
  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > 32_768) return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  let body: Record<string, unknown>
  try {
    const raw = await request.text()
    if (raw.length > 32_768) return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('invalid')
    body = parsed as Record<string, unknown>
  } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const action = body.action
  if (typeof action !== 'string' || !Object.prototype.hasOwnProperty.call(procedures, action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  const procedure = procedures[action as Action]
  if (Object.keys(body).length !== procedure.fields.length + 1 || procedure.fields.some(field => body[field] === undefined))
    return NextResponse.json({ error: 'Invalid action fields' }, { status: 400 })
  const client = await createClient()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user || userData.user.id !== admin.id) return NextResponse.json({ error: 'Authenticated administrator session required' }, { status: 403 })
  const args = Object.fromEntries(procedure.fields.map(field => [field, body[field]]))
  const caller = client as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }> }
  const { data, error } = action === 'register-order'
    ? await caller.rpc('register_reading_product_order', args)
    : action === 'register-authority'
      ? await caller.rpc('register_reading_promotion_authority', args)
      : await caller.rpc('approve_reading_promotion', args)
  if (error) return NextResponse.json({ error: 'Promotion authorization rejected', code: error.code ?? 'DB_REJECTED' }, { status: 409 })
  return NextResponse.json({ ok: true, action, result: data ?? null })
}
