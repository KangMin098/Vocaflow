// apps/web/src/app/api/csat/delivery/bind/route.ts
//
// POST /api/csat/delivery/bind — 결속되지 않은 수행 기록을 학습자가 **명시한 납품**에 나중에 결속한다(FI-001 복구 경로).
// 본문 { kind: 'csat_item' | 'authored_item', itemRef, clientMutationId, deliveryId }.
// 쓰임: 풀이 직후 결속이 no_provenance · role_mismatch · error 로 끝났을 때(기록은 이미 남았다) 화면이 올바른 납품을 골라 다시 부른다.
// 판정은 일반 결속과 같다(bindDeliveryAttempt — 본인 납품 · 같은 문항 · Workspace active · 시도 모양 ↔ 역할 · DB 근거 판정).
// 같은 제출의 결속이 이미 있으면 그 결과를 돌려준다(다른 납품으로 옮기지 않는다 — 결속 이력은 불변).
// 응답 200 { binding } · 400 invalid_input.

import { NextResponse } from 'next/server'

import { failure, learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { bindDeliveryAttempt } from '@/lib/csat/map/v62/delivery-binding'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    const b = (await readJson(req)) as Record<string, unknown> | null
    const kind = b?.kind === 'authored_item' ? 'authored_item' : b?.kind === 'csat_item' ? 'csat_item' : null
    const itemRef = typeof b?.itemRef === 'string' && b.itemRef.length <= 120 ? b.itemRef : null
    const cmid = typeof b?.clientMutationId === 'string' && UUID.test(b.clientMutationId) ? b.clientMutationId.toLowerCase() : null
    const deliveryId = typeof b?.deliveryId === 'string' && UUID.test(b.deliveryId) ? b.deliveryId : null
    if (!kind || !itemRef || !cmid || !deliveryId) return NextResponse.json({ error: 'invalid', code: 'invalid_input' }, { status: 400 })
    const binding = await bindDeliveryAttempt(await createClient() as never, { userId: ctx.userId, itemRef, clientMutationId: cmid, artifactKind: kind, deliveryId })
    return NextResponse.json({ binding })
  } catch (e) {
    return failure(e)
  }
}
