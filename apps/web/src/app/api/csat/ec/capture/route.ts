// apps/web/src/app/api/csat/ec/capture/route.ts
//
// GET /api/csat/ec/capture?session=<uuid> — 오답 원인 Pilot 참가자의 증거 수집 대상 · 원문 · 저장 상태.
// 정오(맞음/틀림)는 내보내지 않는다(대상 = 오답 + 설정의 정답 대조, 번호순). 참가자가 아니면 404.

import { NextResponse } from 'next/server'

import { ecContext, loadCapture } from '@/lib/csat/ec-pilot/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request) {
  const ctx = await ecContext()
  if (ctx instanceof NextResponse) return ctx
  const session = new URL(req.url).searchParams.get('session') ?? ''
  if (!UUID.test(session)) return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  try {
    const state = await loadCapture(ctx, session)
    if (!state) return NextResponse.json({ error: '기록을 찾지 못했어요' }, { status: 404 })
    return NextResponse.json(state)
  } catch (e) {
    console.error('[csat-ec] capture', e)
    return NextResponse.json({ error: '불러오지 못했어요' }, { status: 500 })
  }
}
