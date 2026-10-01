// apps/web/src/app/api/csat/diagnosis/profile/route.ts
//
// POST /api/csat/diagnosis/profile — 진단 프로필(학년·목표·배경·주당 시간)을 새 이력 행으로 더한다.
// 덮어쓰지 않는다(csat_dx_profile_hist). 기존 기록이 있으면 목표가 바뀌었으니 스냅샷을 다시 쌓는다.

import { NextResponse } from 'next/server'

import { parseProfilePayload } from '@/lib/csat/diagnosis/payload'
import { failure, learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { recomputeSnapshot } from '@/lib/csat/diagnosis/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  const body = parseProfilePayload(await readJson(req))
  if (!body) return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  try {
    const { error } = await ctx.db.from('csat_dx_profile_hist').insert({
      user_id: ctx.userId,
      grade_level: body.gradeLevel,
      goal_type: body.goalType,
      goal_detail: body.goalDetail,
      background: body.background,
      weekly_hours: body.weeklyHours,
      entered_by: 'learner',
    })
    if (error) throw new Error(`프로필 저장 실패: ${error.message}`)
    const { count, error: ce } = await ctx.db.from('csat_dx_session').select('id', { count: 'exact', head: true }).eq('user_id', ctx.userId)
    if (ce) throw new Error(`기록 수 조회 실패: ${ce.message}`)
    if ((count ?? 0) > 0) await recomputeSnapshot(ctx.db, ctx.userId, 'profile', new Date())
    return NextResponse.json({ ok: true })
  } catch (e) {
    return failure(e)
  }
}
