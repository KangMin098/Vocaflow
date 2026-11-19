// apps/web/src/app/api/csat/factory/request/route.ts
//
// POST /api/csat/factory/request — 2F. Workspace 카드에서 공장 안내 연습(중심 의미) 자료를 요청한다.
// 본문 { template } 하나(닫힌 키). 사용자 · 목표 · 수량 · 자격 · 승인은 받지 않는다 — 서버가 지금 저장 계획(loadMapPage → composeV4 → buildDemand)으로 다시 만든다.
// 쓰기(수요 · 주문 · 납품)는 학습자 세션 — DB 가 소유 · 계보 · 현재성 · 수량을 다시 판정한다. 관리자 표는 service 로 읽기만.
// 응답 200 { status: delivered | waiting_link | waiting_approval | not_in_stage } · 409 plan_required · 503 not_installed · 400/403/413/415 · 502 확인 실패.

import { NextResponse } from 'next/server'

import { learnerContext } from '@/lib/csat/diagnosis/route-helpers'
import { loadMapPage } from '@/lib/csat/map/load'
import { FACTORY_TASK, requestFactoryDcp } from '@/lib/csat/map/v62/factory-bridge/dcp-request'
import { composeV4 } from '@/lib/csat/map/v4/compose'
import { templateOf, type TaskId } from '@/lib/csat/map/v4/definition'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 1024
const NO_STORE = { 'cache-control': 'no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

export async function POST(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  if (req.headers.get('origin') !== new URL(req.url).origin) return json({ error: '요청 출처를 확인할 수 없어요', code: 'origin' }, 403)
  if (!req.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON 요청이 필요해요', code: 'content_type' }, 415)
  const raw = await req.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) return json({ error: '요청이 너무 커요', code: 'too_large' }, 413)
  let template = ''
  try {
    const b = JSON.parse(raw) as unknown
    if (!b || typeof b !== 'object' || Array.isArray(b) || Object.keys(b).join() !== 'template') throw new Error('shape')
    template = String((b as { template: unknown }).template)
    if (typeof (b as { template: unknown }).template !== 'string' || !/^[a-z0-9.-]{2,80}$/.test(template)) throw new Error('shape')
  } catch {
    return json({ error: 'invalid', code: 'invalid_input' }, 400)
  }
  const def = templateOf(template)
  if (!def || !def.core.includes(FACTORY_TASK as TaskId)) return json({ error: '이 학습 묶음은 공장 연습 자료를 받지 않아요', code: 'task_not_in_workspace' }, 400)
  try {
    const data = await loadMapPage(ctx.db, ctx.userId, new Date())
    const saved = data?.v4?.saved.byTemplate[template]
    if (!data || !saved) return json({ error: '학습계획을 먼저 확정해 주세요', code: 'plan_required' }, 409)
    const view = composeV4(data, { score: data.model.goal, set: data.model.goalSet })
    if (!view) return json({ error: 'map_not_ready', code: 'map_not_ready' }, 422)
    const res = await requestFactoryDcp(ctx.db, (await createClient()) as never, ctx.userId, {
      view, template, workspaceId: saved.workspaceId, planVersion: saved.latest.version, goalVersion: data.v4?.saved.goalVersionId ?? null,
    })
    if (res.status === 'not_installed') return json({ error: '자료 공급이 아직 준비되지 않았어요', code: 'not_installed' }, 503)
    return json(res)
  } catch (e) {
    console.error('[factory request]', e)
    return json({ error: '자료 요청 결과를 확인하지 못했어요', code: 'request_failed' }, 502)
  }
}
