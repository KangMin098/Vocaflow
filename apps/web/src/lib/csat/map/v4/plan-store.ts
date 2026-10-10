// apps/web/src/lib/csat/map/v4/plan-store.ts
//
// 학습계획 · 목표 저장소(서버 전용 · 4차). 저장 구조(`_pending_map_v4_plan.sql`)가 적용되기 전에는 'not_installed' 를 돌려주고
// 화면은 「이 기기 초안」 모드로 남는다 — 테이블이 없는데 저장된 것처럼 보이지 않게. 오류를 「없음」으로 삼키지 않는다.
// 쓰기는 RPC 두 개(service_role)로만: csat_map_goal_set · learner_workspace_plan_commit. 사용자 id 는 호출자(인증 세션)가 준다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { PlanPayload, PlanReason, SavedPlanVersion } from './plan-commit'

type Db = SupabaseClient
const MISSING = new Set(['42P01', 'PGRST205', '42883', 'PGRST202'])

export type StoreStatus = 'installed' | 'not_installed'

export interface SavedWorkspace {
  workspaceId: string
  template: string
  latest: SavedPlanVersion
  history: SavedPlanVersion[]
}

export interface SavedPlans {
  status: StoreStatus
  /** 템플릿 id → 저장된 계획(열린 Workspace 만) */
  byTemplate: Record<string, SavedWorkspace>
  /** 가장 최근 목표 이력 id(없으면 null) */
  goalVersionId: number | null
  /** 읽다가 실패했다(저장 기능을 끄고 그 사실을 보인다) */
  error?: boolean
}

/** 저장 구조가 있는지 — 표가 없으면 not_installed(그 밖의 오류는 던진다) */
export async function storeStatus(db: Db): Promise<StoreStatus> {
  const { error } = await db.from('learner_workspace_plan').select('id', { head: true, count: 'exact' }).limit(1)
  if (!error) return 'installed'
  if (error.code && MISSING.has(error.code)) return 'not_installed'
  throw new Error(`계획 저장소 확인 실패: ${error.message}`)
}

interface PlanRow { workspace_id: string; plan_version: number; plan: PlanPayload; reason: PlanReason; note: string | null; restored_from: number | null; canon_version: string; as_of: string; created_at: string }

/** 본인의 열린 Workspace 와 계획 이력(최신 20버전) */
export async function loadSavedPlans(db: Db, userId: string): Promise<SavedPlans> {
  const status = await storeStatus(db)
  if (status === 'not_installed') return { status, byTemplate: {}, goalVersionId: null }
  const [ws, goal] = await Promise.all([
    db.from('learner_workspace').select('id, template_id').eq('user_id', userId).neq('status', 'closed'),
    db.from('csat_map_goal_version').select('id').eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1),
  ])
  if (ws.error) throw new Error(`Workspace 조회 실패: ${ws.error.message}`)
  if (goal.error) throw new Error(`목표 이력 조회 실패: ${goal.error.message}`)
  const ids = (ws.data ?? []).map((w) => w.id as string)
  const byTemplate: Record<string, SavedWorkspace> = {}
  if (ids.length) {
    const { data, error } = await db.from('learner_workspace_plan')
      .select('workspace_id, plan_version, plan, reason, note, restored_from, canon_version, as_of, created_at')
      .eq('user_id', userId).in('workspace_id', ids).order('plan_version', { ascending: false }).limit(20 * ids.length)
    if (error) throw new Error(`계획 조회 실패: ${error.message}`)
    for (const w of ws.data ?? []) {
      const rows = ((data ?? []) as PlanRow[]).filter((r) => r.workspace_id === w.id).slice(0, 20)
      if (!rows.length) continue
      const history = rows.map((r) => ({ version: r.plan_version, plan: r.plan, reason: r.reason, note: r.note, restoredFrom: r.restored_from, canon: r.canon_version, asOf: r.as_of, createdAt: r.created_at }))
      byTemplate[w.template_id as string] = { workspaceId: w.id as string, template: w.template_id as string, latest: history[0], history }
    }
  }
  return { status, byTemplate, goalVersionId: (goal.data?.[0]?.id as number | undefined) ?? null }
}

export type CommitResult =
  | { ok: true; workspaceId: string; version: number; reused: boolean }
  | { ok: false; status: 409 | 422 | 503; code: string; detail?: string }

/** RPC 오류 → API 상태(충돌 409 · 검증 422 · 미설치 503). 그 밖은 던진다 */
function mapRpcError(e: { code?: string; message: string }): CommitResult {
  if (e.code && MISSING.has(e.code)) return { ok: false, status: 503, code: 'not_installed' }
  if (/plan_version_conflict/.test(e.message)) return { ok: false, status: 409, code: 'conflict', detail: e.message }
  const m = e.message.match(/(plan_invalid|canon_mismatch|goal_mismatch|restore_missing|as_of_future)/)
  if (m) return { ok: false, status: 422, code: m[1], detail: e.message }
  throw new Error(`계획 저장 실패: ${e.message}`)
}

export async function commitPlan(db: Db, args: {
  userId: string; template: string; templateTasks: string[]; canon: string; plan: PlanPayload; reason: PlanReason; note: string | null
  asOf: string; goalVersionId: number | null; expectedVersion: number; clientKey: string; restoreOf: number | null
}): Promise<CommitResult> {
  const { data, error } = await db.rpc('learner_workspace_plan_commit', {
    p_user: args.userId, p_template: args.template, p_template_tasks: args.templateTasks, p_canon: args.canon, p_plan: args.plan,
    p_reason: args.reason, p_note: args.note, p_as_of: args.asOf, p_goal_version: args.goalVersionId,
    p_expected_version: args.expectedVersion, p_client_key: args.clientKey, p_restore_of: args.restoreOf,
  })
  if (error) return mapRpcError(error)
  const row = (Array.isArray(data) ? data[0] : data) as { workspace_id: string; plan_version: number; reused: boolean } | undefined
  if (!row) throw new Error('계획 저장 결과 없음')
  return { ok: true, workspaceId: row.workspace_id, version: row.plan_version, reused: row.reused }
}

/** 목표 저장 — 저장 구조가 있으면 RPC(최신 값 + 이력 원자적), 없으면 기존 방식(최신 값만). 어느 쪽인지 돌려준다 */
export async function setGoal(db: Db, userId: string, score: number, clientKey: string): Promise<{ mode: 'versioned' | 'latest_only'; goalVersionId: number | null }> {
  const { data, error } = await db.rpc('csat_map_goal_set', { p_user: userId, p_score: score, p_grade: null, p_exam: null, p_date: null, p_client_key: clientKey })
  if (!error) return { mode: 'versioned', goalVersionId: Number(data) }
  if (!(error.code && MISSING.has(error.code))) throw new Error(`목표 저장 실패: ${error.message}`)
  const up = await db.from('csat_map_goal').upsert({ user_id: userId, target_score: score, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (up.error) throw new Error(`목표 저장 실패: ${up.error.message}`)
  return { mode: 'latest_only', goalVersionId: null }
}
