// apps/web/src/app/api/csat/overlay/route.ts
//
// POST /api/csat/overlay  { sha256 }  → 그 회차의 좌표 + 우리 분석
//
// **평가원 문제지는 이 경로로 오지 않는다.** 브라우저가 파일을 그 자리에서 해시해 64자만 보낸다.
// 그래서 서버는 원본을 받지도, 저장하지도, 전달하지도 않는다 — 프록시를 두면 그 순간
// 「우리가 전송하는 것」이 되므로 두지 않는다.
//
// GET 이 아니라 POST 인 이유: 해시가 URL 에 남으면 접속 기록·리퍼러·공유 링크에 **어느 회차
// 문제지를 열었는지**가 따라다닌다. 학습 행동이라 본문에 둔다(캐시도 막는다).

import { NextResponse } from 'next/server'

import { anchorCatalog, loadOverlayBySha256 } from '@/lib/csat/overlay'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * **화면과 같은 문턱을 둔다.** `/csat/*` 는 보호 라우트인데(`lib/auth/protected-routes.ts`)
 * 이 경로만 열어 두면, 화면은 로그인 뒤인데 **API 는 아닌** 불일치가 남는다.
 *
 * 분석이 새지 않는 것은 이 검사가 아니라 RLS 가 지킨다(`csat_item_analyses` 는 authenticated
 * 에게 published 만). 실측 2026-09-13: 비로그인으로 부르면 문항 28개가 오는데 분석은 0이었다 —
 * 즉 막는 것은 이미 RLS 였고, 여기 두는 401 은 **표면을 화면과 맞추는 것**이다.
 */
async function requireLearner(): Promise<NextResponse | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  return null
}

/** 좌표를 가진 회차 목록 — 화면이 「받을 수 있는 것」을 미리 말할 수 있게 */
export async function GET() {
  const denied = await requireLearner()
  if (denied) return denied
  return NextResponse.json({ ok: true, ...anchorCatalog() }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(req: Request) {
  const denied = await requireLearner()
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: '본문이 JSON 이 아니다' }, { status: 400 })
  }

  const sha256 = typeof (body as { sha256?: unknown })?.sha256 === 'string' ? (body as { sha256: string }).sha256 : ''
  // 64자 16진수만 받는다. 이 값은 파일 이름으로도 쓰이므로 여기서 좁히지 않으면 경로 탈출이 된다
  // (`loadOverlayBySha256` 도 색인에 있는 회차만 열지만, 경계는 입구에서 한 번 더 긋는다).
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    return NextResponse.json({ ok: false, error: 'sha256 은 소문자 16진수 64자여야 한다' }, { status: 400 })
  }

  const { payload, error } = await loadOverlayBySha256(sha256)
  if (error) return NextResponse.json({ ok: false, error }, { status: 500 })

  // **모르는 파일은 오류가 아니다.** 학습자가 다른 과목·다른 연도를 떨어뜨린 것일 수 있고,
  // 그때 화면이 할 일은 「아직 이 회차는 좌표가 없어요」라고 말하는 것이다(404 로 하면
  // 브라우저 콘솔에 붉은 줄이 남고 화면은 원인을 말할 근거를 잃는다).
  if (!payload) {
    return NextResponse.json(
      { ok: true, known: false, ...anchorCatalog() },
      { headers: { 'cache-control': 'no-store' } },
    )
  }

  return NextResponse.json({ ok: true, known: true, ...payload }, { headers: { 'cache-control': 'no-store' } })
}
