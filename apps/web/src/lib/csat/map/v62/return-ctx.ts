// apps/web/src/lib/csat/map/v62/return-ctx.ts
//
// v6.2 §9.3 — 지도 → 문항 → 지도 복귀의 문맥. 나갈 때 「어느 TASK · 어느 묶음(템플릿) · 어느 학습자 Workspace · 몇 번 계획 · 몇 번 목표」였는지 싣고,
// 돌아오면 지금 저장 상태와 비교해 달라진 점을 알린다. 옛 Workspace UUID · 옛 계획 버전을 **되살리지 않는다**(지금 최신을 보이고 바뀐 사실만 말한다).
// 순수 함수 — 조회하지 않는다(문맥 값으로 다른 사람 자료를 읽을 길이 없다).

import type { MapReturnCtx } from '../../map-return'
import type { SavedPlans } from '../v4/plan-store'

/** 나가는 링크에 실을 문맥 — 저장된 계획이 없으면 UUID · 버전은 비운다 */
export function outgoingCtx(saved: SavedPlans | null | undefined, mapTask: string, ws: string | null): MapReturnCtx {
  const w = ws && saved?.status === 'installed' ? saved.byTemplate[ws] ?? null : null
  return {
    mapTask,
    ws,
    mapWs: w?.workspaceId ?? null,
    mapPlan: w ? String(w.latest.version) : null,
    mapGoal: saved?.goalVersionId ? String(saved.goalVersionId) : null,
  }
}

export type ReturnNote =
  /** 떠날 때의 Workspace 가 지금 열린 Workspace 가 아니다(종료 · 다시 만듦) — 옛 계획을 되살리지 않는다 */
  | { kind: 'workspace_replaced' }
  /** 같은 Workspace 인데 떠난 뒤 계획 버전이 바뀌었다 */
  | { kind: 'plan_changed'; from: number; to: number }
  /** 떠난 뒤 목표가 바뀌었다 */
  | { kind: 'goal_changed' }

/** 돌아왔을 때 지금 저장 상태와 비교 — 달라진 것만(같으면 빈 배열). 문맥이 없으면 비교하지 않는다 */
export function returnNotes(saved: SavedPlans | null | undefined, ctx: MapReturnCtx | null): ReturnNote[] {
  if (!ctx || saved?.status !== 'installed') return []
  const out: ReturnNote[] = []
  const w = ctx.ws ? saved.byTemplate[ctx.ws] ?? null : null
  if (ctx.mapWs) {
    if (!w || w.workspaceId !== ctx.mapWs) out.push({ kind: 'workspace_replaced' })
    else if (ctx.mapPlan && Number(ctx.mapPlan) !== w.latest.version) out.push({ kind: 'plan_changed', from: Number(ctx.mapPlan), to: w.latest.version })
  }
  if (ctx.mapGoal && saved.goalVersionId !== null && Number(ctx.mapGoal) !== saved.goalVersionId) out.push({ kind: 'goal_changed' })
  return out
}

export const RETURN_NOTE_LABEL: Record<ReturnNote['kind'], string> = {
  workspace_replaced: '떠날 때 열려 있던 학습계획은 지금 열린 계획이 아니에요(끝냈거나 새로 시작했어요). 지금 계획을 보여 드려요.',
  plan_changed: '떠난 뒤 학습계획이 바뀌었어요. 지금 최신 계획을 보여 드려요.',
  goal_changed: '떠난 뒤 목표가 바뀌었어요. 지금 목표로 다시 계산했어요.',
}
