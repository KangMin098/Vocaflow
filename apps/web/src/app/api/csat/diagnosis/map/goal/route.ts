// apps/web/src/app/api/csat/diagnosis/map/goal/route.ts
//
// PUT /api/csat/diagnosis/map/goal — 학습자 본인의 목표 점수(0~100 정수). 본문: { target }. 응답: { goal }

import { NextResponse } from 'next/server'

import { failure, learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { MapInputError, setGoal } from '@/lib/csat/map/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PUT(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    return NextResponse.json(await setGoal(ctx.db, ctx.userId, await readJson(req)))
  } catch (e) {
    if (e instanceof MapInputError) return NextResponse.json({ error: e.message }, { status: 400 })
    return failure(e)
  }
}
