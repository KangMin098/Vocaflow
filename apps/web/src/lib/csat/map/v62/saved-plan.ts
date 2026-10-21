// apps/web/src/lib/csat/map/v62/saved-plan.ts
//
// T-0061 — 계획량 덮어쓰기에 쓸 저장본. 자료가 없을 때 저장한 행(planned · available 둘 다 null)은 「계획량을 정한 기록」이 아니라
// 「그때 정할 수 없었다」는 기록이다. 그 행을 그대로 applySaved 에 넘기면 자료가 생긴 뒤에도 계획량이 영영 null 로 덮인다
// (다시 확정해도 null 이 다시 저장된다 — CI 39394549057 에서 찾은 결함). 그런 행만 빼고 나머지(순서 · 다른 행)는 그대로 둔다.
// 재계획 판정(planDrift)에는 원본을 쓴다 — 「저장 뒤 자료가 생겼다」를 알아야 다시 확정을 제안할 수 있다.

import type { SavedPlanVersion } from '../v4/plan-commit'

export function quantityBasis(latest: SavedPlanVersion | null): SavedPlanVersion | null {
  if (!latest) return null
  const tasks = latest.plan.tasks.filter((t) => !(t.planned === null && t.available === null))
  return tasks.length === latest.plan.tasks.length ? latest : { ...latest, plan: { ...latest.plan, tasks } }
}
