// apps/web/src/app/api/pdcp/retry/route.ts
//
// 재시도 — 실패 표시(`last_error`)만 지운다. 단계(status)는 그대로 두므로
// 드레인이 **멈춘 바로 그 지점부터** 다시 이어간다.
//
// 왜 별도 엔드포인트인가: 실패 원인의 대부분은 코드가 아니라 환경(ffmpeg 부재·소스 차단)이고,
// 고친 뒤 한 번에 전부 되살리는 동작이 필요하다. 드레인 안에 자동 재시도를 넣으면
// 원인이 그대로인 상태에서 같은 실패를 무한 반복한다.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  let body: { issueId?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const client = createAdminClient() as unknown as SupabaseClient
  let q = client.from('pd_comic_issues').update({ last_error: null }).not('last_error', 'is', null)
  if (body.issueId) q = q.eq('id', body.issueId)

  const { data, error } = await q.select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cleared: (data ?? []).length })
}
