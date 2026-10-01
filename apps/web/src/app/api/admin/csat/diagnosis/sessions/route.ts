// apps/web/src/app/api/admin/csat/diagnosis/sessions/route.ts
//
// POST /api/admin/csat/diagnosis/sessions — 관리자 대리 입력(entered_by=admin).
// 본문: 학습자용과 같은 시험 기록 + userId. 대상 학습자가 실제로 있어야 한다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { parseExamPayload, todayKst } from '@/lib/csat/diagnosis/payload'
import { failure, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { deleteExamSession, submitExamSession } from '@/lib/csat/diagnosis/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  const raw = (await readJson(req)) as { userId?: unknown } | null
  const now = new Date()
  const body = parseExamPayload(raw, todayKst(now))
  if (!body || typeof raw?.userId !== 'string' || !UUID.test(raw.userId)) {
    return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  }
  const db = createAdminClient() as unknown as SupabaseClient
  try {
    const { data: target, error } = await db.auth.admin.getUserById(raw.userId)
    if (error || !target?.user) return NextResponse.json({ error: '없는 학습자예요' }, { status: 404 })
    const out = await submitExamSession(db, { ...body, userId: raw.userId, enteredBy: 'admin' }, now)
    return NextResponse.json(out)
  } catch (e) {
    return failure(e)
  }
}

/** DELETE ?userId=&id= — 관리자가 학습자 기록 한 회를 지운다(되돌릴 수 없음) */
export async function DELETE(req: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  const q = new URL(req.url).searchParams
  const userId = q.get('userId') ?? ''
  const id = q.get('id') ?? ''
  if (!UUID.test(userId) || !UUID.test(id)) return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  try {
    const ok = await deleteExamSession(createAdminClient() as unknown as SupabaseClient, userId, id)
    // 이미 지워진 기록의 재시도도 성공 — 정리는 deleteExamSession 이 매번 마무리한다(멱등)
    return NextResponse.json({ ok: true, deleted: ok })
  } catch (e) {
    return failure(e)
  }
}
