// apps/web/src/lib/csat/map/v62/production-pilot.ts
//
// v6.2 P-F5a · P-F5b(dry-run) — TASK · 활동 단위 생산의 최소 확장을 **명세로만** 세운다(생산 · 적재 · 공개 없음).
//   ProductionUnit  = 공장이 실제로 생성 · 검수할 수 있는 단위 — 지금은 권(series × step)뿐이다(P-F0). 활동 단위는 미지원으로 적는다.
//   DeliveryPackage = Workspace 가 학습자에게 받을 묶음 — 연구 v1.5 의 TASK 후보(원문 결속 · 역할)를 「생산 요구 명세」로 쓴다.
// 규칙: 첫 파일럿은 **지도 연습** 역할만(독립 확인 · 전이로 승격 금지) · 연구 AI 검수 ≠ 공개 적격 · 원천 시험이 미지원(2014A/B · M2009)이면 생산 원천에서 제외.

import type { TaskId } from '../v4/definition'

import type { DemandLine } from './demand'
import { orderSpecFor, type OrderSpec } from './order-spec'
import V15 from './research-v15.data.json'

/** 시험 원천 상태(연구 v1.5 실측) — 정답표 · 문제지 · 시험 id 가 맞지 않거나 DB 전체 키가 없는 시험. 해당 시험이 역사적으로 없었다는 뜻이 아니다 */
export const UNSUPPORTED_EXAMS: ReadonlySet<string> = new Set(V15.examSources.unsupported)

/** 문항 id(<시험>#<번호>)의 시험이 생산 원천으로 쓸 수 있는가 */
export function examSourceUsable(item: string): boolean {
  return !UNSUPPORTED_EXAMS.has(item.split('#')[0])
}

export interface PilotCandidate {
  id: string
  item: string
  usable: boolean
  /** 막힌 이유 */
  blocked: null | 'unsupported_exam_source'
  /** 원 문항의 TASK 관련성(연구 기록 그대로 — 파생 활동과 원 문항을 구별) */
  originalRelevance: string
}

export interface ProductionPilot {
  task: TaskId
  workspace: string
  /** 공장 생산 단위 */
  productionUnit: { factoryTypes: string[]; unit: 'volume'; activityUnitSupported: false; spec: OrderSpec }
  /** Workspace 공급 묶음(설계) */
  deliveryPackage: { allowedRole: 'guided_practice'; candidates: PilotCandidate[] }
  /** 자격 — 연구 v1.5 실측 그대로(공개 0 · 직접 평가 0 · 학생 0) */
  qualification: { publicQualified: number; assessmentQualified: number; students: number; release: 'hold' }
  /** 실제로 돌리려면 필요한 승인 */
  approvals: OrderSpec['approvals']
}

const WORKSPACE_OF: Record<string, string> = { 'v.contextual_sense': 'ws.vocab-context', 's.form_scope': 'ws.grammar-scope' }
const CSAT_OF: Record<string, string[]> = { 'v.contextual_sense': ['R-VOCAB'], 's.form_scope': ['R-GRAMMAR'] }

/** V2 · S5 파일럿 명세 — 다른 TASK 는 null(연구 패킷 없음) */
export function productionPilotFor(task: TaskId): ProductionPilot | null {
  const ws = WORKSPACE_OF[task]
  if (!ws) return null
  const line: DemandLine = {
    role: 'guided_practice', task, taskKeys: [], csatTypes: CSAT_OF[task], quantity: { n: 1, unit: '문항' },
    requires: { rightsUsable: true, gold: false, unseenByLearner: false, noExplanationBefore: false }, reuse: true, reason: 'stage_repair',
  }
  const spec = orderSpecFor(line)
  const candidates: PilotCandidate[] = V15.candidates
    .filter((c) => c.task === task)
    .map((c) => {
      const usable = examSourceUsable(c.item)
      return { id: c.id, item: c.item, usable, blocked: usable ? null : 'unsupported_exam_source', originalRelevance: c.originalRelevance }
    })
  return {
    task,
    workspace: ws,
    productionUnit: { factoryTypes: spec.factoryTypes, unit: 'volume', activityUnitSupported: false, spec },
    deliveryPackage: { allowedRole: 'guided_practice', candidates },
    qualification: { publicQualified: V15.counts.publicQualified, assessmentQualified: V15.counts.assessmentQualified, students: V15.counts.students, release: 'hold' },
    approvals: spec.approvals,
  }
}
