// apps/web/src/app/api/csat/diagnosis/map/plan/route.ts
//
// 학습 지도 rev4.0 학습계획 저장(4차).
//   GET  — 본인 계획 · 이력(다른 기기에서도 같은 계획). 응답 { status: 'installed' | 'not_installed', byTemplate, goalVersionId }
//   POST — 확정 · 수정 · 복원. 본문 { template, order, planned, reason, note?, expectedVersion, clientKey, restoreOf? }
//          서버가 지금 계획 보기를 다시 계산해 가용 문항 수 · 단계 · 정의 버전 · 기준 시점 · 목표 버전을 채운다(클라이언트 가용량 불신).
//          응답 200 { version, reused } · 409 conflict(보던 버전이 낡음) · 422 검증 · 503 not_installed(저장 구조 승인 대기)
// 사용자 id 는 로그인 세션에서만 온다(learnerContext). 쓰기는 service_role RPC 하나.

import { NextResponse } from 'next/server'

import { failure, learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { loadMapPage } from '@/lib/csat/map/load'
import { composeV4 } from '@/lib/csat/map/v4/compose'
import { buildCommitPayload, parseCommitRequest } from '@/lib/csat/map/v4/plan-commit'
import { commitPlan, loadSavedPlans, storeStatus } from '@/lib/csat/map/v4/plan-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    return NextResponse.json(await loadSavedPlans(ctx.db, ctx.userId), { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return failure(e)
  }
}

export async function POST(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    const parsed = parseCommitRequest(await readJson(req))
    if (!parsed.ok) return NextResponse.json({ error: 'invalid', code: parsed.code }, { status: 400 })
    if ((await storeStatus(ctx.db)) === 'not_installed') return NextResponse.json({ error: 'not_installed', code: 'not_installed' }, { status: 503 })
    // 서버가 지금 계획 보기를 다시 계산한다 — 화면과 같은 함수(composeV4) · 같은 입력(loadMapPage)
    const data = await loadMapPage(ctx.db, ctx.userId, new Date())
    if (!data) return NextResponse.json({ error: 'map_not_ready', code: 'map_not_ready' }, { status: 422 })
    const v = composeV4(data, { score: data.model.goal, set: data.model.goalSet })
    const r = parsed.req
    const built = buildCommitPayload(r, v?.plans[r.template] ?? null, v?.asIs.asOf ?? new Date().toISOString())
    if (!built.ok) return NextResponse.json({ error: 'invalid', code: built.code, detail: built.detail }, { status: built.status })
    const saved = await loadSavedPlans(ctx.db, ctx.userId)
    const res = await commitPlan(ctx.db, {
      userId: ctx.userId, template: r.template, templateTasks: built.templateTasks, canon: built.canon, plan: built.plan,
      reason: r.reason, note: r.note ?? null, asOf: built.asOf, goalVersionId: saved.goalVersionId,
      expectedVersion: r.expectedVersion, clientKey: r.clientKey, restoreOf: r.reason === 'restore' ? r.restoreOf ?? null : null,
    })
    if (!res.ok) return NextResponse.json({ error: res.code, code: res.code, detail: res.detail }, { status: res.status })
    return NextResponse.json({ version: res.version, reused: res.reused, workspaceId: res.workspaceId })
  } catch (e) {
    return failure(e)
  }
}
