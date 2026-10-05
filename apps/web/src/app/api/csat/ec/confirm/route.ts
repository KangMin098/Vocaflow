// apps/web/src/app/api/csat/ec/confirm/route.ts
//
// POST /api/csat/ec/confirm — { sessionId, tookExam, judgedEach } → csat_ec_confirm_session(쿠키 클라이언트).
// 같은 답안 · 같은 확인의 재전송은 DB 가 같은 revision 을 돌려준다(20261005150000).

import { NextResponse } from 'next/server'

import { readJson } from '@/lib/csat/diagnosis/route-helpers'
import { ecContext, ownSession } from '@/lib/csat/ec-pilot/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  const ctx = await ecContext()
  if (ctx instanceof NextResponse) return ctx
  const b = (await readJson(req)) as { sessionId?: unknown; tookExam?: unknown; judgedEach?: unknown } | null
  if (!b || typeof b.sessionId !== 'string' || !UUID.test(b.sessionId) || typeof b.tookExam !== 'boolean' || typeof b.judgedEach !== 'boolean' || (!b.tookExam && b.judgedEach))
    return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  try {
    if (!(await ownSession(ctx.admin, ctx.userId, b.sessionId))) return NextResponse.json({ error: '기록을 찾지 못했어요' }, { status: 404 })
    const { data, error } = await ctx.rls.rpc('csat_ec_confirm_session', { p_session: b.sessionId, p_took_exam: b.tookExam, p_judged_each: b.judgedEach })
    if (error) throw new Error(error.message)
    return NextResponse.json({ revision: data })
  } catch (e) {
    console.error('[csat-ec] confirm', e)
    return NextResponse.json({ error: '저장하지 못했어요' }, { status: 500 })
  }
}
