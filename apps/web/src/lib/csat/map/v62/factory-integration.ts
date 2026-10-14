// apps/web/src/lib/csat/map/v62/factory-integration.ts
//
// v6.2 — 학습지도 × Workspace × 교재공장 **연계 계약**(순수). 공장은 블랙박스 — 내부 공정 · 생성기 · 조판은 바꾸지 않는다.
//
//   WorkspaceDemand(demand.ts) → FactoryRequest(여기) → [교재공장] → FactoryResultManifest(여기)
//     → 자격 연결(qualification.ts · FQ A~H) → WorkspaceContentBinding(여기) → 학습 실행기(외부)
//
// 지금 공장 연결의 실제 상태(P-F0 · P-F5 실측): 영속 주문 API 없음 · 활동 단위 생산 없음 · 권(series × step) 단위 드레인을 사람이 실행.
//   ⇒ 이 파일의 요청 · 응답은 **MOCK_ONLY** 다. 요청 명세를 만들었다는 사실을 「주문 접수」로, mock 응답을 「생산 완료」로 보고하지 않는다.
// 재사용: 수요 = `WorkspaceDemand` · 서명 = `demandSignature` · 공장 유형 대응 = `orderSpecFor`(CSAT_BACKING) · 자격 = `qualification.ts`.
// 새 주문 엔진 · DB · RPC 를 만들지 않는다(영속 주문은 승인안 B 의 별도 과제).

import { createHash } from 'node:crypto'

import { isPlayableDcpType } from '@/lib/learner/dcp-types'
import { isUnderlineChoiceDcpType } from '@/lib/learner/dcp-underline'

import type { DemandLine, MaterialRole, WorkspaceDemand } from './demand'
import { orderSpecFor, type OrderSpec } from './order-spec'
import { demandSignature } from './persist-contract'
import { ASSESSMENT_ROLES, bindResult, supplyEligible, toSupplyQualification, type FqResult } from './qualification'
import { fulfillmentOf, type Fulfillment, type SupplyLine } from './supply'

export const FACTORY_REQUEST_SCHEMA = 'vf.factory-request/1' as const
export const FACTORY_MANIFEST_SCHEMA = 'vf.factory-manifest/1' as const

/** 공장 연결의 실제 상태 — 기능별. 코드가 바뀌기 전엔 이 값이 정본이다 */
export const FACTORY_CONNECTION = {
  orderApi: 'UNSUPPORTED', // 공장이 받는 주문 API · 영속 주문 표가 없다
  activityUnit: 'UNSUPPORTED', // 활동 · 지문 단위 생산 없음
  volumeUnit: 'MANUAL_DRAIN', // 권 단위 드레인(사람 · 에이전트가 명령 실행)
  manifest: 'UNSUPPORTED', // 공장이 결과 manifest 를 돌려주지 않는다
  mode: 'MOCK_ONLY',
} as const

// ── 1. Workspace 수요 줄의 교육 명세(역할 → 학습자 수행 · 산출물 · 교수 단계) ─────────────
/** 공장에 넘길 교육적 의도. 수요 줄에 없는 필드를 역할에서 **정의**한다(추정치 · 점수 상승량을 만들지 않는다) */
export const ROLE_SPEC: Record<MaterialRole, { performanceGoal: string; learnerOutput: string; teachingStage: string; exposure: string }> = {
  source_analysis: { performanceGoal: '기출 원문에서 이 TASK 가 작동하는 자리를 본다', learnerOutput: '없음(읽기 · 해설)', teachingStage: '모델링', exposure: '해설 공개 허용' },
  model_explanation: { performanceGoal: '풀이 과정을 따라 이해한다', learnerOutput: '없음(설명 읽기)', teachingStage: '모델링', exposure: '해설 공개 허용' },
  guided_practice: { performanceGoal: '도움을 받으며 같은 수행을 해 본다', learnerOutput: '선택 · 단답 · 배열 응답', teachingStage: '지도 연습', exposure: '힌트 · 해설 허용(독립 수행으로 세지 않음)' },
  independent_check: { performanceGoal: '도움 없이 수행한다', learnerOutput: '첫 시도 응답', teachingStage: '독립 확인', exposure: '미노출 · 응답 전 해설 금지' },
  transfer: { performanceGoal: '다른 글에 같은 수행을 적용한다', learnerOutput: '첫 시도 응답', teachingStage: '전이', exposure: '미노출 · 응답 전 해설 금지' },
  delayed_check: { performanceGoal: '다른 날 다시 수행한다', learnerOutput: '첫 시도 응답', teachingStage: '지연 재확인', exposure: '미노출 · 응답 전 해설 금지' },
}

// ── 2. FactoryRequest ─────────────────────────────────────────────────
/**
 * 공장 생산 단위 지원 — 지금은 「그대로 지원(supported)」이 없다(활동 단위 미지원).
 *   convertible_to_volume : 그 유형을 만드는 권 단위 공정이 있다(요구 단위와 다름)
 *   unit_support_needed   : 공장 산출 단위(문항)가 이 역할의 단위(설명 · 분석 활동)와 다르다 — 별도 단위 지원 필요
 *   unsupported           : 공장 산출물로 공급할 수 없는 역할(평가 역할 — Gold · 노출 원장 필요) · 대응 유형 없음
 *   unconfirmed           : 기출 유형 조건 자체가 미확인
 */
export type UnitSupport = 'supported' | 'convertible_to_volume' | 'unit_support_needed' | 'unsupported' | 'unconfirmed'

export function unitSupportFor(line: DemandLine, spec: OrderSpec): { support: UnitSupport; why: string } {
  if (ASSESSMENT_ROLES.has(line.role)) return { support: 'unsupported', why: 'assessment_not_from_factory' }
  if (line.csatTypes.length === 0) return { support: 'unconfirmed', why: 'csat_type_unconfirmed' }
  if (line.role === 'source_analysis' || line.role === 'model_explanation') return { support: 'unit_support_needed', why: 'explanation_activity_unit' }
  if (spec.factoryTypes.length === 0) return { support: 'unsupported', why: 'no_factory_type' }
  return { support: 'convertible_to_volume', why: 'activity_unit_unsupported' }
}

export interface FactoryRequest {
  schema: typeof FACTORY_REQUEST_SCHEMA
  /** 정규 본문의 SHA-256 앞 32자 — 같은 본문이면 같은 id */
  requestId: string
  /** 수요 서명 + 줄 번호 — 같은 수요 revision 의 같은 줄은 같은 키 */
  idempotencyKey: string
  demandKey: string
  workspaceId: string | null
  versions: { goal: number | null; plan: number | null; definition: string }
  task: string
  supportTasks: string[]
  role: MaterialRole
  lineNo: number
  education: (typeof ROLE_SPEC)[MaterialRole] & { reason: DemandLine['reason'] }
  content: { csatTypes: string[]; factoryTypes: string[] }
  /** 이번 PLAN 단계 계획량 — 목표 달성 총량 · 점수 상승 추정이 아니다 */
  quantity: { n: number; unit: '문항'; basis: 'plan_stage_quantity' }
  source: { rightsUsable: true; excludeUnsupportedExams: true }
  constraints: { gold: boolean; unseenByLearner: boolean; noExplanationBefore: boolean; versionBinding: 'exact_revision' }
  /** 생산 뒤 공급 전에 반드시 통과할 검사(OrderSpec.gaps) */
  postReview: OrderSpec['gaps']
  reuseAllowed: boolean
  productionUnit: { support: UnitSupport; why: string; commands: string[] }
  connection: typeof FACTORY_CONNECTION.mode
  approvalsNeeded: OrderSpec['approvals']
}

function canonical(o: unknown): string {
  if (Array.isArray(o)) return `[${o.map(canonical).join(',')}]`
  if (o && typeof o === 'object') return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical((o as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(o)
}
export const requestBody = (r: FactoryRequest): string => canonical({ ...r, requestId: undefined })

/** 수요 → 줄마다 요청 명세. 재고 · 기존 테스트 교재가 있어도 수요 줄을 지우지 않는다(교육적 수요 보존) */
export function buildFactoryRequests(userId: string, demand: WorkspaceDemand): FactoryRequest[] {
  const sig = demandSignature(userId, demand)
  return demand.lines.map((line, lineNo) => {
    const spec = orderSpecFor(line)
    const unit = unitSupportFor(line, spec)
    const r: FactoryRequest = {
      schema: FACTORY_REQUEST_SCHEMA,
      requestId: '',
      idempotencyKey: `${sig}:${lineNo}`,
      demandKey: demand.key,
      workspaceId: demand.workspaceId,
      versions: { goal: demand.goalVersion, plan: demand.planVersion, definition: demand.definitionVersion },
      task: line.task,
      supportTasks: [...demand.support],
      role: line.role,
      lineNo,
      education: { ...ROLE_SPEC[line.role], reason: line.reason },
      content: { csatTypes: [...line.csatTypes], factoryTypes: spec.factoryTypes },
      quantity: { n: line.quantity.n, unit: '문항', basis: 'plan_stage_quantity' },
      source: { rightsUsable: true, excludeUnsupportedExams: true },
      constraints: { gold: line.requires.gold, unseenByLearner: line.requires.unseenByLearner, noExplanationBefore: line.requires.noExplanationBefore, versionBinding: 'exact_revision' },
      postReview: spec.gaps,
      reuseAllowed: line.reuse,
      productionUnit: { ...unit, commands: unit.support === 'convertible_to_volume' ? spec.commands : [] },
      connection: FACTORY_CONNECTION.mode,
      approvalsNeeded: spec.approvals,
    }
    r.requestId = createHash('sha256').update(requestBody(r)).digest('hex').slice(0, 32)
    return r
  })
}

/** 같은 멱등 키로 저장된 요청과 비교 — 같은 본문이면 재사용, 다르면 충돌(거절) */
export function reconcileRequest(stored: FactoryRequest | null, incoming: FactoryRequest): { action: 'create' | 'reuse' } | { action: 'reject'; why: 'same_key_different_body' } {
  if (!stored || stored.idempotencyKey !== incoming.idempotencyKey) return { action: 'create' }
  return requestBody(stored) === requestBody(incoming) ? { action: 'reuse' } : { action: 'reject', why: 'same_key_different_body' }
}

// ── 3. FactoryResultManifest ─────────────────────────────────────────────
export type ManifestStatus =
  | 'spec_created' // 요청 명세만 있음(주문 아님)
  | 'order_received' // 공장이 실제 주문을 받음(실행 기록 필요)
  | 'unsupported' // 생산 미지원
  | 'awaiting_production'
  | 'produced'
  | 'review_pending'
  | 'review_failed'
  | 'review_passed'
  | 'failed'

export interface ManifestArtifact {
  id: string
  kind: 'dcp_item' | 'csat_item' | 'textbook_activity' | 'volume'
  revision: string
  sha256: string
  refs: { source: string | null; analysis: string | null; gold: string | null }
  contentType: string
  /** 공장이 주장하는 지원 TASK — 주장일 뿐 TASK 적합성 판정이 아니다 */
  tasks: string[]
  roleCandidates: MaterialRole[]
  access: string
  rights: 'unknown' | 'cleared' | 'restricted'
  quality: 'unreviewed' | 'passed' | 'failed'
  provenance: { runId: string | null; mock: boolean }
  /** test_fixture = 테스트성 산출물(제품 아님) — 별도 승인 없이 product 로 바꾸지 않는다 */
  lifecycle: 'test_fixture' | 'product'
}

export interface FactoryResultManifest {
  schema: typeof FACTORY_MANIFEST_SCHEMA
  requestId: string
  /** MOCK = 이 계약 시험용 · REAL = 실제 공장 실행 기록 · EXISTING = 이미 출시된 기존 자산(R5) */
  mode: 'MOCK' | 'REAL' | 'EXISTING'
  status: ManifestStatus
  runId: string | null
  producedCount: number
  artifacts: ManifestArtifact[]
  failure: { code: string; reason: string } | null
  factory: { name: string; version: string }
}

const AFTER_ORDER: ReadonlySet<ManifestStatus> = new Set(['order_received', 'awaiting_production', 'produced', 'review_pending', 'review_failed', 'review_passed'])
const HAS_ARTIFACTS: ReadonlySet<ManifestStatus> = new Set(['produced', 'review_pending', 'review_failed', 'review_passed'])

/** manifest 형식 · 정합 검사 — 오류 목록(비면 통과). 공장은 공급을 허가할 수 없다(그건 자격 · 결속 단계) */
export function validateManifest(m: FactoryResultManifest, req: FactoryRequest): string[] {
  const e: string[] = []
  if (m.schema !== FACTORY_MANIFEST_SCHEMA) e.push('schema_mismatch')
  if (m.requestId !== req.requestId) e.push('request_mismatch')
  if (m.mode === 'REAL' && AFTER_ORDER.has(m.status) && !m.runId) e.push('real_status_without_run')
  if (m.mode === 'MOCK' && m.artifacts.some((a) => !a.provenance.mock)) e.push('mock_artifact_claims_real')
  if (m.mode === 'REAL' && m.artifacts.some((a) => a.provenance.mock)) e.push('real_manifest_with_mock_artifact')
  if (HAS_ARTIFACTS.has(m.status) && m.artifacts.length === 0) e.push('status_without_artifacts')
  if (m.producedCount !== m.artifacts.length) e.push('count_mismatch')
  for (const a of m.artifacts) {
    if (!a.revision) e.push(`artifact_without_revision:${a.id}`)
    if (!/^[0-9a-f]{64}$/.test(a.sha256)) e.push(`artifact_without_hash:${a.id}`)
  }
  if ((m.status === 'unsupported' || m.status === 'failed') && !m.failure) e.push('failure_without_reason')
  if ((m.status as string) === 'supply_allowed') e.push('factory_cannot_grant_supply')
  return e
}

/** 보고용 상태 — MOCK 응답은 실제 상태처럼 보고하지 않는다 */
export function reportableStatus(m: FactoryResultManifest): string {
  if (m.mode === 'MOCK') return `MOCK_ONLY:${m.status}`
  if (m.mode === 'REAL' && AFTER_ORDER.has(m.status) && !m.runId) return 'spec_created'
  return m.status
}

// ── 4. 자격 연결(FQ A~H) ──────────────────────────────────────────────
export type ArtifactVerdict =
  | { state: 'accept'; reasons: string[] }
  | { state: 'review_pending'; reasons: string[] }
  | { state: 'ineligible'; reasons: string[] }

/**
 * 산출물 하나의 공급 자격(콘텐츠 공통). 학습자별 노출(G)은 공급 시점에 따로 — 여기서 accept 여도 `learnerGate` 가 남는다.
 * 규칙: 테스트 교재 → 보류 · 자격 기록 없음 → 보류(유형 대응 ≠ TASK 적합) · revision/TASK/역할 다름 → 보류(상속 금지)
 *       · fail 축 → 부적격 · unknown 축 → 보류 · 승인 기록은 서버가 원장에서 계산한 값만.
 */
export function qualifyArtifact(a: ManifestArtifact, req: FactoryRequest, fq: FqResult | null, approval: { public: boolean; assessment: boolean }): ArtifactVerdict {
  if (a.lifecycle === 'test_fixture') return { state: 'review_pending', reasons: ['test_fixture'] }
  if (a.quality === 'failed') return { state: 'ineligible', reasons: ['factory_quality_failed'] }
  if (a.rights === 'restricted') return { state: 'ineligible', reasons: ['rights_restricted'] }
  if (!fq) return { state: 'review_pending', reasons: ['no_qualification_record'] }
  const bind = bindResult(fq, { contentId: a.id, revision: a.revision, task: req.task, role: req.role })
  if (!bind.ok) return { state: 'review_pending', reasons: [bind.error] }
  const q = toSupplyQualification(fq, approval)
  const se = supplyEligible(q, req.role)
  if (se.ok) return { state: 'accept', reasons: [] }
  const failed = se.missing.filter((k) => q[k] === false)
  return failed.length ? { state: 'ineligible', reasons: failed.map((k) => `axis_fail:${k}`) } : { state: 'review_pending', reasons: se.missing.map((k) => `axis_unknown:${k}`) }
}

// ── 5. WorkspaceContentBinding ──────────────────────────────────────────
/**
 * 실행기 형식 — FQR1 실측: 기사 독해 17유형만 기존 실행기 · 채점기가 있다. vocab_choice 는 격리 개발 화면만(P-F8d).
 * 나머지 교재 유형(unit_vocab · blank_word · grammar_* · word_order)은 실행 · 채점 어댑터가 필요하다.
 */
export type RunnerFormat = 'dcp_existing' | 'csat_item_screen' | 'dcp_underline_dev_only' | 'adapter_needed' | 'none'

export function runnerFor(a: Pick<ManifestArtifact, 'kind' | 'contentType'>): RunnerFormat {
  if (a.kind === 'csat_item') return 'csat_item_screen'
  if (a.kind !== 'dcp_item') return 'none'
  if (isPlayableDcpType(a.contentType)) return 'dcp_existing'
  if (isUnderlineChoiceDcpType(a.contentType)) return 'dcp_underline_dev_only'
  return 'adapter_needed'
}
const RUNNABLE: ReadonlySet<RunnerFormat> = new Set(['dcp_existing', 'csat_item_screen'])

export interface WorkspaceContentBinding {
  workspaceId: string | null
  task: string
  role: MaterialRole
  purpose: DemandLine['reason']
  requestId: string
  items: { artifact: { id: string; revision: string }; verdict: ArtifactVerdict; runner: RunnerFormat }[]
  /** 지금 공급할 수 있는 수 = accept ∧ 실행기 있음. 학습자별 노출은 공급 시점에 다시 본다 */
  suppliable: number
  planned: number
  fulfillment: Fulfillment
  blockedReasons: string[]
  learnerGate: 'check_at_delivery'
  /** 공급 뒤 돌아갈 자리 — 같은 PLAN · TASK */
  returnTo: { planVersion: number | null; task: string }
}

export function bindToWorkspace(req: FactoryRequest, m: FactoryResultManifest, verdicts: Record<string, ArtifactVerdict>, purpose: DemandLine['reason']): WorkspaceContentBinding {
  const blocked = new Set<string>()
  const errors = validateManifest(m, req)
  errors.forEach((x) => blocked.add(`manifest:${x}`))
  if (m.mode === 'MOCK') blocked.add('mock_only')
  if (m.failure) blocked.add(`factory:${m.failure.code}`)
  const items = m.artifacts.map((a) => {
    const verdict = verdicts[a.id] ?? { state: 'review_pending' as const, reasons: ['not_reviewed'] }
    const runner = runnerFor(a)
    if (verdict.state !== 'accept') verdict.reasons.forEach((r) => blocked.add(r))
    else if (!RUNNABLE.has(runner)) blocked.add(`runner:${runner}`)
    return { artifact: { id: a.id, revision: a.revision }, verdict, runner }
  })
  // mock · 오류 manifest 의 산출물은 공급 수에 넣지 않는다
  const suppliable = m.mode === 'MOCK' || errors.length ? 0 : items.filter((i) => i.verdict.state === 'accept' && RUNNABLE.has(i.runner)).length
  const line: SupplyLine = {
    role: req.role, state: suppliable ? 'available' : 'unsupported', delivered: Array.from({ length: suppliable }, (_, k) => ({ ref: String(k), source: 'check_task' as const })),
    shortfall: Math.max(0, req.quantity.n - suppliable), qualification: { producible: null, rights: null, content: null, teaching: null, assessment: null, learner: null, runnable: null }, reason: '',
  }
  return {
    workspaceId: req.workspaceId, task: req.task, role: req.role, purpose, requestId: req.requestId,
    items, suppliable, planned: req.quantity.n, fulfillment: fulfillmentOf(line), blockedReasons: [...blocked].sort(),
    learnerGate: 'check_at_delivery', returnTo: { planVersion: req.versions.plan, task: req.task },
  }
}

// ── 6. 기존 자산(R5) — 공장을 거치지 않는 이미 출시된 확인 과제 ─────────────────
/**
 * R5 확인 과제는 기존 출시 · 노출 계약(supplyFor 의 check_task)으로 이미 공급된다. 연계 계약에서는 EXISTING manifest 로 감싸
 * 같은 결속 경로를 지나게 한다 — 공장 산출물 · 테스트 교재와 섞이지 않게 kind = csat_item · lifecycle = product.
 */
export function existingAssetManifest(req: FactoryRequest, supply: SupplyLine, hashOf: (ref: string) => string): { manifest: FactoryResultManifest; verdicts: Record<string, ArtifactVerdict> } {
  const artifacts: ManifestArtifact[] = supply.delivered.map((d) => ({
    id: d.ref, kind: 'csat_item', revision: 'released', sha256: hashOf(d.ref), refs: { source: d.ref, analysis: null, gold: null },
    contentType: d.source, tasks: [req.task], roleCandidates: [req.role], access: `csat_items:${d.ref}`, rights: 'cleared', quality: 'passed',
    provenance: { runId: null, mock: false }, lifecycle: 'product',
  }))
  const verdicts: Record<string, ArtifactVerdict> = {}
  for (const a of artifacts) verdicts[a.id] = supply.state === 'available' ? { state: 'accept', reasons: ['existing_release_contract'] } : { state: 'review_pending', reasons: ['existing_not_available'] }
  return {
    manifest: { schema: FACTORY_MANIFEST_SCHEMA, requestId: req.requestId, mode: 'EXISTING', status: 'review_passed', runId: null, producedCount: artifacts.length, artifacts, failure: null, factory: { name: 'existing-assets', version: 'v6.2' } },
    verdicts,
  }
}
