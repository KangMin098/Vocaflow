// apps/web/src/app/api/csat/ec/probes/route.ts
//
// GET /api/csat/ec/probes?session=<uuid> — 지금 띄울 추가 질문. 서버의 대기 목록(경계 관찰이 요구한 것)만 · 설정 taxonomy 만 · 세션 상한 안.
// 화면은 이 응답이 있을 때만 질문을 띄운다(화면이 경계를 판단하지 않는다). 응답에 경계 키 · 원인 이름은 없다 — 판 · 해시 · 학생 문구만.

import { NextResponse } from 'next/server'

import { ecContext, ownSession, pendingProbes } from '@/lib/csat/ec-pilot/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request) {
  const ctx = await ecContext()
  if (ctx instanceof NextResponse) return ctx
  const session = new URL(req.url).searchParams.get('session') ?? ''
  if (!UUID.test(session)) return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  try {
    if (!(await ownSession(ctx.admin, ctx.userId, session))) return NextResponse.json({ error: '기록을 찾지 못했어요' }, { status: 404 })
    return NextResponse.json({ probes: await pendingProbes(ctx, session) })
  } catch (e) {
    console.error('[csat-ec] probes', e)
    return NextResponse.json({ error: '불러오지 못했어요' }, { status: 500 })
  }
}
