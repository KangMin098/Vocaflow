// apps/web/src/app/api/csat/item/[slug]/task/route.ts
//
// POST /api/csat/item/[slug]/task — 문항의 확인 과제 응답 한 건(Phase 3 · 과제 종류는 item-tasks 레지스트리 — 주장과 근거 · 이어 주는 단서).
// 거부(400)는 { error, code } — code: no_task(주석 없음) · not_live(적용이 켜져 있지 않음 — 노출 게이트) · invalid_input(답 형식).
// 본문: { response: { claim, support[], relation }, sec }. 응답: { grade, attempts }.
// userId 는 세션에서만 온다(learnerContext). 채점 · 게이트(채택 사슬 · 적용 active · 주석 서명)는 서버가 한다.
// 쓰기는 service_role 로만 — 학습자 키는 learning_task_attempts 에 쓰기 권한이 없다(본인 SELECT 만).

import { NextResponse } from 'next/server'

import { failure, learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { fromItemSlug } from '@/lib/csat/item-slug'
import { TaskInputError, recordItemTaskAttempt } from '@/lib/knowledge/product-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  const { slug } = await params
  if (!/^[A-Za-z0-9]+-\d{1,2}$/.test(slug)) return NextResponse.json({ error: '문항을 찾지 못했어요' }, { status: 404 })
  try {
    const body = (await readJson(req)) as { response?: unknown; sec?: unknown } | null
    return NextResponse.json(await recordItemTaskAttempt(ctx.db, ctx.userId, fromItemSlug(slug), body?.response, body?.sec))
  } catch (e) {
    if (e instanceof TaskInputError) return NextResponse.json({ error: e.message, code: e.code }, { status: 400 })
    return failure(e)
  }
}
