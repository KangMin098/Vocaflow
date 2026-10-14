// apps/web/src/lib/csat/map/v62/qualification.ts
//
// v6.2 P-F6b · P-F7c — Factory Qualification(FQ1.0) A~H 자격 결과 ↔ 제품 공급 판정(`supply.ts Qualification`) 변환 계약(순수).
// FQ1-CONTRACT 의 매핑 그대로: rights ← F · content ← A·B·C · teaching ← D · assessment ← E · learner ← G · runnable ← H.
//   pass → true · fail → false · unknown / not_applicable → null(**pass 로 바꾸지 않는다**).
// 결속: 자격 결과는 특정 콘텐츠 revision · TASK · 역할에 묶인다 — 다른 revision · TASK · 역할의 결과는 쓰지 않는다(상속 금지).
// 출시 · 평가 승인(P-F7c): 연구 결과의 `publicQualified` · `assessmentQualified` 플래그는 **승인으로 인정하지 않는다.**
//   제품 서버가 검증한 승인 기록(`ReleaseApproval` — 원장 `content_release_approval`, 철회 없음)이 있을 때만 rights · assessment 가 true.
// G(학습자 노출)는 콘텐츠 공통 자격이 아니다 — 공급 시점에 학습자별로 `deliveryCheck` 가 본다(SQL `workspace_delivery_record` 와 같은 규칙).
// DB 원장 · 공급 함수: `supabase/migrations/_pending_workspace_supply_{c_qualification,b_orders}.sql`.

import type { MaterialRole } from './demand'
import type { Qualification } from './supply'

export type AxisState = 'pass' | 'fail' | 'unknown' | 'not_applicable'
export type Axis = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'

/** 연구 원장에서 옮긴 판정(읽기 전용 스냅샷) — 플래그는 참고일 뿐 승인이 아니다 */
export interface FqResult {
  content: { id: string; revision: string }
  task: string
  role: MaterialRole
  axes: Record<Axis, { state: AxisState }>
  eligibleRoles: string[]
  publicQualified: boolean
  assessmentQualified: boolean
}

/** 영속 자격 원장 한 행(`content_qualification`) — 요약만이 아니라 근거를 함께 보존한다 */
export interface QualificationRecord {
  id: string
  rulesVersion: string
  artifact: { kind: 'dcp_item' | 'csat_item' | 'textbook_activity' | 'workspace_bundle'; ref: string; revision: string }
  source: { revision: string | null; hash: string | null }
  analysisRevision: string | null
  gold: { revision: string | null; hash: string | null }
  task: string
  role: MaterialRole
  axes: Record<Axis, { state: AxisState; defect?: string }>
  defects: string[]
  evidenceIds: string[]
  method: string
  supersedes: string | null
  createdAt: string
}

/** 서버가 원장에서 읽은 승인(철회 여부 포함). 클라이언트 입력으로 만들지 않는다 */
export interface ReleaseApproval {
  id: string
  qualificationId: string
  scope: 'public' | 'assessment'
  approverRole: 'admin' | 'curator'
  revoked: boolean
}

const b = (s: AxisState): boolean | null => (s === 'pass' ? true : s === 'fail' ? false : null)

/** 여러 축을 한 값으로 — 하나라도 false 면 false, 전부 true 면 true, 아니면 null */
function all(...xs: (boolean | null)[]): boolean | null {
  if (xs.some((x) => x === false)) return false
  return xs.every((x) => x === true) ? true : null
}

export type BindingError = 'revision_mismatch' | 'task_mismatch' | 'role_mismatch'

/** 자격 결과를 이 콘텐츠 revision · 수요 TASK · 역할에 대 본다 — 하나라도 다르면 쓰지 않는다 */
export function bindResult(r: FqResult, want: { contentId: string; revision: string; task: string; role: MaterialRole }): { ok: true } | { ok: false; error: BindingError } {
  if (r.content.id !== want.contentId || r.content.revision !== want.revision) return { ok: false, error: 'revision_mismatch' }
  if (r.task !== want.task) return { ok: false, error: 'task_mismatch' }
  if (r.role !== want.role) return { ok: false, error: 'role_mismatch' }
  return { ok: true }
}

/** 이 자격 행에 유효한(철회 안 된) 승인이 범위별로 있는가 — 다른 자격 행의 승인은 세지 않는다 */
export function approvalState(qualificationId: string, approvals: readonly ReleaseApproval[]): { public: boolean; assessment: boolean } {
  const live = approvals.filter((a) => a.qualificationId === qualificationId && !a.revoked)
  return { public: live.some((a) => a.scope === 'public'), assessment: live.some((a) => a.scope === 'assessment') }
}

/**
 * FQ1 A~H → 제품 Qualification(7 필드). producible 은 생산 능력이라 FQ 축과 무관 — null.
 * `approval` 은 서버가 원장에서 계산한 값(`approvalState`)만 넘긴다. 없으면 권리 · 평가는 true 가 될 수 없다.
 */
export function toSupplyQualification(r: Pick<FqResult, 'axes'>, approval: { public: boolean; assessment: boolean } = { public: false, assessment: false }): Qualification {
  const ax = (k: Axis) => b(r.axes[k].state)
  const rights = ax('F') === false ? false : ax('F') === true && approval.public ? true : null
  const assessment = ax('E') === false ? false : ax('E') === true && approval.assessment ? true : null
  return { producible: null, rights, content: all(ax('A'), ax('B'), ax('C')), teaching: ax('D'), assessment, learner: ax('G'), runnable: ax('H') }
}

export const ASSESSMENT_ROLES: ReadonlySet<MaterialRole> = new Set(['independent_check', 'transfer', 'delayed_check'])

/**
 * 이 역할로 공급할 수 있는가(콘텐츠 공통 자격). 필수: 권리 · 내용 · 실행 · (교수 역할) 교수 · (평가 역할) 평가.
 * null 은 통과가 아니다. G(학습자 노출)는 여기서 보지 않는다 — `deliveryCheck`.
 */
export function supplyEligible(q: Qualification, role: MaterialRole): { ok: boolean; missing: (keyof Qualification)[] } {
  const need: (keyof Qualification)[] = ['rights', 'content', 'runnable']
  // 교수 역할 — 원문 분석도 교수 적합성(D) 필수(FQ1.1 역할 기준 · Codex I11). D not_applicable 은 null 이라 통과가 아니다
  if (role === 'source_analysis' || role === 'model_explanation' || role === 'guided_practice') need.push('teaching')
  if (ASSESSMENT_ROLES.has(role)) need.push('assessment')
  const missing = need.filter((k) => q[k] !== true)
  return { ok: missing.length === 0, missing }
}

/**
 * 이 학습자가 이 산출물을 이미 본 정도. `unknown` = 노출 기록이 없는 종류(공유 지문 · 해설 열람 기록 미구축).
 * 서버가 기록(시도 · 열람)에서 계산한다.
 */
export type Exposure = 'none' | 'attempted' | 'explanation_seen' | 'shared_passage_seen' | 'unknown'

/**
 * 공급 시점 판정 — 콘텐츠 자격 + G(학습자별 노출). 평가 역할은 독립 첫 시도를 보존해야 하므로 노출이 'none' 일 때만.
 * 노출을 모르면(unknown) 평가 역할은 **실패**(fail-closed). 교수 · 연습 역할은 노출과 무관.
 */
export function deliveryCheck(q: Qualification, role: MaterialRole, exposure: Exposure): { ok: boolean; missing: string[] } {
  const base = supplyEligible(q, role)
  const missing: string[] = [...base.missing]
  if (ASSESSMENT_ROLES.has(role) && exposure !== 'none') missing.push(`learner:${exposure}`)
  return { ok: missing.length === 0, missing }
}
