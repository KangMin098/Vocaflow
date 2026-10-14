// apps/web/src/lib/csat/map/v62/demand.ts
//
// v6.2 P-F1 — WorkspaceDemand: 학습 묶음(Workspace)이 「지금 이 학습자에게 어떤 자료가 필요한가」를 교재공장 · 기존 자산에 요청하는 계약(순수).
// 판정하지 않는다 — composeV4 의 단계 · 요구 · 계획량을 그대로 읽어 자료 역할(원문 분석 · 모델 설명 · 지도 연습 · 독립 확인 · 전이 · 지연 재확인)로 바꾼다.
// 불변식: 교육적 필요는 재고와 따로 존재한다(재고 0 이어도 수요 줄은 남는다) · 계획량 ≠ 목표 달성 총량 · 정답률을 숙달률로 바꾸지 않는다.
// 학습자 id 는 넣지 않는다 — 서버가 인증으로 붙인다. 멱등 키는 같은 학습자 · 같은 버전 · 같은 내용이면 같다(시각은 넣지 않는다).

import type { V4View } from '../v4/compose'
import { CANON_VERSION, checkKeysOfTask, taskOf, templateOf, type TaskId } from '../v4/definition'
import type { StageKey } from '../v4/workspace'
import { TRANSFER_PASSAGES } from '../v4/workspace'
import { CHECK_ITEMS, VERIFY_ITEMS } from '../skill-diagnosis'

export type MaterialRole = 'source_analysis' | 'model_explanation' | 'guided_practice' | 'independent_check' | 'transfer' | 'delayed_check'

export interface DemandLine {
  role: MaterialRole
  task: TaskId
  /** 이 TASK 를 직접 다루는 확인 과제 키(있으면 그 주석 계약으로 공급) */
  taskKeys: string[]
  /** 기출 유형 조건(평가원 유형 코드) — 모르면 빈 배열(= 미확인, 무관 아님) */
  csatTypes: string[]
  quantity: { n: number; unit: '문항' }
  /** 이 역할에 필요한 자격 — 공급 쪽이 하나씩 확인한다 */
  requires: { rightsUsable: true; gold: boolean; unseenByLearner: boolean; noExplanationBefore: boolean }
  /** 기존 자산 재사용 허용 */
  reuse: true
  /** 왜 이 줄이 생겼나(교육적 이유 코드) */
  reason: 'stage_check' | 'stage_repair' | 'stage_transfer' | 'stage_recheck' | 'maintain' | 'need_without_stage'
}

export interface WorkspaceDemand {
  key: string
  template: string | null
  workspaceId: string | null
  goalVersion: number | null
  planVersion: number | null
  definitionVersion: string
  asOf: string
  core: TaskId
  support: TaskId[]
  purpose: {
    need: string | null
    evidence: string
    /** 판정에 쓴 독립 첫 시도 문항 수(분모) — 정답률 · 숙달률이 아니다 */
    independentItems: number | null
    unknowns: string[]
  }
  lines: DemandLine[]
}

/**
 * TASK → 평가원 유형 조건. 연구 v1.4 의 「직접 · 간접」 사례 유형과 rev4 확인 과제가 쓰는 유형에서 온 **자료 탐색 조건**이지 관련성 판정이 아니다.
 * 없는 TASK 는 빈 배열(미확인).
 */
export const TASK_CSAT_TYPES: Readonly<Record<TaskId, readonly string[]>> = {
  'r.central_meaning': ['R-TOPIC', 'R-TITLE', 'R-GIST', 'R-CLAIM'],
  'e.option_correspondence': ['R-TOPIC', 'R-TITLE', 'R-GIST', 'R-CLAIM', 'R-PURPOSE', 'R-MOOD'],
  'e.evidence_location': ['R-BLANK'],
  'v.contextual_sense': ['R-VOCAB'],
  's.form_scope': ['R-GRAMMAR'],
}

const STAGE_ROLES: Record<StageKey, { role: MaterialRole; reason: DemandLine['reason'] }[]> = {
  check: [{ role: 'independent_check', reason: 'stage_check' }],
  repair: [{ role: 'source_analysis', reason: 'stage_repair' }, { role: 'model_explanation', reason: 'stage_repair' }, { role: 'guided_practice', reason: 'stage_repair' }],
  transfer: [{ role: 'transfer', reason: 'stage_transfer' }],
  recheck: [{ role: 'independent_check', reason: 'stage_recheck' }],
}

const REQUIRES: Record<MaterialRole, DemandLine['requires']> = {
  source_analysis: { rightsUsable: true, gold: false, unseenByLearner: false, noExplanationBefore: false },
  model_explanation: { rightsUsable: true, gold: false, unseenByLearner: false, noExplanationBefore: false },
  guided_practice: { rightsUsable: true, gold: false, unseenByLearner: false, noExplanationBefore: false },
  independent_check: { rightsUsable: true, gold: true, unseenByLearner: true, noExplanationBefore: true },
  transfer: { rightsUsable: true, gold: true, unseenByLearner: true, noExplanationBefore: true },
  delayed_check: { rightsUsable: true, gold: true, unseenByLearner: true, noExplanationBefore: true },
}

/** 역할별 기본 수량 — 계획량이 있으면 그것, 없으면 정본 규칙의 최소(확정 2 · 재확인 2 · 전이 2지문). 목표 달성 총량이 아니다 */
function quantityOf(role: MaterialRole, planned: number | null): number {
  if (planned !== null && planned > 0) return planned
  if (role === 'independent_check') return Math.max(VERIFY_ITEMS, CHECK_ITEMS)
  if (role === 'transfer') return TRANSFER_PASSAGES
  return 1
}

/** 결정적 문자열 해시(FNV-1a 32bit · 16진) — 멱등 키용. 보안 서명이 아니다 */
function fnv(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

export interface DemandContext {
  workspaceId: string | null
  planVersion: number | null
  goalVersion: number | null
}

/** 한 TASK · 그 TASK 의 학습 묶음에 대한 수요. 묶음이 없거나(콘텐츠 준비 전) 단계가 없어도 교육적 필요가 있으면 줄을 남긴다 */
export function buildDemand(view: V4View, task: TaskId, template: string | null, ctx: DemandContext): WorkspaceDemand {
  const def = taskOf(task)
  const plan = view.taskPlans.find((p) => p.task === task) ?? null
  const asIs = view.asIs.tasks[task]
  const tpl = template ? templateOf(template) ?? null : null
  const stage = plan?.stage ?? null
  const csatTypes = [...(TASK_CSAT_TYPES[task] ?? [])]
  const keys = checkKeysOfTask(task)
  const base = (role: MaterialRole, reason: DemandLine['reason']): DemandLine => ({
    role,
    task,
    taskKeys: keys,
    csatTypes,
    quantity: { n: quantityOf(role, role === 'independent_check' || role === 'transfer' ? plan?.quantity.planned ?? null : null), unit: '문항' },
    requires: REQUIRES[role],
    reuse: true,
    reason,
  })
  const lines: DemandLine[] = []
  if (def.status !== 'hold') {
    if (stage) for (const s of STAGE_ROLES[stage]) lines.push(base(s.role, s.reason))
    else if (plan?.need === 'MAINTAIN') lines.push(base('delayed_check', 'maintain'))
    // 단계가 없어도(콘텐츠 없음 · 목표 없음) 교육적 필요가 있으면 확인 수요를 남긴다 — 재고 0 을 「무관」으로 바꾸지 않는다
    else if (plan?.need || !view.toBe) lines.push(base('independent_check', 'need_without_stage'))
  }
  const unknowns: string[] = []
  if (csatTypes.length === 0) unknowns.push('csat_type_condition_unknown')
  if (keys.length === 0) unknowns.push('no_direct_check_task')
  if (view.toBe?.relevanceUnknown.includes(task)) unknowns.push('goal_relevance_unknown')
  if (def.status === 'hold') unknowns.push('canon_hold')
  const body = {
    template, workspaceId: ctx.workspaceId, goalVersion: ctx.goalVersion, planVersion: ctx.planVersion, definitionVersion: CANON_VERSION, core: task,
    lines: lines.map((l) => [l.role, l.quantity.n, l.reason]),
  }
  return {
    key: `wd-${fnv(JSON.stringify(body))}`,
    template,
    workspaceId: ctx.workspaceId,
    goalVersion: ctx.goalVersion,
    planVersion: ctx.planVersion,
    definitionVersion: CANON_VERSION,
    asOf: view.asIs.asOf,
    core: task,
    support: tpl ? tpl.support : [],
    purpose: { need: plan?.need ?? null, evidence: asIs.status, independentItems: asIs.check?.independentItems ?? null, unknowns },
    lines,
  }
}
