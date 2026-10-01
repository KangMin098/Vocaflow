// apps/web/src/app/api/csat/diagnosis/sessions/route.ts
//
// POST /api/csat/diagnosis/sessions — 학습자 본인의 시험 기록(OMR) 한 회.
// 본문: { examId, mode: live|retake, takenAt, totalMinutes?, clientKey, choices: {no: 1~5|null}, flags?: {no: unsure|guess|timeout} }
// 서버가 정답표로 채점 → 세션·응답을 한 트랜잭션으로 저장(clientKey 멱등) → 스냅샷을 쌓는다.
// 응답: { raw, grade, ready, snapshotId } — ready=false 면 「점수만 반영」 안내를 띄운다.

import { NextResponse } from 'next/server'

import { parseExamPayload, todayKst } from '@/lib/csat/diagnosis/payload'
import { failure, learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { submitExamSession } from '@/lib/csat/diagnosis/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  const now = new Date()
  const body = parseExamPayload(await readJson(req), todayKst(now))
  if (!body) return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  try {
    const out = await submitExamSession(ctx.db, { ...body, userId: ctx.userId, enteredBy: 'learner' }, now)
    return NextResponse.json(out)
  } catch (e) {
    return failure(e)
  }
}
