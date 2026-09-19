// apps/web/src/app/api/csat/session/reveal/route.ts
//
// POST /api/csat/session/reveal  { item: '2026-31' }  → 정답 · 해설 · 근거 자리
//
// **답을 고른 뒤에만 부른다.** 세션 화면은 제출 전까지 이 데이터를 갖고 있지 않다 — 숨기는 것이
// 아니라 **없다**(지시문 A4 · docs/csat-learner/DECISIONS.md D9).
//
// 무엇을 골랐는지는 받지 않는다 — 채점은 브라우저가 받은 정답으로 하고, 기록은 기기에 남는다(D7).
// 받지 않는 것을 받는 척하지 않는다.

import { NextResponse } from 'next/server'

import { fromItemSlug } from '@/lib/csat/item-slug'
import { loadReveal } from '@/lib/csat/session/reveal'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

  let slug = ''
  try {
    const body = (await req.json()) as { item?: unknown }
    slug = typeof body.item === 'string' ? body.item : ''
  } catch {
    return NextResponse.json({ ok: false, error: '본문이 JSON 이 아니다' }, { status: 400 })
  }
  // 슬러그 모양만(`2026-31` · `M2509-33`) — 회차 id 가 골격 파일 이름으로 이어진다
  if (!/^[A-Za-z0-9_]{1,16}-\d{1,2}$/.test(slug)) {
    return NextResponse.json({ ok: false, error: 'item 이 문항 슬러그 모양이 아니다' }, { status: 400 })
  }

  const { payload, error } = await loadReveal(fromItemSlug(slug))
  if (error) return NextResponse.json({ ok: false, error }, { status: 500 })
  if (!payload) return NextResponse.json({ ok: false, error: '없는 문항이에요' }, { status: 404 })
  return NextResponse.json({ ok: true, ...payload }, { headers: { 'cache-control': 'no-store' } })
}
