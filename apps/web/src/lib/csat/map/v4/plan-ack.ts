// apps/web/src/lib/csat/map/v4/plan-ack.ts
// Client-only acknowledgement handoff. The authenticated API remains the authority;
// this cache only lets a remounted editor refresh its own exact draft context.
import type { PlanDraft } from './plan'

export interface PlanAck {
  version: number
  workspaceId: string
  stages: Record<string, string | null>
}
const waiting = new Map<string, PlanAck>()
const listeners = new Map<string, (ack: PlanAck) => boolean>()

export function acknowledgePlan(key: string, ack: PlanAck) {
  if (!Number.isSafeInteger(ack.version) || ack.version < 1 || !ack.workspaceId) return
  const prior = waiting.get(key)
  if (prior && prior.version > ack.version) return
  waiting.set(key, ack)
  if (listeners.get(key)?.(ack)) waiting.delete(key)
  // No persistent identity or server-authority state; discard oldest inactive contexts.
  if (waiting.size > 32) waiting.delete(waiting.keys().next().value!)
}
export function listenPlanAck(key: string, listener: (ack: PlanAck) => boolean) {
  listeners.set(key, listener)
  const pending = waiting.get(key)
  if (pending && listener(pending)) waiting.delete(key)
  return () => { if (listeners.get(key) === listener) listeners.delete(key) }
}
export function sameStageDraft(draft: PlanDraft | null, _before: PlanAck['stages'], now: PlanAck['stages']): PlanDraft | null {
  if (!draft) return null
  return bindPlanDraft(draft, now)
}

/** Unversioned legacy quantities and quantities from another stage are never reinterpreted. */
export function bindPlanDraft(draft: PlanDraft | null, stages: PlanAck['stages']): PlanDraft | null {
  if (!draft) return null
  return { order: draft.order, planned: Object.fromEntries(Object.entries(draft.planned).filter(([id]) => id in stages && draft.stages?.[id] === stages[id])), stages }
}
