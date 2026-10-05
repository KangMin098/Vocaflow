// apps/web/src/app/api/csat/diagnosis/sessions/route.ts
//
// POST /api/csat/diagnosis/sessions — 학습자 본인의 시험 기록(OMR) 한 회.
// 본문: { examId, mode: live|retake, takenAt, totalMinutes?, clientKey, choices: {no: 1~5|null}, flags?: {no: unsure|guess|timeout} }
// 서버가 정답표로 채점 → 세션·응답을 한 트랜잭션으로 저장(clientKey 멱등) → 스냅샷을 쌓는다.
// 응답: { raw, grade, ready, snapshotId, wrong } — wrong = 틀린 문항 번호
// 오답 원인 Pilot 참가자(lib/csat/ec-pilot/config)는 { sessionId, ready, held: true } 만 — 증거 수집 뒤 /sessions/<id>/result 로 결과를 연다(화면 단계 보류).
// DELETE /api/csat/diagnosis/sessions?id=<uuid> — 본인 기록 한 회 삭제(되돌릴 수 없음)

import { NextResponse } from 'next/server'

import { parseExamPayload, todayKst } from '@/lib/csat/diagnosis/payload'
import { failure, learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { deleteExamSession, submitExamSession } from '@/lib/csat/diagnosis/server'
import { pilotOpen } from '@/lib/csat/ec-pilot/server'

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
    if (await pilotOpen(ctx.db, ctx.userId)) return NextResponse.json({ sessionId: out.sessionId, ready: out.ready, held: true })
    return NextResponse.json(out)
  } catch (e) {
    return failure(e)
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!UUID.test(id)) return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  try {
    const ok = await deleteExamSession(ctx.db, ctx.userId, id)
    // 이미 지워진 기록의 재시도도 성공 — 정리는 deleteExamSession 이 매번 마무리한다(멱등)
    return NextResponse.json({ ok: true, deleted: ok })
  } catch (e) {
    return failure(e)
  }
}
