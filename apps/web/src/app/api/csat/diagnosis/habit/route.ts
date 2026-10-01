// apps/web/src/app/api/csat/diagnosis/habit/route.ts
//
// POST /api/csat/diagnosis/habit — 습관 신호에 「맞아요/아니에요」. 본문: { snapshotId, habitCode, agreed }
// 본인 스냅샷에 실제로 뜬 신호만 받는다. 다시 누르면 답을 바꾼다(snapshot·habit 당 한 행).

import { NextResponse } from 'next/server'

import type { HabitFlag } from '@/lib/csat/diagnosis/engine/types'
import { failure, learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  const body = (await readJson(req)) as { snapshotId?: unknown; habitCode?: unknown; agreed?: unknown } | null
  if (!body || typeof body.snapshotId !== 'string' || !UUID.test(body.snapshotId) || typeof body.habitCode !== 'string' || typeof body.agreed !== 'boolean') {
    return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  }
  try {
    const { data: snap, error } = await ctx.db.from('csat_dx_snapshot').select('habit_flags')
      .eq('id', body.snapshotId).eq('user_id', ctx.userId).maybeSingle()
    if (error) throw new Error(`스냅샷 조회 실패: ${error.message}`)
    const flags = (snap?.habit_flags ?? []) as HabitFlag[]
    if (!snap || !flags.some((f) => f.code === body.habitCode)) {
      return NextResponse.json({ error: '이 진단에 없는 신호예요' }, { status: 400 })
    }
    const { error: ue } = await ctx.db.from('csat_dx_habit_feedback').upsert(
      { snapshot_id: body.snapshotId, habit_code: body.habitCode, user_id: ctx.userId, agreed: body.agreed, answered_at: new Date().toISOString() },
      { onConflict: 'snapshot_id,habit_code' },
    )
    if (ue) throw new Error(`응답 저장 실패: ${ue.message}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return failure(e)
  }
}
