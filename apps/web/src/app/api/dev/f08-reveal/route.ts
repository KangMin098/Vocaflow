// apps/web/src/app/api/dev/f08-reveal/route.ts
//
// F08 프로토타입의 정답·해설 공개. 첫 화면 응답에는 정답이 없고, 학습자가 공개를 고르면 이 경로가 준다.
// 제품 공개 경로(T-0140 강의 정답 공개 · T-0147 판단 장면 지연 조회)와 **별개**다 — 노출 원장을 쓰지 않는
// 프로토타입이라 계측·기록 없이 같은 「요청해야만 온다」 성질만 재현한다.

import { NextResponse } from 'next/server'

import { buildReveal } from '@/lib/csat/f08-proto/data'
import { f08ProtoOpen, parseFault } from '@/lib/csat/f08-proto/gate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!f08ProtoOpen()) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  let body: { itemId?: unknown; confirm?: unknown; fault?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const fault = parseFault(typeof body.fault === 'string' ? body.fault : null)
  if (fault === 'reveal-error') return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  if (fault === 'reveal-refused' || body.confirm !== true) {
    return NextResponse.json({ error: 'refused', reason: '공개 요청이 확인되지 않았다' }, { status: 403 })
  }
  const reveal = typeof body.itemId === 'string' ? buildReveal(body.itemId) : null
  if (!reveal) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ reveal }, { headers: { 'cache-control': 'no-store' } })
}
