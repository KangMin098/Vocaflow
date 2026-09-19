// apps/web/src/app/api/pdcp/panels/route.ts
//
// 이슈 하나의 컷 콘텐츠(대사/OCR) 조회 — 테스트·모니터 탭 드릴다운.
// pd_comic_panels 는 발행 게이트 RLS 라 학습자 경로로는 못 읽는다 → admin(service-role) 세션 전용.
// 발행 전 이슈의 "지금 어떤 콘텐츠가 어떻게 됐나"(컷 수·대사 추출 상태)를 보기 위함.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { selectPdPanelsAdmin } from '@/lib/pd-comic/queries'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const { searchParams } = new URL(request.url)
  const issueId = searchParams.get('issueId')
  if (!issueId) return NextResponse.json({ error: 'issueId 가 필요합니다' }, { status: 400 })

  const client = createAdminClient() as unknown as SupabaseClient
  const { ready, data } = await selectPdPanelsAdmin(client, issueId)
  return NextResponse.json({ ready, panels: data })
}
