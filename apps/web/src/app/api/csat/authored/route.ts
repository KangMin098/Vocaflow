// apps/web/src/app/api/csat/authored/route.ts
//
// GET /api/csat/authored?task=r.central_meaning — 이 학습자의 창작 자료 납품 목록(역할 · 풀었나 · 근거로 셌나). FINAL §8.
// 응답 200 { status: 'installed', rows } · 200 { status: 'not_installed' }(창작 공급 SQL 미적용 — 화면은 「준비 중」).
// 학습자 세션으로 읽는다(RLS 본인 행) — 다른 사람의 납품은 보이지 않는다.

import { NextResponse } from 'next/server'

import { listDelivered } from '@/lib/csat/authored/server'
import { failure, learnerContext } from '@/lib/csat/diagnosis/route-helpers'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  const task = new URL(req.url).searchParams.get('task') ?? ''
  if (!/^[a-z]\.[a-z_]{2,60}$/.test(task)) return NextResponse.json({ error: 'invalid', code: 'invalid_input' }, { status: 400 })
  try {
    const rows = await listDelivered(await createClient() as never, ctx.userId, task)
    if (rows === 'not_installed') return NextResponse.json({ status: 'not_installed' }, { headers: { 'cache-control': 'no-store' } })
    return NextResponse.json({ status: 'installed', rows }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return failure(e)
  }
}
