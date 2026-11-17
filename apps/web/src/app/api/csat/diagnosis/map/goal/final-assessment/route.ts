// apps/web/src/app/api/csat/diagnosis/map/goal/final-assessment/route.ts
//
// POST /api/csat/diagnosis/map/goal/final-assessment — 본인의 최신 목표 버전에 최종 평가(목표 시험 종류 · 응시일)를 한 번 정한다.
// 본문: { goalVersionId, date(YYYY-MM-DD · 목표를 정한 다음 날 ~ 목표일), clientKey(uuid) }.
// 200 { binding, reused } · 400 형식/범위 · 409 goal_changed · final_assessment_conflict · 503 final_assessment_not_installed.

import { NextResponse } from 'next/server'

import { failure, learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { isGoalVersionConflictError } from '@/lib/csat/map/v4/plan-store'
import { FinalAssessmentConflictError, FinalAssessmentInputError, FinalAssessmentUnavailableError, bindFinalAssessment } from '@/lib/csat/map/v62/final-assessment-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    return NextResponse.json(await bindFinalAssessment(ctx.db, ctx.userId, await readJson(req)))
  } catch (e) {
    if (isGoalVersionConflictError(e)) return NextResponse.json({ error: e.message, code: 'goal_changed' }, { status: 409 })
    if (e instanceof FinalAssessmentConflictError) return NextResponse.json({ error: e.message, code: 'final_assessment_conflict' }, { status: 409 })
    if (e instanceof FinalAssessmentUnavailableError) return NextResponse.json({ error: e.message, code: 'final_assessment_not_installed' }, { status: 503 })
    if (e instanceof FinalAssessmentInputError) return NextResponse.json({ error: e.message }, { status: 400 })
    return failure(e)
  }
}
