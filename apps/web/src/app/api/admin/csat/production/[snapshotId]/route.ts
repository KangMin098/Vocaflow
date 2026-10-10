// apps/web/src/app/api/admin/csat/production/[snapshotId]/route.ts
import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const noStore = { 'cache-control': 'private, no-store, max-age=0' }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const hex = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)

/** Each download calls the DB's current-evidence serving gate; no stored HTML is read directly. */
export async function GET(_request: Request, context: { params: { snapshotId: string } }) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

  const snapshotId = context.params.snapshotId
  if (!uuid.test(snapshotId))
    return NextResponse.json({ error: 'INVALID_SNAPSHOT_ID' }, { status: 400, headers: noStore })

  try {
    const db = createAdminClient() as unknown as { rpc: (name: string, args: object) => Promise<{
      data: unknown; error: unknown
    }> }
    const { data, error } = await db.rpc('serve_reading_production_artifact', { p_snapshot_id: snapshotId })
    if (error || !data || typeof data !== 'object') throw Error('SERVE_REJECTED')
    const artifact = data as Record<string, unknown>
    if (artifact.snapshot_id !== snapshotId || !hex(artifact.snapshot_hash) ||
        !hex(artifact.output_hash) || typeof artifact.html !== 'string' ||
        createHash('sha256').update(artifact.html, 'utf8').digest('hex') !== artifact.output_hash)
      throw Error('SERVE_REJECTED')

    return new Response(artifact.html, { status: 200, headers: {
      ...noStore,
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': `attachment; filename="textbook-${snapshotId}.html"`,
      'content-security-policy': "sandbox; default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      'x-content-type-options': 'nosniff',
      'x-snapshot-hash': artifact.snapshot_hash,
      'x-output-hash': artifact.output_hash,
    } })
  } catch {
    return NextResponse.json({ error: 'PRODUCTION_ARTIFACT_UNAVAILABLE' },
      { status: 409, headers: noStore })
  }
}
