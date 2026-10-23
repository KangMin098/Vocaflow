// apps/web/src/app/api/csat/lecture/route.ts
//
// GET /api/csat/lecture?item=2026-30              → 그 문항의 강의 대본(큐 목록, 전체 — 정답 포함)
// GET /api/csat/lecture?item=2026-30&scope=until  → 검증된 「직접 정답 공개」 경계 직전까지의 cue 만
//
// **범위는 서버가 자른다.** until 은 경계 뒤 cue 를 응답에 아예 싣지 않는다 — 대본 탭 · 음성 · 강조 · 소거 표시가
// 같은 범위만 안다. 경계가 검증되지 않았거나(데이터 없음) 대본이 검수 뒤 바뀌었으면(결속 불일치) 409 — 안전 구간을
// 추정해 잘라 주지 않는다. 화면은 그때 전체 강의의 공개 위험을 알리고 학습자가 다시 고르게 한다.
// ⚠️ UI 의 정답 미표시 계약이지 보안 경계가 아니다 — 같은 학습자가 scope 없이 전체를 받을 수 있다.
//
// **대본은 이 길로만 나간다.** 해설 화면의 서버 렌더에는 길이(초)만 싣고, 학습자가 재생을
// 누른 뒤에 여기서 받는다 — 화면 HTML 에 대본이 남지 않게(지시문 A1 · F2).
// 문항 화면과 같은 문턱(로그인)을 둔다.

import { NextResponse } from 'next/server'

import { canRevealItem, revealHeldResponse } from '@/lib/csat/embargo-gate'
import { fromItemSlug } from '@/lib/csat/item-slug'
import { lectureDisclosure, lectureUntil } from '@/lib/csat/lecture/disclosure'
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
  // 보류 시험 문항이면 대본(정답 · 해설)을 읽기 전에 멈춘다 — 계약: 423 · { held } · no-store
  if (!(await canRevealItem(fromItemSlug(slug)))) return revealHeldResponse()
  const scope = new URL(req.url).searchParams.get('scope')
  if (scope != null && scope !== 'until' && scope !== 'full') {
    return NextResponse.json({ ok: false, error: 'scope 는 until 또는 full' }, { status: 400 })
  }
  const itemId = fromItemSlug(slug)
  const lecture = loadLecture(itemId)
  if (!lecture) return NextResponse.json({ ok: false, error: '이 문항에는 아직 강의가 없어요' }, { status: 404 })
  if (scope === 'until') {
    const d = lectureDisclosure(itemId, lecture)
    if (!d.verified) {
      return NextResponse.json(
        { ok: false, error: '이 강의는 정답 공개 지점이 검증되지 않았어요', disclosure: { scope: 'until', verified: false, reason: d.reason } },
        { status: 409, headers: { 'cache-control': 'no-store' } },
      )
    }
    return NextResponse.json(
      { ok: true, lecture: lectureUntil(lecture, d.stopBefore), disclosure: { scope: 'until', verified: true, stopBefore: d.stopBefore, preStopRisk: d.preStopRisk } },
      { headers: { 'cache-control': 'no-store' } },
    )
  }
  return NextResponse.json({ ok: true, lecture, disclosure: { scope: 'full' } }, { headers: { 'cache-control': 'no-store' } })
}
