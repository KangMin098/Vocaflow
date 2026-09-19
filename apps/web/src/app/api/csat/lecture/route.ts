// apps/web/src/app/api/csat/lecture/route.ts
//
// GET /api/csat/lecture?item=2026-30  → 그 문항의 강의 대본(큐 목록)
//
// **대본은 이 길로만 나간다.** 해설 화면의 서버 렌더에는 길이(초)만 싣고, 학습자가 재생을
// 누른 뒤에 여기서 받는다 — 화면 HTML 에 대본이 남지 않게(지시문 A1 · F2).
// 문항 화면과 같은 문턱(로그인)을 둔다.

import { NextResponse } from 'next/server'

import { fromItemSlug } from '@/lib/csat/item-slug'
import { loadLecture } from '@/lib/csat/lecture/store'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

  const slug = new URL(req.url).searchParams.get('item') ?? ''
  // 슬러그 모양만 받는다(`2026-30` · `M2509-33`) — 이 값이 파일 이름으로 흘러가기 때문이다
  if (!/^[A-Za-z0-9_]{1,16}-\d{1,2}$/.test(slug)) {
    return NextResponse.json({ ok: false, error: 'item 이 문항 슬러그 모양이 아니다' }, { status: 400 })
  }
  const lecture = loadLecture(fromItemSlug(slug))
  if (!lecture) return NextResponse.json({ ok: false, error: '이 문항에는 아직 강의가 없어요' }, { status: 404 })
  return NextResponse.json({ ok: true, lecture }, { headers: { 'cache-control': 'no-store' } })
}
