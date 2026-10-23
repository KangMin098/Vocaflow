// apps/web/src/lib/csat/map/v4/plan-store.ts
//
// 학습계획 · 목표 저장소(서버 전용 · 4차). 저장 구조(`20261010180218_map_v4_plan.sql`)가 없으면 'not_installed' 를 돌려주고
// 화면은 「이 기기 초안」 모드로 남는다 — 테이블이 없는데 저장된 것처럼 보이지 않게. 오류를 「없음」으로 삼키지 않는다.
// 쓰기는 RPC 두 개(service_role)로만: csat_map_goal_set · learner_workspace_plan_commit. 사용자 id 는 호출자(인증 세션)가 준다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { transferPolicy, transferPolicySnapshots } from './plan-commit'
import { TRANSFER_PASSAGES } from './workspace'
import type { PlanPayload, PlanReason, PriorCommit, SavedPlanVersion } from './plan-commit'
import type { GoalExam, GoalInput, GoalVersion } from '../v62/target-goal'
import { parseGoalBudget, type GoalBudget } from '../v62/goal-budget'

type Db = SupabaseClient
export class GoalBudgetUnavailableError extends Error {}
export class GoalVersionConflictError extends Error {}
const MISSING = new Set(['42P01', 'PGRST205', '42883', 'PGRST202'])

export type StoreStatus = 'installed' | 'not_installed'

export interface SavedWorkspace {
  workspaceId: string
  template: string
  latest: SavedPlanVersion
  history: SavedPlanVersion[]
  /** Derived from complete append-only history; the UI still receives only the last 20 versions. */
  transferPlanned?: Partial<Record<string, number>>
  /** Compact policy snapshots for safe restoration; displayed allocation history stays at 20. */
  transferPolicies?: Record<number, Partial<Record<string, number>>>
}

export interface SavedPlans {
  status: StoreStatus
  /** 템플릿 id → 저장된 계획(열린 Workspace 만) */
  byTemplate: Record<string, SavedWorkspace>
  /** 가장 최근 목표 이력 id(없으면 null) */
  goalVersionId: number | null
  /** LM-G1.3a — 가장 최근 목표 이력 행(점수 · 등급 · 시험 · 목표일). 없으면 null */
  goal?: GoalVersion | null
  /** 목표 이력(최신 20) — 계획의 목표 버전을 사람이 읽을 수 있게(id → 값) */
  goalHistory?: GoalVersion[]
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

interface PlanRow { workspace_id: string; plan_version: number; plan: PlanPayload; reason: PlanReason; note: string | null; restored_from: number | null; canon_version: string; as_of: string; created_at: string; goal_version_id: number | null }

const GOAL_COLS = 'id, target_score, target_grade, target_exam, target_date, created_at'
type GoalRow = { id: number; target_score: number; target_grade: number | null; target_exam: string | null; target_date: string | null; created_at: string; planning_budget?: GoalBudget | null }
const goalOf = (r: GoalRow): GoalVersion => {
  const budget = parseGoalBudget(r.planning_budget)
  if (!budget.ok) throw new Error('저장된 시간 예산 형식을 확인하지 못했어요')
  return { id: Number(r.id), score: r.target_score, grade: r.target_grade, exam: (r.target_exam as GoalExam | null) ?? null, date: r.target_date, createdAt: r.created_at, ...(budget.budget ? { budget: budget.budget } : {}) }
}

/** The approved legacy schema stays readable until the budget migration is approved. Other errors must propagate. */
async function goalRows(db: Db, userId: string, limit: number, key?: string) {
  const read = (cols: string) => {
    const q = db.from('csat_map_goal_version').select(cols).eq('user_id', userId)
    if (key) return q.eq('client_key', key).limit(limit)
    return q.order('id', { ascending: false }).limit(limit)
  }
  const r = await read(`${GOAL_COLS}, planning_budget`)
  return r.error && ['42703', 'PGRST204'].includes(r.error.code) ? read(GOAL_COLS) : r
}

/**
 * LM-G1.3a — 본인의 최신 목표 이력 한 줄(점수 · 등급 · 시험 · 목표일). 저장 구조가 없으면 null(점수-only 최신 표만 있는 옛 상태).
 * 그 밖의 조회 실패는 던진다 — 빈 목표 · 기본값으로 삼키지 않는다(T13).
 */
export async function loadLatestGoal(db: Db, userId: string): Promise<GoalVersion | null> {
  // The user lock serializes inserts, not transaction start timestamps (now()).
  const { data, error } = await goalRows(db, userId, 1)
  if (error) {
    if (error.code && MISSING.has(error.code)) return null
    throw new Error(`목표 이력 조회 실패: ${error.message}`)
  }
  const r = (data ?? [])[0] as unknown as GoalRow | undefined
  return r ? goalOf(r) : null
}

/** 본인의 열린 Workspace 와 계획 이력(최신 20버전) */
export async function loadSavedPlans(db: Db, userId: string): Promise<SavedPlans> {
  const status = await storeStatus(db)
  if (status === 'not_installed') return { status, byTemplate: {}, goalVersionId: null, goal: null, goalHistory: [] }
  const [ws, goal] = await Promise.all([
    db.from('learner_workspace').select('id, template_id').eq('user_id', userId).neq('status', 'closed'),
    goalRows(db, userId, 20),
  ])
  if (ws.error) throw new Error(`Workspace 조회 실패: ${ws.error.message}`)
  if (goal.error) throw new Error(`목표 이력 조회 실패: ${goal.error.message}`)
  const byTemplate: Record<string, SavedWorkspace> = {}
  // Workspace 마다 따로 최신 20버전 — 한 묶음에 버전이 많아도 다른 묶음 이력이 밀려나지 않는다(4차 마감 리뷰)
  const per = await Promise.all((ws.data ?? []).map(async (w) => {

    const rows: PlanRow[] = []
    let cursor: number | null = null
    for (;;) {
      let query = db.from('learner_workspace_plan')
        .select('workspace_id, plan_version, plan, reason, note, restored_from, canon_version, as_of, created_at, goal_version_id')
        .eq('user_id', userId).eq('workspace_id', w.id as string).order('plan_version', { ascending: false }).limit(1000)
      if (cursor !== null) query = query.lt('plan_version', cursor)
      const { data, error } = await query
      if (error) throw new Error(`계획 조회 실패: ${error.message}`)
      const page = (data ?? []) as PlanRow[]
      rows.push(...page)
      if (page.length < 1000) break
      const next = page[page.length - 1].plan_version
      if (!Number.isSafeInteger(next) || next === cursor) throw new Error('Invalid plan history cursor')
      cursor = next
    }
    return { w, rows }
  }))
  for (const { w, rows } of per) {
    if (!rows.length) continue
    const history = rows.map((r) => ({ version: r.plan_version, plan: r.plan, reason: r.reason, note: r.note, restoredFrom: r.restored_from, canon: r.canon_version, asOf: r.as_of, createdAt: r.created_at, goalVersionId: r.goal_version_id === null || r.goal_version_id === undefined ? null : Number(r.goal_version_id) }))
    const snapshots = transferPolicySnapshots(w.template_id as string, history)
    const known = [...new Set(Object.values(snapshots).flatMap(p => Object.keys(p)))]
    const transferPolicies = Object.fromEntries(Object.entries(snapshots).map(([version, p]) => [version, Object.fromEntries(known.map(id => [id, p[id] ?? TRANSFER_PASSAGES]))]))
    byTemplate[w.template_id as string] = { workspaceId: w.id as string, template: w.template_id as string, latest: history[0], history: history.slice(0, 20), transferPolicies, transferPlanned: transferPolicy(w.template_id as string, history) }
  }
  const goals = ((goal.data ?? []) as unknown as GoalRow[]).map(goalOf)
  return { status, byTemplate, goalVersionId: goals[0]?.id ?? null, goal: goals[0] ?? null, goalHistory: goals }
}

export type CommitResult =
  | { ok: true; workspaceId: string; version: number; reused: boolean }
  | { ok: false; status: 409 | 422 | 503; code: string; detail?: string }

/** RPC 오류 → API 상태(충돌 409 · 검증 422 · 미설치 503). 그 밖은 던진다 */
function mapRpcError(e: { code?: string; message: string }): CommitResult {
  if (e.code && MISSING.has(e.code)) return { ok: false, status: 503, code: 'not_installed' }
  if (e.code === '23505' && /client_key/.test(e.message)) return { ok: false, status: 409, code: 'client_key_reused', detail: e.message }
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
/** LM-G1.3a — 같은 요청키로 이미 저장된 본인 목표(재전송 판단). 본인 행만 · 읽기 실패는 던진다(없음으로 삼키면 다른 본문이 저장됨이 된다) */
export async function findGoalByKey(db: Db, userId: string, clientKey: string): Promise<GoalVersion | null> {
  const { data, error } = await goalRows(db, userId, 1, clientKey)
  if (error) {
    if (error.code && MISSING.has(error.code)) return null
    throw new Error(`목표 재시도 확인 실패: ${error.message}`)
  }
  const r = (data ?? [])[0] as unknown as GoalRow | undefined
  return r ? goalOf(r) : null
}

/**
 * 목표 저장 — 저장 구조가 있으면 RPC(최신 값 + 이력 원자적 · 점수 · 등급 · 시험 · 목표일), 없으면 기존 방식(최신 점수만).
 * 옛 구조(최신 표만)에서는 점수 외 필드를 저장할 수 없다 — 그때 점수 외 필드가 있으면 저장하지 않고 거절한다(저장된 것처럼 보이지 않게).
 */
export async function setGoal(db: Db, userId: string, goalIn: number | GoalInput, clientKey: string): Promise<{ mode: 'versioned' | 'latest_only'; goalVersionId: number | null }> {
  const g: GoalInput = typeof goalIn === 'number' ? { score: goalIn, grade: null, exam: null, date: null } : goalIn
  const score = g.score
  const prior = g.expectedGoalVersion === undefined ? await loadLatestGoal(db, userId) : null
  const args = { p_user: userId, p_score: g.score, p_grade: g.grade, p_exam: g.exam, p_date: g.date, p_client_key: clientKey }
  let { data, error } = await db.rpc('csat_map_goal_budget_set', { ...args, p_budget: g.budget ?? null, p_expected_goal: g.expectedGoalVersion === undefined ? prior?.id ?? null : g.expectedGoalVersion })
  if (!error) return { mode: 'versioned', goalVersionId: Number(data) }
  if (error.code === '40001') throw new GoalVersionConflictError('목표가 다른 화면에서 바뀌었어요 — 새로고침한 뒤 다시 확인해 주세요')
  if (!(error.code && MISSING.has(error.code))) throw new Error(`목표 저장 실패: ${error.message}`)
  if (g.budget || (prior ?? await loadLatestGoal(db, userId))?.budget) throw new GoalBudgetUnavailableError('시간 예산 저장 구조가 아직 적용되지 않았어요 — 목표와 시간 예산을 저장하지 않았어요')
  // Before installation, existing unbudgeted goals retain their original writer. A budget-bearing goal can never take this fallback.
  const legacy = await db.rpc('csat_map_goal_set', args)
  data = legacy.data
  error = legacy.error
  if (!error) return { mode: 'versioned', goalVersionId: Number(data) }
  if (!(error.code && MISSING.has(error.code))) throw new Error(`목표 저장 실패: ${error.message}`)
  if (g.grade !== null || g.exam !== null || g.date !== null) throw new Error('목표 저장 실패: 목표 이력 구조가 없어 점수 외 목표를 저장할 수 없어요')
  if (await loadLatestGoal(db, userId)) throw new Error('목표 저장 실패: 기존 목표 이력이 있어 점수만 저장할 수 없어요 — 저장 구조를 확인해 주세요')
  const up = await db.from('csat_map_goal').upsert({ user_id: userId, target_score: score, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (up.error) throw new Error(`목표 저장 실패: ${up.error.message}`)
  return { mode: 'latest_only', goalVersionId: null }
}

/**
 * 같은 clientKey 로 이미 저장된 본인 계획(재시도 판단 · v6.2 P-M2b). 본인 행만(user_id 조건) — 남의 키를 넣어도 읽히지 않는다.
 * 없으면 null. 읽기 실패는 던진다(「없음」으로 삼키면 재시도가 새 버전을 만들 수 있다).
 */
export async function findCommitByKey(db: Db, userId: string, clientKey: string): Promise<PriorCommit | null> {
  const { data, error } = await db.from('learner_workspace_plan')
    .select('workspace_id, plan_version, plan, reason, note, restored_from, goal_version_id, learner_workspace!inner(template_id)')
    .eq('user_id', userId).eq('client_key', clientKey).limit(1)
  if (error) throw new Error(`계획 재시도 확인 실패: ${error.message}`)
  type Row = { workspace_id: string; plan_version: number; plan: PlanPayload; reason: PlanReason; note: string | null; restored_from: number | null; goal_version_id: number | null; learner_workspace: { template_id: string } | { template_id: string }[] }
  const r = (data ?? [])[0] as unknown as Row | undefined
  if (!r) return null
  const ws = Array.isArray(r.learner_workspace) ? r.learner_workspace[0] : r.learner_workspace
  return { template: ws.template_id, version: r.plan_version, workspaceId: r.workspace_id, plan: r.plan, reason: r.reason, note: r.note, restoredFrom: r.restored_from, goalVersionId: r.goal_version_id == null ? null : Number(r.goal_version_id) }
}
