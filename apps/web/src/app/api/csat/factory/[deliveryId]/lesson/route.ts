// apps/web/src/app/api/csat/factory/[deliveryId]/lesson/route.ts
//
// 단계 2B — 한 원문 요지 → 제목 → 주제 안내 연습의 진행과 자기 설명 저장.
// GET  → { progress, model } — model 은 DB 가 이 요지 납품에 저장된 풀이를 확인했을 때만(답변 전에는 null).
// POST → 본문 { attemptId, body, mutationId }(닫힌 키 · ≤ 4096 UTF-8 바이트) — 1D 풀이 영수증 뒤의 자기 설명을 저장한다.
//   같은 키 재전송 = 같은 결과(replayed) · 다른 본문 = 409. 저장 실패(502)는 완료가 아니다 — 화면은 쓴 글을 그대로 두고 같은 키로 다시 보낸다.
//   200 { result, feedback } — feedback 은 형성 피드백(근거 충분/함께 검토 · 주장)이며 저장 판정이 아니다. evidence 는 언제나 false.
// 검사는 1D 제출 경로와 같다: 같은 출처 전체 · application/json · 로그인 세션 · userId/정오/승인 값은 받지 않는다.

import { NextResponse } from 'next/server'

import { isUuid } from '@/lib/csat/map/v62/factory-bridge/dcp-learning'
import type { SupplyClient } from '@/lib/csat/map/v62/factory-bridge/dcp-supply'
import { formativeFeedback, lessonProgress, modelAfterAttempt, parseReflectionRequest, submitReflection } from '@/lib/csat/map/v62/factory-bridge/source-lesson'
import { learnerContext } from '@/lib/csat/diagnosis/route-helpers'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 4096

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

function failStatus(code: string): number {
  if (code === 'invalid_input') return 400
  if (code === 'not_found') return 404
  if (code === 'conflict' || code === 'out_of_order') return 409
  if (code === 'not_installed') return 503
  if (code === 'query_failed' || code === 'bad_shape') return 502
  return 410
}

export async function GET(_req: Request, { params }: { params: { deliveryId: string } }) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  if (!isUuid(params.deliveryId)) return json({ code: 'not_found' }, 404)
  const r = await lessonProgress((await createClient()) as unknown as SupplyClient, params.deliveryId)
  if (!r.ok) return json({ code: r.code }, failStatus(r.code))
  return json({ progress: r.progress, model: modelAfterAttempt(r.progress) }, 200)
}

export async function POST(req: Request, { params }: { params: { deliveryId: string } }) {
  if (!sameOrigin(req)) return json({ code: 'bad_origin' }, 403)
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return json({ code: 'invalid_input' }, 415)
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  if (!isUuid(params.deliveryId)) return json({ code: 'not_found' }, 404)
  const text = await req.text().catch(() => null)
  if (text === null) return json({ code: 'invalid_input' }, 400)
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY) return json({ code: 'invalid_input' }, 413)
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return json({ code: 'invalid_input' }, 400) }
  const parsed = parseReflectionRequest(raw)
  if (!parsed) return json({ code: 'invalid_input' }, 400)

  const r = await submitReflection((await createClient()) as unknown as SupplyClient, parsed.attemptId, { ...parsed, deliveryId: params.deliveryId })
  // 다른 납품의 영수증으로 이 경로에 저장되면 모양 오류로 본다(경로와 저장 대상이 같아야 한다)
  if (r.ok && r.result.deliveryId !== params.deliveryId) return json({ code: 'bad_shape' }, 502)
  if (!r.ok) return json({ code: r.code }, failStatus(r.code))
  return json({ result: r.result, feedback: formativeFeedback(parsed.body.step, parsed.body.claim, parsed.body.support) }, 200)
}
