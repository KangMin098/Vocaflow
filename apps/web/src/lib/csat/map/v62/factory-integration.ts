// apps/web/src/lib/csat/map/v62/factory-integration.ts
//
// v6.2 — 학습지도 × Workspace × 교재공장 **연계 계약**(순수). 공장은 블랙박스 — 내부 공정 · 생성기 · 조판은 바꾸지 않는다.
//
//   WorkspaceDemand(demand.ts) → FactoryRequest(여기) → [교재공장] → FactoryResultManifest(여기)
//     → 자격 연결(qualification.ts · FQ A~H · Trusted Qualification Context) → WorkspaceContentBinding(여기) → 학습 실행기(외부)
//
// 지금 공장 연결의 실제 상태(P-F0 · P-F5 실측): 영속 주문 API 없음 · 활동 단위 생산 없음 · 권(series × step) 단위 드레인을 사람이 실행.
//   ⇒ 이 파일의 요청 · 응답은 **MOCK_ONLY / NOT_CONNECTED** 다. 요청 명세를 「주문 접수」로, mock 응답을 「생산 완료」로 보고하지 않는다.
//
// v1.1(Codex 독립 검토 review/factory-integration-contract-v1 · 8e705307b 의 I01~I11 수정):
//   · manifest 상태 · 열거값 · 실행/mock 출처 · 역할 · 단위 · 수량 · 중복 · 다중 revision 검사(I01~I04) — 하나라도 어긋나면 후보 0
//   · 판정은 산출물 **불변 주체**(id · 종류 · revision · 해시 · 원천/분석/Gold 참조)에 결속(I02 · I07) — id 만 맞는 옛 판정은 쓰지 않는다
//   · 공장 manifest · 승인 boolean · 연구 플래그는 승인 증거가 아니다 — 서버가 만든 Trusted Qualification Context 만(I05)
//   · 기존 자산(R5) 래퍼는 SupplyLine 「available」 하나로 출시 · 권리 · 품질 · accept 를 지어내지 않는다(I06)
//   · 표준 JSON 정규 직렬화(I08) · 수요 서명 중첩 키 정렬(I09, persist-contract.ts)
//   · 수량을 단계별로 분리하고 후보를 가짜 「납품」으로 세지 않는다(I10) · source_analysis 도 교수 적합성(D) 필수(I11, qualification.ts)
// 재사용: 수요 = `WorkspaceDemand` · 서명 = `demandSignature` · 공장 유형 대응 = `orderSpecFor` · 자격 = `qualification.ts`.

import { createHash } from 'node:crypto'

import { isClassifiedDcpType, isPlayableDcpType } from '@/lib/learner/dcp-types'
import { isUnderlineChoiceDcpType } from '@/lib/learner/dcp-underline'

import { canonicalJson } from './canonical-json'
import type { DemandLine, MaterialRole, WorkspaceDemand } from './demand'
import { orderSpecFor, type OrderSpec } from './order-spec'
import { demandSignature } from './persist-contract'
import { approvalState, ASSESSMENT_ROLES, bindResult, supplyEligible, toSupplyQualification, type FqResult, type ReleaseApproval } from './qualification'
import type { Fulfillment, SupplyLine } from './supply'

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

const ROLES: readonly MaterialRole[] = ['source_analysis', 'model_explanation', 'guided_practice', 'independent_check', 'transfer', 'delayed_check']

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
 *   convertible_to_volume : 그 유형을 만드는 권 단위 공정이 있다(요구 단위와 다름 · 실제 접수 · API 승인 아님)
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
  /** 표준 정규 JSON(requestId 제외)의 SHA-256 앞 32자 — 같은 본문이면 같은 id */
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
  /** 이번 PLAN 단계 계획량 — 목표 달성 총량 · 점수 상승 추정이 아니다. 단위는 문항만(그 밖은 검사가 막는다) */
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

/** 요청 정규 본문 — requestId 를 **객체에서 빼고** 표준 정규 JSON(JSON.parse 가능 · 키 순서 무관) */
export function requestBody(r: FactoryRequest): string {
  const { requestId: _omit, ...rest } = r
  void _omit
  return canonicalJson(rest)
}

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

/**
 * 같은 멱등 키로 저장된 요청과 비교 — 같은 본문이면 재사용, 다르면 충돌(거절).
 * 키가 다르면(다른 학습자 · Workspace · 목표/PLAN 버전 · TASK · 역할 · 수량 · 지원 TASK) 새 요청.
 * 스키마 버전이 다르면 같은 키여도 재사용하지 않는다(충돌 — 새 스키마로 다시 만든다).
 */
export function reconcileRequest(stored: FactoryRequest | null, incoming: FactoryRequest): { action: 'create' | 'reuse' } | { action: 'reject'; why: 'same_key_different_body' | 'schema_version_changed' } {
  if (!stored || stored.idempotencyKey !== incoming.idempotencyKey) return { action: 'create' }
  if (stored.schema !== incoming.schema) return { action: 'reject', why: 'schema_version_changed' }
  return requestBody(stored) === requestBody(incoming) ? { action: 'reuse' } : { action: 'reject', why: 'same_key_different_body' }
}

// ── 3. FactoryResultManifest ─────────────────────────────────────────────
export const MANIFEST_STATUSES = [
  'spec_created', // 요청 명세만 있음(주문 아님)
  'order_received', // 공장이 실제 주문을 받음(실행 기록 필요)
  'unsupported', // 생산 미지원
  'awaiting_production',
  'produced',
  'review_pending',
  'review_failed',
  'review_passed',
  'failed',
] as const
export type ManifestStatus = (typeof MANIFEST_STATUSES)[number]
const MODES = ['MOCK', 'REAL', 'EXISTING'] as const
const KINDS = ['dcp_item', 'csat_item', 'textbook_activity', 'volume'] as const
/** 기존 자산(csat_item) 의 내용 종류 — supply.ts 의 공급원 */
const CSAT_ITEM_TYPES: ReadonlySet<string> = new Set(['check_task', 'transfer_task', 'v3_explanation'])

export interface ManifestArtifact {
  id: string
  kind: (typeof KINDS)[number]
  revision: string
  sha256: string
  refs: { source: string | null; analysis: string | null; gold: string | null }
  contentType: string
  /** 공장이 주장하는 지원 TASK — 주장일 뿐 TASK 적합성 판정이 아니다 */
  tasks: string[]
  roleCandidates: MaterialRole[]
  access: string
  /** 공장 주장(승인 증거 아님 — Trusted Qualification Context 만 근거) */
  rights: 'unknown' | 'cleared' | 'restricted'
  /** 공장 주장(승인 증거 아님) */
  quality: 'unreviewed' | 'passed' | 'failed'
  provenance: { runId: string | null; mock: boolean }
  /** test_fixture = 테스트성 산출물(제품 아님) — 정확한 revision 의 전환 승인 없이 product 로 다루지 않는다 */
  lifecycle: 'test_fixture' | 'product'
}

export interface FactoryResultManifest {
  schema: typeof FACTORY_MANIFEST_SCHEMA
  requestId: string
  /** MOCK = 이 계약 시험용 · REAL = 실제 공장 실행 기록 · EXISTING = 이미 출시된 기존 자산(R5) */
  mode: (typeof MODES)[number]
  status: ManifestStatus
  runId: string | null
  producedCount: number
  artifacts: ManifestArtifact[]
  failure: { code: string; reason: string } | null
  factory: { name: string; version: string }
}

/** 공급 후보를 셀 수 있는 유일한 상태 — 검수 통과(그래도 공급 허용은 아니다: 자격 · 결속 · 학습자 G 가 남는다) */
const USABLE: ReadonlySet<ManifestStatus> = new Set(['review_passed'])
const AFTER_ORDER: ReadonlySet<ManifestStatus> = new Set(['order_received', 'awaiting_production', 'produced', 'review_pending', 'review_failed', 'review_passed'])
const HAS_ARTIFACTS: ReadonlySet<ManifestStatus> = new Set(['produced', 'review_pending', 'review_failed', 'review_passed'])
const NO_ARTIFACTS: ReadonlySet<ManifestStatus> = new Set(['spec_created', 'order_received', 'awaiting_production', 'unsupported', 'failed'])
const FAILURE_STATUSES: ReadonlySet<ManifestStatus> = new Set(['unsupported', 'failed'])
const nonEmpty = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0

/** manifest 형식 · 정합 검사 — 오류 목록(비면 통과). 공장은 공급을 허가할 수 없다(그건 자격 · 결속 단계) */
export function validateManifest(m: FactoryResultManifest, req: FactoryRequest): string[] {
  const e: string[] = []
  if (m.schema !== FACTORY_MANIFEST_SCHEMA) e.push('schema_mismatch')
  if (m.requestId !== req.requestId) e.push('request_mismatch')
  if (!(MODES as readonly string[]).includes(m.mode)) e.push('unknown_mode')
  if ((m.status as string) === 'supply_allowed') e.push('factory_cannot_grant_supply')
  else if (!(MANIFEST_STATUSES as readonly string[]).includes(m.status)) e.push('unknown_status')
  // 요청 단위 · 역할(I04)
  if (req.quantity.unit !== '문항' || !Number.isInteger(req.quantity.n) || req.quantity.n < 1) e.push('request_quantity_unsupported')
  if (!ROLES.includes(req.role)) e.push('request_role_unknown')
  // 실행 · mock 출처(I03)
  if (m.mode === 'REAL' && AFTER_ORDER.has(m.status) && !nonEmpty(m.runId)) e.push('real_status_without_run')
  if (m.mode === 'MOCK' && m.artifacts.some((a) => !a.provenance?.mock)) e.push('mock_artifact_claims_real')
  if (m.mode !== 'MOCK' && m.artifacts.some((a) => a.provenance?.mock)) e.push(`${String(m.mode).toLowerCase()}_manifest_with_mock_artifact`)
  if (m.mode === 'REAL' && m.artifacts.some((a) => a.provenance?.runId !== m.runId)) e.push('artifact_run_mismatch')
  if (m.mode === 'EXISTING' && m.runId !== null) e.push('existing_with_run')
  // 상태 ↔ 산출물 ↔ 실패(I01)
  if (HAS_ARTIFACTS.has(m.status) && m.artifacts.length === 0) e.push('status_without_artifacts')
  if (NO_ARTIFACTS.has(m.status) && m.artifacts.length > 0) e.push('artifacts_in_non_output_status')
  if (FAILURE_STATUSES.has(m.status) && !(m.failure && nonEmpty(m.failure.code) && nonEmpty(m.failure.reason))) e.push('failure_without_reason')
  if (!FAILURE_STATUSES.has(m.status) && m.failure !== null) e.push('failure_in_non_failure_status')
  if (!Number.isInteger(m.producedCount) || m.producedCount !== m.artifacts.length) e.push('count_mismatch')
  // 산출물 하나하나(I01 · I02 · I04)
  const ids = new Map<string, Set<string>>()
  for (const a of m.artifacts) {
    const tag = nonEmpty(a.id) ? a.id : '(empty)'
    if (!nonEmpty(a.id)) e.push('artifact_without_id')
    if (!(KINDS as readonly string[]).includes(a.kind)) e.push(`artifact_unknown_kind:${tag}`)
    if (a.kind === 'dcp_item' && !isClassifiedDcpType(a.contentType)) e.push(`artifact_unknown_type:${tag}`)
    if (a.kind === 'csat_item' && !CSAT_ITEM_TYPES.has(a.contentType)) e.push(`artifact_unknown_type:${tag}`)
    if (!nonEmpty(a.revision)) e.push(`artifact_without_revision:${tag}`)
    if (!/^[0-9a-f]{64}$/.test(a.sha256 ?? '')) e.push(`artifact_without_hash:${tag}`)
    if (!Array.isArray(a.roleCandidates) || !a.roleCandidates.includes(req.role)) e.push(`artifact_role_mismatch:${tag}`)
    if (!Array.isArray(a.tasks) || !a.tasks.includes(req.task)) e.push(`artifact_task_mismatch:${tag}`)
    const revs = ids.get(a.id) ?? new Set<string>()
    if (ids.has(a.id)) e.push(revs.has(a.revision) ? `duplicate_artifact:${tag}` : `multiple_revisions:${tag}`)
    revs.add(a.revision)
    ids.set(a.id, revs)
  }
  return e
}

/** 보고용 상태 — MOCK 응답은 실제 상태처럼 보고하지 않는다 */
export function reportableStatus(m: FactoryResultManifest): string {
  if (m.mode === 'MOCK') return `MOCK_ONLY:${m.status}`
  if (m.mode === 'REAL' && AFTER_ORDER.has(m.status) && !m.runId) return 'spec_created'
  return m.status
}

// ── 4. 자격 연결(FQ A~H · Trusted Qualification Context) ─────────────────────
/** 산출물의 불변 주체 — 판정은 이 값 전체에 결속된다 */
export interface ArtifactSubject {
  id: string
  kind: ManifestArtifact['kind']
  revision: string
  sha256: string
  refs: ManifestArtifact['refs']
}
export const subjectOf = (a: ManifestArtifact): ArtifactSubject => ({ id: a.id, kind: a.kind, revision: a.revision, sha256: a.sha256, refs: { ...a.refs } })
export const sameSubject = (x: ArtifactSubject, y: ArtifactSubject): boolean => canonicalJson(x) === canonicalJson(y)

const TRUSTED = Symbol('vf.trusted-qualification-context')

/**
 * Trusted Qualification Context — **서버가** 인증 · 원장 · 현재 자산을 읽어 만든 값만 승인 근거가 된다.
 * 클라이언트 · 공장 · 연구 JSON 의 boolean · 권한 문자열 · runId · 승인 id 하나로는 만들어지지 않는다(브랜드 심볼).
 * 이 타입이 있다는 것은 검증을 **했다**는 뜻이 아니다 — 지금은 DB 원장(승인안 B · C)이 없어 서버 reader 가 없다.
 */
export interface TrustedQualificationContext {
  readonly [TRUSTED]: true
  /** 서버가 읽은 현재 산출물(실재 · 현재 revision · 해시 · 원천/분석/Gold 참조) */
  subject: ArtifactSubject
  /** 자격 원장 행(규칙 버전 · 근거 id 포함) */
  qualification: { id: string; rulesVersion: string; evidenceIds: string[]; result: FqResult }
  /** 그 자격 행의 승인 · 철회(서버 원장) */
  approvals: ReleaseApproval[]
  /** 생산 이력: REAL 실행 원장 확인 · EXISTING 등록부 확인 · 미확인 */
  provenance: 'real_run_verified' | 'existing_registry_verified' | 'unverified'
  /** test_fixture → product 전환 승인(정확한 revision) */
  lifecycleTransitionApproved: boolean
}

/** 서버 전용 — 원장 reader 가 검증을 마친 뒤에만 부른다(지금 호출부 없음). 순수 시험은 검증된 원장을 흉내 내는 데만 쓴다 */
export function trustedQualificationContext(c: Omit<TrustedQualificationContext, typeof TRUSTED>): TrustedQualificationContext {
  return { ...c, [TRUSTED]: true }
}
export const isTrusted = (x: unknown): x is TrustedQualificationContext => !!x && typeof x === 'object' && (x as Record<symbol, unknown>)[TRUSTED] === true

export type VerdictState = 'accept' | 'review_pending' | 'ineligible'
/** 판정 — 반드시 산출물 주체에 결속. 주체가 없거나 다른 판정은 결속 단계가 쓰지 않는다 */
export interface ArtifactVerdict {
  state: VerdictState
  reasons: string[]
  subject?: ArtifactSubject
  /** 이 판정이 기댄 자격 원장 · 규칙 버전 · 근거(없으면 null) */
  basis?: { qualificationId: string | null; rulesVersion: string | null; evidenceIds: string[] } | null
}

const verdict = (a: ManifestArtifact, state: VerdictState, reasons: string[], basis: ArtifactVerdict['basis'] = null): ArtifactVerdict => ({ state, reasons, subject: subjectOf(a), basis })

/**
 * 산출물 하나의 공급 자격(콘텐츠 공통). 학습자별 노출(G)은 공급 시점에 따로 — accept 여도 `learnerGate` 가 남는다.
 * 4번째 인자는 서버의 Trusted Qualification Context 만 승인 근거로 쓴다. `{ public, assessment }` 같은 boolean 은 **승인이 아니다**(I05) — 보류.
 * 규칙: 테스트 교재(전환 승인 없음) → 보류 · 공장 품질 실패 · 권리 제한 → 부적격 · 신뢰 문맥 없음 → 보류
 *       · 주체(id · 종류 · revision · 해시 · 원천/분석/Gold) 불일치 → 보류(상속 금지, I07) · 출처 미확인 → 보류
 *       · 자격 기록 없음 · TASK/역할 다름 → 보류 · fail 축 → 부적격 · unknown 축 → 보류.
 */
export function qualifyArtifact(a: ManifestArtifact, req: FactoryRequest, fq: FqResult | null, ctx: TrustedQualificationContext | { public: boolean; assessment: boolean } | null): ArtifactVerdict {
  if (a.quality === 'failed') return verdict(a, 'ineligible', ['factory_quality_failed'])
  if (a.rights === 'restricted') return verdict(a, 'ineligible', ['rights_restricted'])
  if (!isTrusted(ctx)) return verdict(a, 'review_pending', a.lifecycle === 'test_fixture' ? ['test_fixture', 'untrusted_qualification_context'] : ['untrusted_qualification_context'])
  const basis = { qualificationId: ctx.qualification.id, rulesVersion: ctx.qualification.rulesVersion, evidenceIds: [...ctx.qualification.evidenceIds] }
  if (a.lifecycle === 'test_fixture' && !ctx.lifecycleTransitionApproved) return verdict(a, 'review_pending', ['test_fixture'], basis)
  if (!sameSubject(subjectOf(a), ctx.subject)) {
    const s = subjectOf(a)
    const diff = (['id', 'kind', 'revision', 'sha256'] as const).filter((k) => s[k] !== ctx.subject[k]).map((k) => `subject_mismatch:${k}`)
    const refs = (['source', 'analysis', 'gold'] as const).filter((k) => s.refs[k] !== ctx.subject.refs[k]).map((k) => `subject_mismatch:${k}`)
    return verdict(a, 'review_pending', [...diff, ...refs], basis)
  }
  if (ctx.provenance === 'unverified') return verdict(a, 'review_pending', ['provenance_unverified'], basis)
  const q0 = fq ?? ctx.qualification.result
  if (!q0) return verdict(a, 'review_pending', ['no_qualification_record'], basis)
  if (fq && canonicalJson(fq) !== canonicalJson(ctx.qualification.result)) return verdict(a, 'review_pending', ['qualification_not_from_ledger'], basis)
  const bind = bindResult(q0, { contentId: a.id, revision: a.revision, task: req.task, role: req.role })
  if (!bind.ok) return verdict(a, 'review_pending', [bind.error], basis)
  const q = toSupplyQualification(q0, approvalState(ctx.qualification.id, ctx.approvals))
  const se = supplyEligible(q, req.role)
  if (se.ok) return verdict(a, 'accept', [], basis)
  const failed = se.missing.filter((k) => q[k] === false)
  return failed.length
    ? verdict(a, 'ineligible', failed.map((k) => `axis_fail:${k}`), basis)
    : verdict(a, 'review_pending', se.missing.map((k) => `axis_unknown:${k}`), basis)
}

// ── 5. WorkspaceContentBinding ──────────────────────────────────────────
/**
 * 실행기 형식 — FQR1 실측: 기사 독해 17유형만 기존 실행기 · 채점기가 있다. vocab_choice 는 격리 개발 화면만(P-F8d).
 * 나머지 교재 유형(unit_vocab · blank_word · grammar_* · word_order)은 실행 · 채점 어댑터가 필요하다. 독해 유형으로 대신하지 않는다.
 */
export type RunnerFormat = 'dcp_existing' | 'csat_item_screen' | 'dcp_underline_dev_only' | 'adapter_needed' | 'none'

export function runnerFor(a: Pick<ManifestArtifact, 'kind' | 'contentType'>): RunnerFormat {
  if (a.kind === 'csat_item') return CSAT_ITEM_TYPES.has(a.contentType) ? 'csat_item_screen' : 'none'
  if (a.kind !== 'dcp_item') return 'none'
  if (isPlayableDcpType(a.contentType)) return 'dcp_existing'
  if (isUnderlineChoiceDcpType(a.contentType)) return 'dcp_underline_dev_only'
  if (isClassifiedDcpType(a.contentType)) return 'adapter_needed'
  return 'none'
}
const RUNNABLE: ReadonlySet<RunnerFormat> = new Set(['dcp_existing', 'csat_item_screen'])

/** 단계별 수 — 근거가 없는 단계는 null(미확인). 앞 단계 값을 뒤 단계로 복사하지 않는다(I10) */
export interface BindingCounts {
  /** manifest 가 주장한 생산 수(검사 통과 시) */
  producedCount: number
  /** 공장 검수 통과 상태의 산출물 수 — 내용 자격과 다르다 */
  reviewPassedCount: number
  /** 지원 실행기에서 재생 가능한 수 */
  runnableCount: number
  /** 공통 자격(accept) ∧ 실행 가능 ∧ 사용 가능 manifest — 학습자별 G 전 */
  commonQualifiedCandidateCount: number
  /** 특정 학습자에게 공급 가능한 수 — G 는 공급 시점 서버 함수가 본다: 여기서는 미확인(null) */
  learnerSuppliableCount: number | null
  /** 실제 납품 기록 수 — 납품 원장(승인안 B)을 읽지 않으면 미확인(null) */
  deliveredCount: number | null
}

export interface WorkspaceContentBinding {
  workspaceId: string | null
  task: string
  role: MaterialRole
  purpose: DemandLine['reason']
  requestId: string
  items: { artifact: { id: string; revision: string }; verdict: ArtifactVerdict; runner: RunnerFormat; bound: boolean }[]
  counts: BindingCounts
  /** = counts.commonQualifiedCandidateCount(하위 호환 이름 — **납품 수가 아니다**) */
  suppliable: number
  planned: number
  /** 후보 충족도(공통 자격 후보 수 / 계획량) — 납품 충족도가 아니다 */
  fulfillment: Fulfillment
  /** 납품 충족도 — 실제 납품 기록이 없으면 'not_delivered' / 기록을 안 읽었으면 'unknown' */
  deliveryFulfillment: 'unknown' | 'not_delivered' | 'partially_delivered' | 'fully_delivered'
  blockedReasons: string[]
  learnerGate: 'check_at_delivery'
  /** 공급 뒤 돌아갈 자리 — 같은 PLAN · TASK */
  returnTo: { planVersion: number | null; task: string }
}

const fulfillmentFrom = (have: number, need: number): Fulfillment => (have <= 0 ? 'not_supplied' : have >= need ? 'fully_supplied' : 'partially_supplied')

/**
 * 결속. `verdicts` 는 산출물 id 로 찾되, **판정의 주체가 그 산출물과 정확히 같을 때만** 쓴다(I02) — 주체 없는 옛 판정 · 다른 revision 판정은 보류.
 * `deliveredRows` 는 납품 원장에서 서버가 읽은 그 줄의 실제 납품 수(없으면 미확인).
 */
export function bindToWorkspace(
  req: FactoryRequest,
  m: FactoryResultManifest,
  verdicts: Record<string, ArtifactVerdict>,
  purpose: DemandLine['reason'],
  deliveredRows: number | null = null,
): WorkspaceContentBinding {
  const blocked = new Set<string>()
  const errors = validateManifest(m, req)
  errors.forEach((x) => blocked.add(`manifest:${x}`))
  if (m.mode === 'MOCK') blocked.add('mock_only')
  if (m.failure) blocked.add(`factory:${m.failure.code}`)
  if (!USABLE.has(m.status)) blocked.add(`manifest_status:${m.status}`)
  const usable = errors.length === 0 && m.mode !== 'MOCK' && USABLE.has(m.status)

  const seen = new Set<string>()
  const items = m.artifacts.map((a) => {
    const runner = runnerFor(a)
    const v = verdicts[a.id]
    const bound = !!v?.subject && sameSubject(v.subject, subjectOf(a))
    const vv: ArtifactVerdict = !v ? verdict(a, 'review_pending', ['not_reviewed']) : bound ? v : verdict(a, 'review_pending', [v.subject ? 'verdict_subject_mismatch' : 'verdict_unbound'])
    if (vv.state !== 'accept') vv.reasons.forEach((r) => blocked.add(r))
    else if (!RUNNABLE.has(runner)) blocked.add(`runner:${runner}`)
    return { artifact: { id: a.id, revision: a.revision }, verdict: vv, runner, bound }
  })
  // 같은 산출물(id · revision · 해시)은 한 번만 센다
  const once = (i: (typeof items)[number], k: number) => {
    const key = canonicalJson(subjectOf(m.artifacts[k]!))
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }
  const unique = items.filter(once)
  const candidates = usable ? unique.filter((i) => i.verdict.state === 'accept' && RUNNABLE.has(i.runner)).length : 0
  const counts: BindingCounts = {
    producedCount: errors.length ? 0 : m.producedCount,
    reviewPassedCount: usable ? unique.length : 0,
    runnableCount: usable ? unique.filter((i) => RUNNABLE.has(i.runner)).length : 0,
    commonQualifiedCandidateCount: candidates,
    learnerSuppliableCount: null,
    deliveredCount: deliveredRows,
  }
  const need = req.quantity.n
  return {
    workspaceId: req.workspaceId, task: req.task, role: req.role, purpose, requestId: req.requestId,
    items, counts, suppliable: candidates, planned: need,
    fulfillment: fulfillmentFrom(candidates, need),
    deliveryFulfillment: deliveredRows === null ? 'unknown' : deliveredRows <= 0 ? 'not_delivered' : deliveredRows >= need ? 'fully_delivered' : 'partially_delivered',
    blockedReasons: [...blocked].sort(),
    learnerGate: 'check_at_delivery', returnTo: { planVersion: req.versions.plan, task: req.task },
  }
}

// ── 6. 기존 자산(R5) — 공장을 거치지 않는 이미 출시된 확인 과제 ─────────────────
/**
 * R5 확인 과제는 기존 출시 · 노출 계약(supplyFor 의 check_task — 출시 승인 · 주석 · 학습자 미노출을 이미 확인한 SupplyLine)으로 공급된다.
 * 연계 계약에서는 EXISTING manifest 로 감싸 같은 결속 경로를 지나게 한다.
 * v1.1(I06): `available` 하나로 출시 · 권리 · 품질 · accept 를 만들지 않는다 —
 *   · SupplyLine 의 역할이 요청 역할과 같고 · 7개 자격(producible · rights · content · teaching · assessment · learner · runnable)이
 *     **모두 true**(기존 출시 계약이 확인한 값)일 때만 accept, 아니면 보류(그 이유를 축 이름으로)
 *   · revision 은 지어낸 'released' 가 아니라 호출자가 준 현재 내용 해시(`hashOf`)로 결속, 권리 · 품질은 공장 주장 칸이라 'unknown' · 'unreviewed'
 *   · 실제 기존 자산 등록부 reader(서버)가 없으면 이 결과는 「기존 계약 위 후보」일 뿐 실제 출시를 증명하지 않는다.
 */
export function existingAssetManifest(req: FactoryRequest, supply: SupplyLine, hashOf: (ref: string) => string): { manifest: FactoryResultManifest; verdicts: Record<string, ArtifactVerdict> } {
  const artifacts: ManifestArtifact[] = supply.delivered.map((d) => {
    const h = hashOf(d.ref)
    return {
      id: d.ref, kind: 'csat_item', revision: `sha256:${h}`, sha256: h, refs: { source: d.ref, analysis: null, gold: null },
      contentType: d.source, tasks: [req.task], roleCandidates: [req.role], access: `csat_items:${d.ref}`, rights: 'unknown', quality: 'unreviewed',
      provenance: { runId: null, mock: false }, lifecycle: 'product',
    }
  })
  const q = supply.qualification
  const missing = (Object.keys(q) as (keyof typeof q)[]).filter((k) => q[k] !== true)
  const reasons = [
    ...(supply.role !== req.role ? ['existing_role_mismatch'] : []),
    ...(supply.state !== 'available' ? ['existing_not_available'] : []),
    ...missing.map((k) => `existing_unverified:${k}`),
  ]
  const verdicts: Record<string, ArtifactVerdict> = {}
  for (const a of artifacts) {
    verdicts[a.id] = reasons.length
      ? verdict(a, 'review_pending', reasons)
      : verdict(a, 'accept', ['existing_release_contract'], { qualificationId: null, rulesVersion: 'existing-release', evidenceIds: [a.id] })
  }
  return {
    manifest: { schema: FACTORY_MANIFEST_SCHEMA, requestId: req.requestId, mode: 'EXISTING', status: 'review_passed', runId: null, producedCount: artifacts.length, artifacts, failure: null, factory: { name: 'existing-assets', version: 'v6.2' } },
    verdicts,
  }
}
