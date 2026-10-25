// apps/web/src/app/api/csat/factory/[deliveryId]/attempt/route.ts
//
// POST /api/csat/factory/[deliveryId]/attempt — 납품된 공장 DCP 지도 연습 한 번의 응답(단계 1D).
// 본문은 닫힌 두 필드 { choice: 1..5, mutationId: uuid } 뿐 — userId · actor · 정오 · 원문 hash · 승인 상태는 받지 않는다.
// 검사: 같은 출처(Origin 의 스킴 · host · 포트 전체) · application/json · 본문 ≤ 512 UTF-8 바이트 · 닫힌 필드 · 로그인 세션. 채점은 DB 의 실제 grade_dcp_item 이 한다.
// 같은 mutationId 재전송 = 저장된 같은 결과(replayed). 다른 응답 · 다른 납품에 같은 키 = 409.
// 응답 200 { result } · 400 invalid_input · 401 · 403 bad_origin · 404 not_found · 409 conflict · 410 비유효 납품(닫힌 code) · 413 · 415 · 503 not_installed · 502 저장 실패.
// 저장 실패(502)는 오답이 아니다 — 화면은 고른 답을 그대로 두고 같은 키로 다시 보낸다.

import { NextResponse } from 'next/server'

import { isUuid, parseAttemptBody, submitFactoryAttempt } from '@/lib/csat/map/v62/factory-bridge/dcp-learning'
import type { SupplyClient } from '@/lib/csat/map/v62/factory-bridge/dcp-supply'
import { learnerContext } from '@/lib/csat/diagnosis/route-helpers'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 512

/** 같은 출처만 — Origin 이 없거나 스킴 · host · 포트 중 하나라도 다르면 거절(CSRF). `null` Origin 도 거절 */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin || origin === 'null') return false
  try {
    const o = new URL(origin)
    return o.origin === origin.replace(/\/$/, '') && o.origin === new URL(req.url).origin
  } catch {
    return false
  }
}

const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(req: Request, { params }: { params: { deliveryId: string } }) {
  if (!sameOrigin(req)) return json({ error: '허용되지 않은 요청이에요', code: 'bad_origin' }, 403)
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return json({ error: 'json only', code: 'invalid_input' }, 415)
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  const { deliveryId } = params
  if (!isUuid(deliveryId)) return json({ error: '자료를 찾지 못했어요', code: 'not_found' }, 404)
  const text = await req.text().catch(() => null)
  if (text === null) return json({ error: 'invalid', code: 'invalid_input' }, 400)
  // 상한은 UTF-8 바이트로 — 문자 수로 재면 다바이트 문자가 상한을 넘는다
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY) return json({ error: 'too large', code: 'invalid_input' }, 413)
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return json({ error: 'invalid', code: 'invalid_input' }, 400) }
  const body = parseAttemptBody(raw)
  if (!body) return json({ error: '응답 형식이 맞지 않아요', code: 'invalid_input' }, 400)

  const r = await submitFactoryAttempt((await createClient()) as unknown as SupplyClient, deliveryId, body)
  if (r.ok) return json({ result: r.result }, 200)
  switch (r.code) {
    case 'invalid_input': return json({ error: '응답 형식이 맞지 않아요', code: r.code }, 400)
    case 'not_found': return json({ error: '자료를 찾지 못했어요', code: r.code }, 404)
    case 'conflict': return json({ error: '이미 다른 답으로 보낸 제출이에요 — 화면을 새로 고쳐 주세요', code: r.code }, 409)
    case 'not_installed': return json({ error: '연습 기록을 아직 준비하고 있어요', code: r.code }, 503)
    case 'query_failed': case 'bad_shape': return json({ error: '저장하지 못했어요 — 고른 답은 그대로예요', code: r.code }, 502)
    default: return json({ error: '지금은 이 자료를 풀 수 없어요', code: r.code }, 410)
  }
}
