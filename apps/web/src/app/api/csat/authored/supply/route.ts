// apps/web/src/app/api/csat/authored/supply/route.ts
//
// POST /api/csat/authored/supply — 학습 묶음(Workspace)의 TASK 하나에 창작 자료 공급을 요청한다(FINAL §4.4 · §8).
// 본문 { task, template }. 수요는 서버가 지금 계획 보기(loadMapPage → composeV4 → buildDemand)로 다시 만든다 — 클라이언트 수요 불신.
// 응답 200 { status: 'ok', lines } · 200 { status: 'no_lines' } · 409 plan_required(계획 확정 전) · 503 not_installed(창작 공급 SQL 미적용).
// 수요 · 공급 · 주문 쓰기는 학습자 세션으로 부른다 — DB 가 소유 · 자격 · 승인 · 사람 결정 · 노출을 다시 판정한다.

import { NextResponse } from 'next/server'

import { requestAuthoredSupply } from '@/lib/csat/authored/server'
import { failure, learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { loadMapPage } from '@/lib/csat/map/load'
import { composeV4 } from '@/lib/csat/map/v4/compose'
import { EVIDENCE_UNAVAILABLE, evidenceReadOf } from '@/lib/csat/map/v62/evidence-read'
import { supplementOf } from '@/lib/csat/map/v62/instructional-supplement'
import { taskOf, templateOf, type TaskId } from '@/lib/csat/map/v4/definition'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  try {
    const b = (await readJson(req)) as { task?: unknown; template?: unknown } | null
    const task = typeof b?.task === 'string' ? b.task : ''
    const template = typeof b?.template === 'string' ? b.template : ''
    if (!/^[a-z]\.[a-z_]{2,60}$/.test(task) || !/^[a-z0-9.-]{2,80}$/.test(template) || !safeTask(task)) {
      return NextResponse.json({ error: 'invalid', code: 'invalid_input' }, { status: 400 })
    }
    // T-0056 — TASK 가 그 Workspace 의 중심 또는 보조로 실제 들어 있어야 한다(클라이언트가 고른 task · template 짝은 권한이 아니다)
    const def = templateOf(template)
    // T-0083 — 정본 밖 예외는 닫힌 학습 전용 보조 진입(instructional-supplement)만 — 교수 2역할만 수요가 된다(buildDemand)
    if (!def || !(def.core.includes(task as TaskId) || def.support.includes(task as TaskId) || supplementOf(template, task))) {
      return NextResponse.json({ error: '이 학습 묶음에 없는 과제예요', code: 'task_not_in_workspace' }, { status: 400 })
    }
    const data = await loadMapPage(ctx.db, ctx.userId, new Date())
    const saved = data?.v4?.saved.byTemplate[template]
    if (!data || !saved) return NextResponse.json({ error: '학습계획을 먼저 확정해 주세요', code: 'plan_required' }, { status: 409 })
    // T-0078 — 수행 기록을 읽지 못하면 수요를 0건 기준으로 다시 만들어 공급하지 않는다
    if (evidenceReadOf(data) !== 'ok') return NextResponse.json({ error: '수행 기록을 지금 읽지 못했어요 — 잠시 뒤 다시 확인해 주세요', code: EVIDENCE_UNAVAILABLE }, { status: 503 })
    const view = composeV4(data, { score: data.model.goal, set: data.model.goalSet })
    if (!view) return NextResponse.json({ error: 'map_not_ready', code: 'map_not_ready' }, { status: 422 })
    const res = await requestAuthoredSupply(ctx.db, await createClient() as never, ctx.userId, {
      view, task: task as TaskId, template, workspaceId: saved.workspaceId, planVersion: saved.latest.version,
      goalVersion: data.v4?.saved.goalVersionId ?? null,
    })
    if (res.status === 'not_installed') return NextResponse.json({ error: '자료 공급이 아직 준비되지 않았어요', code: 'not_installed' }, { status: 503 })
    return NextResponse.json(res, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return failure(e)
  }
}

function safeTask(id: string): boolean {
  try { return !!taskOf(id as TaskId) } catch { return false }
}
