// apps/web/src/app/api/csat/diagnosis/map/goal/route.ts
//
// PUT /api/csat/diagnosis/map/goal — 학습자 본인의 목표. 본문: { target(0~100 · 필수), grade?(1~9), exam?(suneung|kice6|kice9|hakpyeong), date?(YYYY-MM-DD · 오늘 이후), clientKey? }.
// 응답 200 { goal, grade, exam, date, mode, goalVersionId, reused } · 400 형식 · 409 같은 요청키에 다른 본문(LM-G1.3a)

import { NextResponse } from 'next/server'

import { failure, learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { GoalConflictError, MapInputError, setGoal } from '@/lib/csat/map/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PUT(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    return NextResponse.json(await setGoal(ctx.db, ctx.userId, await readJson(req), new Date()))
  } catch (e) {
    if (e instanceof MapInputError) return NextResponse.json({ error: e.message }, { status: 400 })
    if (e instanceof GoalConflictError) return NextResponse.json({ error: e.message, code: 'client_key_reused' }, { status: 409 })
    return failure(e)
  }
}
