// apps/web/src/app/api/csat/factory/route.ts
//
// GET /api/csat/factory?template=ws.reading — 이 학습자의 그 Workspace 에 납품된 공장 DCP 지도 연습 목록(단계 1D).
// 학습자 본인 세션으로 factory_dcp_deliveries 를 부른다 — DB 가 소유 Workspace 를 auth.uid() 로 정한다(클라이언트 userId 없음).
// 응답 200 { status: 'installed', workspaceId, sources, items, rows } · 200 { status: 'not_installed' } · 400 · 401 · 502(조회 실패 · 모양 불일치).

import { NextResponse } from 'next/server'

import { listFactoryDeliveries } from '@/lib/csat/map/v62/factory-bridge/dcp-learning'
import type { SupplyClient } from '@/lib/csat/map/v62/factory-bridge/dcp-supply'
import { learnerContext } from '@/lib/csat/diagnosis/route-helpers'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'cache-control': 'no-store' }

export async function GET(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  const template = new URL(req.url).searchParams.get('template') ?? ''
  const r = await listFactoryDeliveries((await createClient()) as unknown as SupplyClient, template)
  if (r.ok) return NextResponse.json({ status: 'installed', ...r.list }, { headers: NO_STORE })
  if (r.code === 'not_installed') return NextResponse.json({ status: 'not_installed' }, { headers: NO_STORE })
  if (r.code === 'invalid_input') return NextResponse.json({ error: 'invalid', code: r.code }, { status: 400 })
  return NextResponse.json({ error: '목록을 불러오지 못했어요', code: r.code }, { status: 502, headers: NO_STORE })
}
