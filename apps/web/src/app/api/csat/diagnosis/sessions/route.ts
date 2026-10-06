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
import { revealHeldResponse } from '@/lib/csat/embargo-gate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  const now = new Date()
  const body = parseExamPayload(await readJson(req), todayKst(now))
  if (!body) return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  try {
    // run 모드면 run 의 시험일 때만 참가자 플래그(다른 시험은 일반 기록 — DB 의 요청자 무관 보류는 그대로)
    const participant = await pilotOpen(ctx.userId, undefined, body.examId)
    const out = await submitExamSession(ctx.db, { ...body, userId: ctx.userId, enteredBy: 'learner', participant }, now)
    // 보류(참가자 capture 또는 그 시험의 요청자 무관 보류 — embargo-gate 판정은 submitExamSession 안)면 결과 없이
    // 관문 판정 실패 — 기록은 저장됐지만 결과를 열 수 없다: 공통 423(관문 실패를 보류 아님으로 삼키지 않는다)
    if (out.held && out.gateFailure) return revealHeldResponse()
    if (out.held) return NextResponse.json({ sessionId: out.sessionId, ready: out.ready, held: true }, { headers: { 'cache-control': 'no-store' } })
    return NextResponse.json(
      { sessionId: out.sessionId, raw: out.raw, grade: out.grade, ready: out.ready, snapshotId: out.snapshotId, wrong: out.wrong },
      { headers: { 'cache-control': 'no-store' } },
    )
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
