// apps/web/src/lib/admin/learner-activity.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { itemRevealDecision, userHeldSessionDecision } from '@/lib/csat/embargo-gate'

export const ACTIVITY_PAGE_SIZE = 20
export interface AdminAttempt {
  id: string | number; task_key: string; item_ref: string | null; application_id: string | null
  session_id: string | null; content_hash: string | null; phase: string; is_correct: boolean | null
  synthetic: boolean | null; answered_at: string; help_level: string | null
}
export interface AttemptBinding {
  attempt_id: string | number; session_id: string; annotation_hash: string; workspace_id: string
  plan_version: number; task_id: string; role: string; evidence: boolean; non_evidence_reason: string | null
}
export type ActivityPage = { state: 'loaded'; rows: AdminAttempt[]; next: string | null; heldCount: number; bindings: { state: 'loaded'; rows: AttemptBinding[] } | { state: 'error' | 'not_installed' } } | { state: 'error' }
const MISSING = new Set(['42P01', 'PGRST205'])
export const validAttemptCursor = (value: string | undefined): string | null => typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) ? value : null

/** Caller verifies admin and target account. Page a single user's raw records; never infer PLAN ownership. */
export async function loadAdminLearnerActivity(db: SupabaseClient, userId: string, before?: string): Promise<ActivityPage> {
  if (before !== undefined && !validAttemptCursor(before)) return { state: 'error' }
  try {
    // 먼저 정오를 제외한 식별·수행 메타데이터만 읽는다. 관리자도 Reveal Gate를 우회하지 않는다.
    let query = db.from('learning_task_attempts').select('id,task_key,item_ref,application_id,session_id,content_hash,phase,synthetic,answered_at,help_level')
      .eq('user_id', userId).order('id', { ascending: false }).limit(ACTIVITY_PAGE_SIZE + 1)
    if (before) query = query.lt('id', before)
    const result = await query
    if (result.error || !Array.isArray(result.data)) return { state: 'error' }
    const page = (result.data as Omit<AdminAttempt, 'is_correct'>[]).slice(0, ACTIVITY_PAGE_SIZE)
    if (page.some(r => typeof r.id === 'number' && !Number.isSafeInteger(r.id) || !validAttemptCursor(String(r.id)))) return { state: 'error' }
    // 보류로 가려진 줄도 원본 페이지의 마지막 ID를 사용해 다음 페이지로 진행한다.
    const next = result.data.length > ACTIVITY_PAGE_SIZE ? String(page.at(-1)!.id) : null
    const decision = await itemRevealDecision(page.flatMap(r => r.item_ref ? [r.item_ref] : []), { db })
    if (decision.failed) return { state: 'error' }
    const visible = page.filter(r => !r.item_ref || !decision.held.has(r.item_ref))
    const heldCount = page.length - visible.length
    const scorable = visible.filter(r => r.item_ref)
    const correct = new Map<string, boolean | null>()
    if (scorable.length) {
      const scores = await db.from('learning_task_attempts').select('id,item_ref,is_correct')
        .eq('user_id', userId).in('id', scorable.map(r => String(r.id))).in('item_ref', scorable.map(r => r.item_ref!))
      if (scores.error || !Array.isArray(scores.data)) return { state: 'error' }
      const expected = new Map(scorable.map(r => [String(r.id), r.item_ref]))
      for (const score of scores.data as Pick<AdminAttempt, 'id' | 'item_ref' | 'is_correct'>[]) {
        if (!expected.has(String(score.id)) || expected.get(String(score.id)) !== score.item_ref || correct.has(String(score.id))) return { state: 'error' }
        correct.set(String(score.id), score.is_correct)
      }
      if (correct.size !== expected.size) return { state: 'error' }
    }
    // 문항을 확인할 수 없는 기록의 정오는 읽지 않는다.
    const rows: AdminAttempt[] = visible.map(r => ({ ...r, is_correct: correct.get(String(r.id)) ?? null }))
    if (!rows.length) return { state: 'loaded', rows, next, heldCount, bindings: { state: 'loaded', rows: [] } }
    const bound = await db.from('workspace_delivery_attempt')
      .select('attempt_id,session_id,annotation_hash,workspace_id,plan_version,task_id,role,evidence,non_evidence_reason')
      .eq('user_id', userId).in('attempt_id', rows.map(r => String(r.id)))
    if (bound.error || !Array.isArray(bound.data)) return { state: 'loaded', rows, next, heldCount, bindings: { state: bound.error?.code && MISSING.has(bound.error.code) ? 'not_installed' : 'error' } }
    const bindings = bound.data as AttemptBinding[]
    const byId = new Map(rows.map(r => [String(r.id), r]))
    if (bindings.some(b => {
      const a = byId.get(String(b.attempt_id))
      return !a || !a.session_id || a.session_id !== b.session_id || !a.content_hash || a.content_hash !== b.annotation_hash
    }) || new Set(bindings.map(b => String(b.attempt_id))).size !== bindings.length) return { state: 'loaded', rows, next, heldCount, bindings: { state: 'error' } }
    return { state: 'loaded', rows, next, heldCount, bindings: { state: 'loaded', rows: bindings } }
  } catch { return { state: 'error' } }
}

export interface AdminSnapshot { id: string; session_id: string | null; engine_version: string; settings_id: string | number; inputs_as_of: string; computed_at: string; adjusted_score: number | string | null; grade_est: number | null }
export async function loadAdminLearnerSnapshots(db: SupabaseClient, userId: string): Promise<{ state: 'loaded'; rows: AdminSnapshot[] } | { state: 'error' | 'held' }> {
  try {
    const gate = await userHeldSessionDecision(userId)
    if (gate.failed) return { state: 'error' }
    if (gate.held) return { state: 'held' }
    const result = await db.from('csat_dx_snapshot').select('id,session_id,engine_version,settings_id,inputs_as_of,computed_at,adjusted_score,grade_est')
      .eq('user_id', userId).order('computed_at', { ascending: false }).order('id').limit(10)
    return result.error || !Array.isArray(result.data) ? { state: 'error' } : { state: 'loaded', rows: result.data as AdminSnapshot[] }
  } catch { return { state: 'error' } }
}
