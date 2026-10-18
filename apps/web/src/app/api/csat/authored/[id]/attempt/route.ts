// apps/web/src/app/api/csat/authored/[id]/attempt/route.ts
//
// POST /api/csat/authored/[id]/attempt — 납품받은 창작 자료 한 번의 풀이(FINAL §8).
// 본문 { response: { claim, support, relation, choice }, sec, clientSessionId, clientMutationId, answeredAt, helpLevel } (G2 기록 계약).
// 응답 200 { grade, reveal, binding } · 400 invalid_input · 403 not_delivered · 503 not_installed.
// 채점은 서버가 DB Gold 로 한다(클라이언트 판정 불신). 해설(reveal)은 응답 뒤에만 나간다.

import { NextResponse } from 'next/server'

import { AuthoredInputError, recordAuthoredAttempt } from '@/lib/csat/authored/server'
import { failure, learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS = { invalid_input: 400, not_delivered: 403, not_installed: 503 } as const

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  const { id } = await params
  if (!/^[a-z0-9][a-z0-9.-]{2,80}$/.test(id)) return NextResponse.json({ error: '자료를 찾지 못했어요' }, { status: 404 })
  try {
    const body = await readJson(req)
    const owner = (body as { ownerId?: unknown } | null)?.ownerId
    if (typeof owner === 'string' && owner !== ctx.userId) return NextResponse.json({ error: '다른 계정에서 시작한 제출이에요 — 화면을 새로 고쳐 주세요', code: 'invalid_input' }, { status: 409 })
    const r = await recordAuthoredAttempt(ctx.db, await createClient() as never, { id: ctx.userId, email: ctx.email }, `authored:${id}`, body, Date.now())
    return NextResponse.json(r)
  } catch (e) {
    if (e instanceof AuthoredInputError) return NextResponse.json({ error: e.message, code: e.code }, { status: STATUS[e.code] })
    return failure(e)
  }
}
