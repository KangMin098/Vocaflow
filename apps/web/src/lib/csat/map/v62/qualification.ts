// apps/web/src/lib/csat/map/v62/qualification.ts
//
// v6.2 P-F6b — Factory Qualification(FQ1.0) A~H 자격 결과 ↔ 제품 공급 판정(`supply.ts Qualification`) 변환 계약(순수).
// FQ1-CONTRACT 의 매핑 그대로: rights ← F · content ← A·B·C · teaching ← D · assessment ← E(+ 평가 자격 승인) · learner ← G · runnable ← H.
//   pass → true · fail → false · unknown / not_applicable → null(**pass 로 바꾸지 않는다**).
// 결속: 자격 결과는 특정 콘텐츠 revision · TASK · 역할에 묶인다 — 다른 revision · TASK · 역할의 결과는 쓰지 않는다(상속 금지).
// 공급 가능: 그 역할의 필수 축이 모두 true 이고, 권리 · 출시는 실제 승인 기록(publicQualified)이 있어야 한다. 학습자 노출(G)은 공급 시점에 따로 계산한다.

import type { MaterialRole } from './demand'
import type { Qualification } from './supply'

export type AxisState = 'pass' | 'fail' | 'unknown' | 'not_applicable'
export type Axis = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'

export interface FqResult {
  content: { id: string; revision: string }
  task: string
  role: MaterialRole
  axes: Record<Axis, { state: AxisState }>
  eligibleRoles: string[]
  publicQualified: boolean
  assessmentQualified: boolean
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

/** FQ1 A~H → 제품 Qualification(7 필드). producible 은 생산 능력이라 FQ 축과 무관 — null 로 둔다 */
export function toSupplyQualification(r: FqResult): Qualification {
  const ax = (k: Axis) => b(r.axes[k].state)
  // 권리 · 출시: F 축이 pass 여도 실제 승인 기록(publicQualified)이 없으면 true 가 아니다
  const rights = ax('F') === false ? false : ax('F') === true && r.publicQualified ? true : null
  // 평가: E 축이 pass 여도 평가 자격(사람 Gold · 실채점 · 학생 검증 승인)이 없으면 true 가 아니다
  const assessment = ax('E') === false ? false : ax('E') === true && r.assessmentQualified ? true : null
  return { producible: null, rights, content: all(ax('A'), ax('B'), ax('C')), teaching: ax('D'), assessment, learner: ax('G'), runnable: ax('H') }
}

const ASSESSMENT_ROLES: ReadonlySet<MaterialRole> = new Set(['independent_check', 'transfer', 'delayed_check'])

/**
 * 이 역할로 공급할 수 있는가(학습자 노출 G 는 공급 시점 별도). 필수: 권리 · 내용 · 실행 · (교수 역할) 교수 · (평가 역할) 평가.
 * null 은 통과가 아니다.
 */
export function supplyEligible(q: Qualification, role: MaterialRole): { ok: boolean; missing: (keyof Qualification)[] } {
  const need: (keyof Qualification)[] = ['rights', 'content', 'runnable']
  if (role === 'model_explanation' || role === 'guided_practice') need.push('teaching')
  if (ASSESSMENT_ROLES.has(role)) need.push('assessment')
  const missing = need.filter((k) => q[k] !== true)
  return { ok: missing.length === 0, missing }
}
