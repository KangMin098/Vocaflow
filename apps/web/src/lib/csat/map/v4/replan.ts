// apps/web/src/lib/csat/map/v4/replan.ts
// Extracted from feat/goal-plan c44f41a5c weekly-schedule.ts replanOf. Calendar allocation belongs to v62/goal-schedule.
import type { StageKey } from './workspace'
import type { TaskPlan } from './plan'

export interface PlanStageSnapshot { task: string; stage: StageKey; done?: number }
export type ReplanChange =
  | { task: string; kind: 'stage_changed'; from: StageKey; to: StageKey | null }
  | { task: string; kind: 'need_added' | 'need_dropped' }
  | { task: string; kind: 'done_since_snapshot'; units: number }
export interface ReplanResult { changes: ReplanChange[]; reason: 'check_result' | 'goal_change' | 'content_change' | null }

export function replanOf(prev: { tasks: readonly PlanStageSnapshot[]; goalVersion: number | null }, now: readonly TaskPlan[], goalVersion: number | null): ReplanResult {
  const changes: ReplanChange[] = []
  const nowBy = new Map(now.filter(p => p.need && p.stage).map(p => [p.task, p]))
  const prevBy = new Map(prev.tasks.map(t => [t.task, t]))
  for (const [id, t] of prevBy) {
    const p = nowBy.get(id)
    if (!p) { changes.push({ task: id, kind: 'need_dropped' }); continue }
    if (p.stage !== t.stage) changes.push({ task: id, kind: 'stage_changed', from: t.stage, to: p.stage })
    // The saved PLAN has no weekly done baseline. Never rename a lifetime count as this week's performance.
    else if (t.done !== undefined && p.quantity.done > t.done) changes.push({ task: id, kind: 'done_since_snapshot', units: p.quantity.done - t.done })
  }
  for (const id of nowBy.keys()) if (!prevBy.has(id)) changes.push({ task: id, kind: 'need_added' })
  const reason = prev.goalVersion !== goalVersion ? 'goal_change'
    : changes.some(c => c.kind === 'stage_changed' || c.kind === 'need_dropped') ? 'check_result'
    : changes.some(c => c.kind === 'need_added') ? 'content_change' : null
  return { changes, reason }
}
