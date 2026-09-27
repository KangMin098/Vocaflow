// apps/web/src/app/api/csat/state/route.ts
//
// GET /api/csat/state → 내 해부 기록(DissectionRecord v1) 또는 null
// PUT /api/csat/state { record } → 서버 사본과 **항목 단위로 합쳐** 저장(`continuity.mergeDissection`)
//   통째로 덮으면 탭 둘 · 기기 둘 중 늦게 쓴 쪽이 다른 쪽의 학습을 지운다(2026-09-25 시나리오 C3 에서 실측).
//
// 기기(IndexedDB)가 먼저다. 이 경로가 막히거나 표가 아직 없어도 학습은 기기 기록으로 돈다 —
// 그래서 실패는 전부 `ok:false` 한 줄로 돌려주고, 부르는 쪽은 조용히 기기 기록을 쓴다.
// 읽기 · 쓰기 모두 로그인 쿠키를 따르는 클라이언트(RLS: 본인 행만).

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { mergeDissection } from '@/lib/csat/continuity'
import type { DissectionRecord } from '@/lib/csat/dissect'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 900_000

async function session() {
  // `Database` 타입에 새 표가 아직 없다 — record/route.ts 와 같은 완화(한 줄)
  const db = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await db.auth.getUser()
  return { db, user }
}

/** 모양만 본다 — 내용 규칙은 코드(continuity)에 있다. 원문이 실릴 자리는 없다. */
function looksLikeRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const r = value as Record<string, unknown>
  return (
    r.version === 1 &&
    Array.isArray(r.predictions) &&
    Array.isArray(r.formulas) &&
    Array.isArray(r.queue) &&
    Array.isArray(r.completed) &&
    typeof r.seed === 'number' &&
    typeof r.onboarded === 'boolean'
  )
}

export async function GET() {
  const { db, user } = await session()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  const { data, error } = await db.from('csat_learner_state').select('record').eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 503 })
  return NextResponse.json({ ok: true, record: (data as { record: unknown } | null)?.record ?? null }, { headers: { 'cache-control': 'no-store' } })
}

export async function PUT(req: Request) {
  const { db, user } = await session()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  const text = await req.text()
  if (text.length > MAX_BYTES) return NextResponse.json({ ok: false, error: 'too-large' }, { status: 413 })
  let record: unknown
  try {
    record = (JSON.parse(text) as { record?: unknown }).record
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 })
  }
  if (!looksLikeRecord(record)) return NextResponse.json({ ok: false, error: 'bad-record' }, { status: 400 })
  const current = await db.from('csat_learner_state').select('record').eq('user_id', user.id).maybeSingle()
  if (current.error) return NextResponse.json({ ok: false, error: current.error.message }, { status: 503 })
  const existing = (current.data as { record: unknown } | null)?.record
  const merged = looksLikeRecord(existing)
    ? mergeDissection(record as unknown as DissectionRecord, existing as unknown as DissectionRecord)
    : record
  const { error } = await db
    .from('csat_learner_state')
    .upsert({ user_id: user.id, record: merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 503 })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const { db, user } = await session()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  const { error } = await db.from('csat_learner_state').delete().eq('user_id', user.id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 503 })
  return NextResponse.json({ ok: true })
}
