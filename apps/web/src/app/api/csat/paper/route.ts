// apps/web/src/app/api/csat/paper/route.ts
//
// POST /api/csat/paper  { sha256 }  → 그 회차의 **문항 번호 좌표**(글자 없음)
//
// 학습자가 떨어뜨린 문제지는 **서버로 오지 않는다.** 브라우저가 SHA-256 64자만 보내고, 우리는
// 해시로 회차를 찾아 커밋된 좌표 색인을 돌려준다. 브라우저가 그 좌표로 문항 글자를 뽑아
// 큰 글자로 다시 흘려 넣는다(`lib/csat/reflow`). 모르는 해시면 `known:false` — 브라우저가
// 그 자리에서 번호를 찾는 길(`detect.ts`)로 간다.
//
// 분석은 여기서 나가지 않는다 — 답을 고른 뒤 `/api/csat/session/reveal` 로만(지시문 A4).

import { NextResponse } from 'next/server'

import { anchorsBySha256 } from '@/lib/csat/overlay'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // 화면(`/csat/*` 보호 라우트)과 같은 문턱
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

  let sha256 = ''
  try {
    const body = (await req.json()) as { sha256?: unknown }
    sha256 = typeof body.sha256 === 'string' ? body.sha256 : ''
  } catch {
    return NextResponse.json({ ok: false, error: '본문이 JSON 이 아니다' }, { status: 400 })
  }
  // 64자 16진수만 — 이 값이 파일 이름으로 이어지는 길(`readAnchors`)의 입구다
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    return NextResponse.json({ ok: false, error: 'sha256 은 소문자 16진수 64자여야 한다' }, { status: 400 })
  }

  const hit = anchorsBySha256(sha256)
  if (!hit) return NextResponse.json({ ok: true, known: false }, { headers: { 'cache-control': 'no-store' } })

  // reflow 가 쓰는 부분만 — 선지 기호 좌표(marks)는 이 화면에 필요 없다
  return NextResponse.json(
    {
      ok: true,
      known: true,
      exam_id: hit.exam_id,
      anchors: {
        form_pages: hit.anchors.form_pages,
        items: hit.anchors.items.map(({ no, p, col, x, y, w, h }) => ({ no, p, col, x, y, w, h })),
      },
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
