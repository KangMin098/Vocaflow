// apps/web/src/lib/admin/factory-order-draft.ts
//
// 단계 1A — 저장된 Workspace 수요 한 줄을 서버에서 다시 읽어 교재공장의 실제 주문 설계기
// (`buildStructuredProductOrderDraft`)에 전달한다. **읽기와 초안 계산만** 한다:
// 계보 등록 · 주문 행 · 생산 · 납품을 하지 않고, 대응(crosswalk) 후보를 검증된 것으로 올리지 않는다.
// 불변식:
//   · 사용자 · Workspace · 역할 · TASK · 수량은 DB 행과 저장 정본(canonical)에서만 온다 — 브라우저 값은 받지 않는다.
//   · 조회 오류 · 행 누락은 빈 수요가 아니라 unavailable / not_found 다(fail closed).
//   · 시각은 의존성(now)으로 주입한다 — 이 파일은 시계를 읽지 않는다.
//   · 공장 validator 오류는 숨기지 않고 그 코드를 그대로 돌려준다.

import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import {
  buildStructuredProductOrderDraft,
  structuredOrderDraftSchema,
} from '@vocaflow/library-pipeline/product-planning'

import type { AdminUser } from '@/lib/auth/require-admin-api'
import { canonicalJson } from '@/lib/csat/map/v62/canonical-json'
import { crosswalkFor, crosswalkUsable } from '@/lib/csat/map/v62/factory-bridge/crosswalk'
import { specFromDemand, type LineageSpec } from '@/lib/csat/map/v62/factory-bridge/order-lineage'
import { CANON_VERSION, type TaskId } from '@/lib/csat/map/v4/definition'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256 = /^[0-9a-f]{64}$/
const REQUEST_KEYS = ['demand_line_id', 'draft', 'expected_signature'] as const

export interface FactoryOrderDraftRequest {
  demand_line_id: string
  expected_signature: string
  /** 공장 정본 structuredOrderDraftSchema 로 strict 검증된 값 */
  draft: ReturnType<typeof structuredOrderDraftSchema.parse>
}

export class FactoryOrderDraftRequestError extends Error {}

/**
 * 브라우저가 보낼 수 있는 것은 이 셋뿐 — 사용자 · Workspace · 역할 · 수량 · 승인 상태 필드는 거절된다(strict).
 * draft 는 공장의 strict schema 를 그대로 쓴다(복제하지 않는다).
 */
export function parseFactoryOrderDraftRequest(value: unknown): FactoryOrderDraftRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FactoryOrderDraftRequestError('body')
  const body = value as Record<string, unknown>
  const keys = Object.keys(body).sort()
  if (keys.join(',') !== REQUEST_KEYS.join(',')) throw new FactoryOrderDraftRequestError('keys')
  if (typeof body.demand_line_id !== 'string' || !UUID.test(body.demand_line_id))
    throw new FactoryOrderDraftRequestError('demand_line_id')
  if (typeof body.expected_signature !== 'string' || !SHA256.test(body.expected_signature))
    throw new FactoryOrderDraftRequestError('expected_signature')
  return {
    demand_line_id: body.demand_line_id.toLowerCase(),
    expected_signature: body.expected_signature,
    draft: structuredOrderDraftSchema.parse(body.draft),
  }
}

export const FACTORY_ORDER_DRAFT_MAX_BYTES = 120000
/** 1A 범위 — 평가 역할(독립 확인 · 전이 · 지연)은 별도 평가 계약이라 공장 주문으로 낮추지 않는다 */
export const FACTORY_ORDER_DRAFT_ROLES = ['guided_practice'] as const

export interface DemandLineRow {
  id: string
  demand_id: string
  user_id: string
  workspace_id: string
  line_no: number
  role: string
  task_id: string
  quantity: number
}
export interface DemandRow {
  id: string
  user_id: string
  workspace_id: string
  goal_version_id: number | null
  plan_version: number
  definition_version: string
  core_task: string
  canonical: string
  signature: string
}
export interface WorkspaceRow {
  id: string
  user_id: string
  status: string
}
export interface CurrentPlanRow {
  plan_version: number
  goal_version_id: number | null
}

/** DB 조회 — 각 메서드는 오류를 던지고(unavailable), 행이 없으면 null 을 돌려준다 */
export interface FactoryOrderDraftReader {
  demandLine(id: string): Promise<DemandLineRow | null>
  demand(id: string, userId: string, workspaceId: string): Promise<DemandRow | null>
  workspace(id: string, userId: string): Promise<WorkspaceRow | null>
  /** 이 사용자의 최신 목표 버전 id — 목표가 하나도 없으면 null */
  currentGoalVersionId(userId: string): Promise<number | null>
  /** 이 Workspace 의 최신 계획 버전 — 계획이 없으면 null */
  currentPlan(workspaceId: string, userId: string): Promise<CurrentPlanRow | null>
}

export class FactoryOrderDraftReadError extends Error {}

/** 서비스 롤 클라이언트용 reader. requireAdminApi + admin 역할 확인 뒤에만 만든다 */
export function supabaseFactoryOrderDraftReader(db: SupabaseClient): FactoryOrderDraftReader {
  const one = async <T>(label: string, query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T | null> => {
    const { data, error } = await query
    if (error) throw new FactoryOrderDraftReadError(label)
    const rows = (data ?? []) as T[]
    if (!Array.isArray(rows) || rows.length > 1) throw new FactoryOrderDraftReadError(label)
    return rows[0] ?? null
  }
  return {
    demandLine: (id) =>
      one<DemandLineRow>('demand_line', db.from('workspace_content_demand_line')
        .select('id, demand_id, user_id, workspace_id, line_no, role, task_id, quantity').eq('id', id).limit(2)),
    demand: (id, userId, workspaceId) =>
      one<DemandRow>('demand', db.from('workspace_content_demand')
        .select('id, user_id, workspace_id, goal_version_id, plan_version, definition_version, core_task, canonical, signature')
        .eq('id', id).eq('user_id', userId).eq('workspace_id', workspaceId).limit(2)),
    workspace: (id, userId) =>
      one<WorkspaceRow>('workspace', db.from('learner_workspace')
        .select('id, user_id, status').eq('id', id).eq('user_id', userId).limit(2)),
    currentGoalVersionId: async (userId) => {
      const row = await one<{ id: number }>('goal', db.from('csat_map_goal_version')
        .select('id').eq('user_id', userId).order('id', { ascending: false }).limit(1))
      return row ? row.id : null
    },
    currentPlan: (workspaceId, userId) =>
      one<CurrentPlanRow>('plan', db.from('learner_workspace_plan')
        .select('plan_version, goal_version_id').eq('workspace_id', workspaceId).eq('user_id', userId)
        .order('plan_version', { ascending: false }).limit(1)),
  }
}

export type FactoryOrderDraftErrorCode =
  | 'demand_line_not_found'
  | 'demand_not_found'
  | 'demand_unavailable'
  | 'signature_mismatch'
  | 'demand_integrity_mismatch'
  | 'workspace_inactive'
  | 'stale_demand'
  | 'role_not_supported'
  | 'task_not_mapped'
  | 'personal_identifier_in_order'
  | 'factory_validation_failed'
  | 'product_family_mismatch'

export interface FactoryOrderDraftError {
  ok: false
  status: 404 | 409 | 422 | 503
  code: FactoryOrderDraftErrorCode
  detail?: string
}

export interface FactoryOrderDraftResult {
  ok: true
  status: 'draft_prepared'
  persisted: false
  lineage: 'not_registered'
  production: 'not_started'
  delivery: 'not_performed'
  mapping: 'candidate_unvalidated'
  registrable: false
  demand: {
    demand_id: string
    line_id: string
    line_no: number
    signature: string
    definition_version: string
    goal_version_id: number | null
    plan_version: number
    role: string
    task: string
    quantity: number
  }
  spec: LineageSpec
  factory: {
    order: unknown
    order_hash: string
    planning_hash: string
    capability_state: string
    product_family: string
    item_types: string[]
  }
  crosswalk: Array<{
    factory_skill_id: string
    product_family: string
    item_types: string[]
    relation: string
    status: string
    claim_scope: string
    seal_order: { ok: boolean; why: string }
  }>
  /** 이 초안이 인증하지 않는 것 — 다음 단계(1B 이후)가 실제 증거로 닫아야 하는 항목 */
  blockers: string[]
}

const fail = (status: FactoryOrderDraftError['status'], code: FactoryOrderDraftErrorCode, detail?: string): FactoryOrderDraftError =>
  ({ ok: false, status, code, ...(detail ? { detail } : {}) })

interface CanonicalDemandV2 {
  v: number
  user: unknown
  workspaceId: unknown
  goalVersion: unknown
  planVersion: unknown
  definitionVersion: unknown
  core: unknown
  lines: Array<{ role?: unknown; task?: unknown; n?: unknown }>
}

/** 저장 정본을 다시 읽는다 — 정규 직렬화와 다르면(키 순서 · 공백 포함) 정본이 아니다 */
function readCanonical(text: string): CanonicalDemandV2 | null {
  try {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    if (canonicalJson(parsed) !== text) return null
    const value = parsed as CanonicalDemandV2
    return value.v === 2 && Array.isArray(value.lines) ? value : null
  } catch {
    return null
  }
}

/** 공장 오류 코드만 남긴다(대문자 코드 또는 zod 경로) — 원문 스택 · 입력값은 응답에 싣지 않는다 */
function factoryErrorCode(error: unknown): string {
  if (error instanceof FactoryOrderDraftRequestError) return `request:${error.message}`
  const issues = (error as { issues?: unknown } | null)?.issues
  if (Array.isArray(issues))
    return `schema:${issues.map((issue: { path?: unknown[]; message?: string }) => (issue.path ?? []).join('.') || issue.message).join(',')}`.slice(0, 500)
  const message = error instanceof Error ? error.message : ''
  const code = /^[A-Z][A-Z0-9_:]{2,80}/.exec(message)?.[0]
  return code ?? 'UNKNOWN_FACTORY_ERROR'
}

/** 서버가 확인한 수요 한 줄로 실제 공장 초안을 만든다. 쓰기 0 · 입력 불변 */
export async function prepareFactoryOrderDraft(
  reader: FactoryOrderDraftReader,
  request: FactoryOrderDraftRequest,
  nowIso: string,
): Promise<FactoryOrderDraftResult | FactoryOrderDraftError> {
  let line: DemandLineRow | null
  let demand: DemandRow | null
  let workspace: WorkspaceRow | null
  let goalId: number | null
  let plan: CurrentPlanRow | null
  try {
    line = await reader.demandLine(request.demand_line_id)
    if (!line) return fail(404, 'demand_line_not_found')
    demand = await reader.demand(line.demand_id, line.user_id, line.workspace_id)
    if (!demand) return fail(404, 'demand_not_found')
    ;[workspace, goalId, plan] = await Promise.all([
      reader.workspace(demand.workspace_id, demand.user_id),
      reader.currentGoalVersionId(demand.user_id),
      reader.currentPlan(demand.workspace_id, demand.user_id),
    ])
  } catch {
    return fail(503, 'demand_unavailable')
  }

  // 1. 서명 — 저장 본문의 SHA-256 = 행 서명 = 호출자가 본 서명
  const digest = createHash('sha256').update(demand.canonical, 'utf8').digest('hex')
  if (digest !== demand.signature) return fail(409, 'demand_integrity_mismatch', 'signature_column')
  if (demand.signature !== request.expected_signature) return fail(409, 'signature_mismatch')

  // 2. 정본 본문 ↔ DB 열 결속
  const canonical = readCanonical(demand.canonical)
  if (!canonical) return fail(409, 'demand_integrity_mismatch', 'canonical_form')
  const entry = canonical.lines[line.line_no]
  const mismatched = [
    line.demand_id !== demand.id && 'line_demand',
    (line.user_id !== demand.user_id || line.workspace_id !== demand.workspace_id) && 'line_owner',
    canonical.user !== demand.user_id && 'user',
    canonical.workspaceId !== demand.workspace_id && 'workspace',
    canonical.goalVersion !== demand.goal_version_id && 'goal',
    canonical.planVersion !== demand.plan_version && 'plan',
    canonical.definitionVersion !== demand.definition_version && 'definition',
    canonical.core !== demand.core_task && 'core',
    !entry && 'line_no',
    entry && entry.role !== line.role && 'role',
    entry && entry.task !== line.task_id && 'task',
    entry && entry.n !== line.quantity && 'quantity',
  ].filter((value): value is string => typeof value === 'string')
  if (mismatched.length) return fail(409, 'demand_integrity_mismatch', mismatched.join(','))

  // 3. 현재성 — Workspace 활성 · 본인 소유, 최신 목표 · 계획 · 정의 버전
  if (!workspace || workspace.user_id !== demand.user_id) return fail(409, 'workspace_inactive', 'workspace_owner')
  if (workspace.status !== 'active') return fail(409, 'workspace_inactive', workspace.status)
  const stale = [
    goalId !== demand.goal_version_id && 'goal',
    (!plan || plan.plan_version !== demand.plan_version) && 'plan',
    plan && plan.plan_version === demand.plan_version && plan.goal_version_id !== demand.goal_version_id && 'plan_goal',
    demand.definition_version !== CANON_VERSION && 'definition',
  ].filter((value): value is string => typeof value === 'string')
  if (stale.length) return fail(409, 'stale_demand', stale.join(','))

  // 4. 역할 · 명세 · 대응 후보
  if (!(FACTORY_ORDER_DRAFT_ROLES as readonly string[]).includes(line.role)) return fail(422, 'role_not_supported', line.role)
  let spec: LineageSpec
  try {
    spec = specFromDemand(demand.canonical, line.line_no)
  } catch {
    return fail(409, 'demand_integrity_mismatch', 'spec')
  }
  const candidates = crosswalkFor(line.task_id as TaskId).filter((c) => c.materialRole.some((role) => role === line!.role))
  if (!candidates.length) return fail(422, 'task_not_mapped', line.task_id)

  // 5. 개인 식별자를 공장 주문(공용 hash)에 섞지 않는다
  const draftText = JSON.stringify(request.draft)
  if (draftText.includes(demand.user_id) || draftText.includes(demand.workspace_id))
    return fail(422, 'personal_identifier_in_order')

  // 6. 실제 공장 설계 · 봉인 — 오류 코드를 그대로 돌려준다
  let built: ReturnType<typeof buildStructuredProductOrderDraft>
  try {
    built = buildStructuredProductOrderDraft(structuredClone(request.draft), nowIso)
  } catch (error) {
    return fail(422, 'factory_validation_failed', factoryErrorCode(error))
  }
  const family = built.order.product_family
  const matched = candidates.filter((c) => c.productFamily === family)
  if (!matched.length || !built.order.item_types.some((type) => matched.some((c) => c.itemType.includes(type))))
    return fail(422, 'product_family_mismatch', `${family}:${candidates.map((c) => c.productFamily).join('|')}`)

  const blockers = [
    ...(matched.some((c) => crosswalkUsable(c, 'seal_order').ok) ? [] : ['crosswalk_not_validated']),
    'task_fit_review_missing',
    'policy_authenticity_unverified',
    'rights_unverified',
    'lineage_not_registered',
    'production_not_run',
    'delivery_not_performed',
  ]
  return {
    ok: true,
    status: 'draft_prepared',
    persisted: false,
    lineage: 'not_registered',
    production: 'not_started',
    delivery: 'not_performed',
    mapping: 'candidate_unvalidated',
    registrable: false,
    demand: {
      demand_id: demand.id,
      line_id: line.id,
      line_no: line.line_no,
      signature: demand.signature,
      definition_version: demand.definition_version,
      goal_version_id: demand.goal_version_id,
      plan_version: demand.plan_version,
      role: line.role,
      task: line.task_id,
      quantity: line.quantity,
    },
    spec,
    factory: {
      order: built.order,
      order_hash: built.order_hash,
      planning_hash: built.planning_hash,
      capability_state: built.capability_state,
      product_family: family,
      item_types: [...built.order.item_types],
    },
    crosswalk: candidates.map((c) => ({
      factory_skill_id: c.factorySkillId,
      product_family: c.productFamily,
      item_types: [...c.itemType],
      relation: c.relation,
      status: c.status,
      claim_scope: c.claimScope,
      seal_order: crosswalkUsable(c, 'seal_order'),
    })),
    blockers,
  }
}

export interface FactoryOrderDraftDeps {
  guard: () => Promise<AdminUser | NextResponse>
  reader: () => FactoryOrderDraftReader
  now: () => string
}

/** API handler — 가드 · 출처 · 형식 검사를 모두 통과하기 전에는 reader 를 만들지 않는다 */
export function createFactoryOrderDraftPost(deps: FactoryOrderDraftDeps) {
  return async function POST(req: NextRequest): Promise<NextResponse> {
    const admin = await deps.guard()
    if (admin instanceof NextResponse) return admin
    if (admin.role !== 'admin')
      return NextResponse.json({ error: '공장 주문 초안은 관리자만 계산할 수 있습니다.' }, { status: 403 })
    if (req.headers.get('origin') !== req.nextUrl.origin)
      return NextResponse.json({ error: '요청 출처를 확인할 수 없습니다.' }, { status: 403 })
    if (!req.headers.get('content-type')?.startsWith('application/json'))
      return NextResponse.json({ error: 'JSON 요청이 필요합니다.' }, { status: 415 })
    const raw = await req.text()
    if (Buffer.byteLength(raw, 'utf8') > FACTORY_ORDER_DRAFT_MAX_BYTES)
      return NextResponse.json({ error: '요청 본문이 너무 큽니다.' }, { status: 413 })
    let request: FactoryOrderDraftRequest
    try {
      request = parseFactoryOrderDraftRequest(JSON.parse(raw))
    } catch (error) {
      return NextResponse.json(
        { error: '수요 줄 · 서명 · 주문 초안 형식을 확인해 주세요.', code: 'invalid_request', detail: factoryErrorCode(error) },
        { status: 400 },
      )
    }
    let reader: FactoryOrderDraftReader
    try {
      reader = deps.reader()
    } catch {
      return NextResponse.json({ error: '수요를 확인할 수 없습니다.', code: 'demand_unavailable' }, { status: 503 })
    }
    const result = await prepareFactoryOrderDraft(reader, request, deps.now())
    if (!result.ok)
      return NextResponse.json(
        { error: '주문 초안을 만들 수 없습니다.', code: result.code, ...(result.detail ? { detail: result.detail } : {}) },
        { status: result.status },
      )
    // 내부 판별 필드(ok)는 응답 계약이 아니다
    const body: Partial<FactoryOrderDraftResult> = { ...result }
    delete body.ok
    return NextResponse.json(body)
  }
}
