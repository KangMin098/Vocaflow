// apps/web/src/app/api/pdcp/queue/route.ts
//
// 큐 현황 — 드레인 루프가 한 단계 끝낼 때마다 새로 읽는다(라이브 모니터링).

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { listPdComicsAdmin } from '@/lib/pd-comic/queries'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const client = createAdminClient() as unknown as SupabaseClient
  const { ready, data } = await listPdComicsAdmin(client)
  return NextResponse.json({ ready, rows: data })
}
