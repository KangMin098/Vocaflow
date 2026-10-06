// apps/web/src/app/api/csat/state/route.ts
//
// GET /api/csat/state → 내 해부 기록(DissectionRecord v1) 또는 null
// PUT /api/csat/state { record } → 서버 사본과 **항목 단위로 합쳐** 저장(`continuity.mergeDissection`)
//   통째로 덮으면 탭 둘 · 기기 둘 중 늦게 쓴 쪽이 다른 쪽의 학습을 지운다(2026-09-25 시나리오 C3 에서 실측).
//
// 기기(IndexedDB)가 먼저다. 이 경로가 막히거나 표가 아직 없어도 학습은 기기 기록으로 돈다 —
// 그래서 실패는 전부 `ok:false` 한 줄로 돌려주고, 부르는 쪽은 조용히 기기 기록을 쓴다.
//
// Reveal Gate(2026-10-06): 로그인 확인은 쿠키 클라이언트로, 읽기 · 쓰기는 **서버(service role)** 로 한다 —
// ②(20261005170100)가 csat_learner_state 의 학습자 직접 읽기 · 쓰기를 회수한다. 행은 언제나 로그인한 본인(user.id)의 것만 만진다.
// GET 은 보류 시험(오답 원인 Pilot 수집 중) 문항의 정오 칸(예측 · 초안)을 빼고 내보낸다(embargo-gate · 판정 실패면 전부 뺀다).

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { correctnessItemIds, mergeDissection, withoutHeldCorrectness } from '@/lib/csat/continuity'
import type { DissectionRecord } from '@/lib/csat/dissect'
import { itemRevealDecision, revealHeldResponse } from '@/lib/csat/embargo-gate'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 900_000
const NO_STORE = { 'cache-control': 'no-store' }

async function session() {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  // `Database` 타입에 새 표가 아직 없다 — record/route.ts 와 같은 완화(한 줄)
  return { db: user ? (createAdminClient() as unknown as SupabaseClient) : null, user }
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
  if (!user || !db) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  const { data, error } = await db.from('csat_learner_state').select('record').eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 503, headers: NO_STORE })
  const record = (data as { record: unknown } | null)?.record ?? null
  if (record === null) return NextResponse.json({ ok: true, record: null }, { headers: NO_STORE })
  // 모양을 검증할 수 없는 기록은 거를 수도 없다 — 원문을 내지 않고 공통 423(fail-closed)
  if (!looksLikeRecord(record)) return revealHeldResponse()
  const rec = record as unknown as DissectionRecord
  const { held, failed } = await itemRevealDecision(correctnessItemIds(rec))
  // 관문 판정 실패 — 기록을 내보내지 않고 공통 423(기기 기록으로 계속 돈다)
  if (failed) return revealHeldResponse()
  return NextResponse.json({ ok: true, record: held.size ? withoutHeldCorrectness(rec, (id) => held.has(id)) : rec }, { headers: NO_STORE })
}

export async function PUT(req: Request) {
  const { db, user } = await session()
  if (!user || !db) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
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
  // 합집합 병합 — 보류로 빠진 채 돌아온 기록이 서버 사본의 항목을 지우지 않는다. 응답에는 기록을 싣지 않는다
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
  if (!user || !db) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  const { error } = await db.from('csat_learner_state').delete().eq('user_id', user.id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 503 })
  return NextResponse.json({ ok: true })
}
