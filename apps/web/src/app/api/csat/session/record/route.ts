// apps/web/src/app/api/csat/session/record/route.ts
//
// GET  /api/csat/session/record → 내 풀이 기록(최근 1,000건)
// POST /api/csat/session/record { attempts } → 새 풀이를 올리고 복습 큐를 다시 계산해 둔다
//
// 기기(IndexedDB)가 먼저 쓰고 여기로 올린다 — 서버가 느리거나 막혀도 세션은 돈다.
// 복습 큐는 받지 않는다: 합친 풀이 기록을 시간순으로 다시 돌려 **서버가** 만든다(`sync.ts`).
// 읽기·쓰기 모두 로그인 쿠키를 따르는 클라이언트(RLS: 본인 행만)로 한다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import type { Attempt } from '@/lib/csat/session/model'
import { cleanAttempts, mergeAttempts, replayReviews } from '@/lib/csat/session/sync'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Row = { item_id: string; type_id: string; correct: boolean | null; confused: boolean; sec: number; answered_at: string }
const toAttempt = (r: Row): Attempt => ({
  item_id: r.item_id,
  type_id: r.type_id,
  correct: r.correct,
  confused: r.confused,
  sec: r.sec,
  at: new Date(r.answered_at).toISOString(),
})

async function session() {
  // `Database` 타입에 새 표가 아직 없다 — `learner.ts` 와 같은 완화(한 줄)
  const db = (await createClient()) as unknown as SupabaseClient
  const {
    data: { user },
  } = await db.auth.getUser()
  return { db, user }
}

async function readAttempts(db: SupabaseClient, userId: string): Promise<Attempt[]> {
  const { data, error } = await db
    .from('csat_session_attempts')
    .select('item_id, type_id, correct, confused, sec, answered_at')
    .eq('user_id', userId)
    .order('answered_at', { ascending: false })
    .limit(1000)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Row[]).map(toAttempt).reverse()
}

export async function GET() {
  const { db, user } = await session()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, attempts: await readAttempts(db, user.id) }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

/** 내 기록 전부 지우기(기록 초기화 · 게이트 하네스). RLS 가 본인 행만 지운다. */
export async function DELETE() {
  const { db, user } = await session()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  const [a, b] = await Promise.all([
    db.from('csat_session_attempts').delete().eq('user_id', user.id),
    db.from('csat_review_queue').delete().eq('user_id', user.id),
  ])
  const err = a.error ?? b.error
  if (err) return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: Request) {
  const { db, user } = await session()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

  let incoming: Attempt[] = []
  try {
    incoming = cleanAttempts(((await req.json()) as { attempts?: unknown }).attempts)
  } catch {
    return NextResponse.json({ ok: false, error: '본문이 JSON 이 아니다' }, { status: 400 })
  }

  try {
    if (incoming.length) {
      const { error } = await db.from('csat_session_attempts').upsert(
        incoming.map((a) => ({
          user_id: user.id,
          item_id: a.item_id,
          type_id: a.type_id,
          correct: a.correct,
          confused: a.confused,
          sec: a.sec,
          answered_at: a.at,
        })),
        { onConflict: 'user_id,item_id,answered_at', ignoreDuplicates: true },
      )
      if (error) throw new Error(error.message)
    }

    // 복습 큐 — 합친 기록을 다시 돌린 결과로 **통째로** 맞춘다(졸업한 행은 지운다)
    const all = mergeAttempts(await readAttempts(db, user.id), incoming)
    const reviews = replayReviews(all)
    const keep = reviews.map((r) => r.item_id)
    const del = db.from('csat_review_queue').delete().eq('user_id', user.id)
    const { error: delErr } = keep.length ? await del.not('item_id', 'in', `(${keep.map((k) => `"${k}"`).join(',')})`) : await del
    if (delErr) throw new Error(delErr.message)
    if (reviews.length) {
      const { error } = await db.from('csat_review_queue').upsert(
        reviews.map((r) => ({
          user_id: user.id,
          item_id: r.item_id,
          type_id: r.type_id,
          due_at: r.due,
          stage: r.stage,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'user_id,item_id' },
      )
      if (error) throw new Error(error.message)
    }
    return NextResponse.json({ ok: true, saved: incoming.length, reviews: reviews.length })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
