// apps/web/src/app/api/csat/ec/capture/route.ts
//
// GET  /api/csat/ec/capture?session=<uuid> — 오답 원인 Pilot 참가자의 증거 수집 대상 · 원문 · 저장 상태.
//      대상은 저장 때 봉인된 capture 대상(정오 무관)이다. 정오(맞음/틀림)는 내보내지 않는다. 참가자가 아니면 404.
//      처음 열면 수집 상태가 held → collecting 으로 바뀐다(보류는 그대로).
// POST /api/csat/ec/capture { session, action: 'finish' } — 수집을 끝낸다(collecting → completed). 끝나야 그 시험의 보류가 풀린다.
//      확인 · 해석이 빠졌으면 끝내지 않고 { status: 'collecting', missing, remaining? } 를 돌려준다.

import { NextResponse } from 'next/server'

import { ecContext, finishCapture, loadCapture } from '@/lib/csat/ec-pilot/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  const ctx = await ecContext()
  if (ctx instanceof NextResponse) return ctx
  const session = new URL(req.url).searchParams.get('session') ?? ''
  if (!UUID.test(session)) return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  try {
    const state = await loadCapture(ctx, session)
    if (!state) return NextResponse.json({ error: '기록을 찾지 못했어요' }, { status: 404 })
    return NextResponse.json(state, { headers: NO_STORE })
  } catch (e) {
    console.error('[csat-ec] capture', e)
    return NextResponse.json({ error: '불러오지 못했어요' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const ctx = await ecContext()
  if (ctx instanceof NextResponse) return ctx
  const body = (await req.json().catch(() => null)) as { session?: unknown; action?: unknown } | null
  const session = typeof body?.session === 'string' ? body.session : ''
  if (!UUID.test(session) || body?.action !== 'finish') return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  try {
    const r = await finishCapture(ctx, session)
    if (!r) return NextResponse.json({ error: '기록을 찾지 못했어요' }, { status: 404 })
    return NextResponse.json(r, { headers: NO_STORE })
  } catch (e) {
    console.error('[csat-ec] capture finish', e)
    return NextResponse.json({ error: '마치지 못했어요. 잠시 뒤 다시 시도해 주세요' }, { status: 500 })
  }
}
