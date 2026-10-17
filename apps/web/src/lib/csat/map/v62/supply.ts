// apps/web/src/lib/csat/map/v62/supply.ts
//
// v6.2 P-F2 — 수요(WorkspaceDemand)를 기존 자산에 대 보고 줄마다 공급 상태 · 이유를 낸다(순수 · 생산 · 쓰기 없음).
// 공급원(재사용 순서): ① 검수된 확인 · 전이 과제(주석 · 출시 승인 · 학습자 미노출) ② 공개 v3 기출 해설(P-M3b 노출 규칙) ③ 교재공장 문항 재고(연습 후보).
// 자격(정본 §8 A~G)을 줄마다 따로 기록한다 — 생산 가능 · 권리 · 내용 품질 · 교수 적합 · 평가 적합 · 학습자별 · 실행 가능.
// 교재공장 문항은 Gold · TASK 적합성 검수 · 학습 지도 실행 화면이 없어 「연습 후보(미검증)」까지만 — 독립 확인 · 전이로 공급하지 않는다.
// 「생성 중」은 쓰지 않는다 — 영속 주문 · 작업 큐가 없으므로(P-F0) 부족분은 「생산 경로 확인 필요」로만 돌려준다.

import type { DemandLine, MaterialRole, WorkspaceDemand } from './demand'
import type { StudyItems } from './study-items'

export type SupplyState =
  | 'available' // 지금 쓸 수 있는 자료(역할에 필요한 자격 확인됨)
  | 'readable_unreviewed' // 지금 열람할 수 있는 기존 해설 — 교수 적합성(D) 검수 전이라 정식 공급으로 세지 않는다(I1)
  | 'factory_candidate' // 공장 재고는 있으나 이 역할 · TASK 자격 검수 전
  | 'order_spec_possible' // 부족 — 기존 공정 명령으로 생산 명세를 만들 수 있다(실행 · 적재는 별도)
  | 'awaiting_release' // 자료는 있으나 출시 승인(B7) 대기
  | 'needs_review' // 근거 · 원문 · 권리 확인 필요
  | 'unsupported' // 지금 생산 · 공급 경로가 없다

export type Qualification = {
  /** A 생산 가능 · B 원문 · 권리 · C 내용 품질 · D 교수 적합 · E 평가 적합 · F 학습자별 · G 실행 가능 — 모르면 null */
  producible: boolean | null
  rights: boolean | null
  content: boolean | null
  teaching: boolean | null
  assessment: boolean | null
  learner: boolean | null
  runnable: boolean | null
}

export interface SupplyLine {
  role: MaterialRole
  state: SupplyState
  /** 공급된 자료(문항 id · 원천) — 개수만 많아도 숙달이 아니다 */
  delivered: { ref: string; source: 'check_task' | 'transfer_task' | 'v3_explanation' }[]
  shortfall: number
  qualification: Qualification
  reason: string
}

export interface SupplyInput {
  /** 이 TASK 확인 과제의 학습자 미노출 확인 문항(출시된 것만) */
  unseenCheckItems: string[]
  /** 출시된 전이 문항 중 학습자가 아직 안 푼 것 */
  transferItems: string[]
  /** 출시 승인 대기 전이 초안 수 */
  transferDrafts: number
  /** P-M3b 노출 규칙을 통과한 해설 문항 */
  study: StudyItems
  /** 교재공장 문항 재고(평가원 유형 → 행 수) — 모르면 null */
  factoryStock: Record<string, number> | null
}

const Q = (o: Partial<Qualification>): Qualification => ({ producible: null, rights: null, content: null, teaching: null, assessment: null, learner: null, runnable: null, ...o })

function supplyLine(line: DemandLine, input: SupplyInput): SupplyLine {
  const n = line.quantity.n
  const stock = input.factoryStock ? line.csatTypes.reduce((s, t) => s + (input.factoryStock![t] ?? 0), 0) : null
  switch (line.role) {
    case 'independent_check':
    case 'delayed_check': {
      if (line.taskKeys.length === 0) return { role: line.role, state: 'unsupported', delivered: [], shortfall: n, qualification: Q({ assessment: false }), reason: '직접 확인 과제(검수된 주석 · 채점)가 아직 없는 TASK' }
      const got = input.unseenCheckItems.slice(0, n)
      const q = Q({ producible: true, rights: true, content: true, teaching: true, assessment: true, learner: true, runnable: true })
      if (line.role === 'delayed_check') return { role: line.role, state: got.length ? 'available' : 'unsupported', delivered: got.map((ref) => ({ ref, source: 'check_task' })), shortfall: Math.max(0, n - got.length), qualification: q, reason: '지연 재확인 = 다른 날 안 본 확인 문항(경과 시간 판정은 기존 규칙)' }
      return { role: line.role, state: got.length ? 'available' : 'unsupported', delivered: got.map((ref) => ({ ref, source: 'check_task' })), shortfall: Math.max(0, n - got.length), qualification: q, reason: got.length ? '검수된 확인 과제 · 학습자 미노출' : '안 본 확인 문항이 남지 않았다(공장 문항은 평가 자격이 없어 대신 쓰지 않는다)' }
    }
    case 'transfer': {
      const got = input.transferItems.slice(0, n)
      if (got.length) return { role: line.role, state: 'available', delivered: got.map((ref) => ({ ref, source: 'transfer_task' })), shortfall: Math.max(0, n - got.length), qualification: Q({ producible: true, rights: true, content: true, teaching: true, assessment: true, learner: true, runnable: true }), reason: '출시된 전이 문항 · 확인 묶음 밖' }
      if (input.transferDrafts > 0) return { role: line.role, state: 'awaiting_release', delivered: [], shortfall: n, qualification: Q({ producible: true, rights: true, content: true, assessment: true }), reason: `전이 초안 ${input.transferDrafts}개 출시 승인(B7) 대기` }
      return { role: line.role, state: 'unsupported', delivered: [], shortfall: n, qualification: Q({ assessment: false }), reason: '검수된 전이 문항이 없다 — 맹검 이중 주석 · 원문 결속 · 출시 승인이 필요' }
    }
    case 'source_analysis':
    case 'model_explanation': {
      const got = input.study.items.slice(0, Math.max(n, 3))
      // I1 — 읽을 수 있음 ≠ 교수 검수 · 개인별 납품 완료. 열람은 그대로 두고(delivered 유지) 적격 공급 부족은 n 그대로 센다
      if (got.length) return { role: line.role, state: 'readable_unreviewed', delivered: got.map((s) => ({ ref: s.item, source: 'v3_explanation' })), shortfall: n, qualification: Q({ producible: true, rights: true, content: true, teaching: null, assessment: false, learner: true, runnable: true }), reason: '공개 v3 기출 해설(노출 규칙 통과) — 지금 읽을 수 있음 · 교수 적합성은 사람 검수 전' }
      return { role: line.role, state: input.study.withheld > 0 ? 'needs_review' : 'unsupported', delivered: [], shortfall: n, qualification: Q({ assessment: false }), reason: input.study.withheld > 0 ? '해설을 열 수 있는 문항이 아직 없다(확인 문항을 먼저 풀면 열린다)' : '연결된 기출 해설이 없다' }
    }
    case 'guided_practice': {
      // 재고를 조회하지 않았으면(null) 「없음」으로 단정하지 않는다
      if (stock === null) return { role: line.role, state: 'needs_review', delivered: [], shortfall: n, qualification: Q({ assessment: false }), reason: '교재공장 재고를 이 화면에서 조회하지 않았다(관리 화면 · 실측 문서 참고)' }
      if (stock > 0) return { role: line.role, state: 'factory_candidate', delivered: [], shortfall: n, qualification: Q({ producible: true, rights: null, content: null, teaching: null, assessment: false, learner: null, runnable: false }), reason: `교재공장 ${line.csatTypes.join('/')} 문항 ${stock}개 — TASK 적합성 · 문항 단위 권리 · 학습 지도 실행 화면 미검수` }
      if (line.csatTypes.length) return { role: line.role, state: 'order_spec_possible', delivered: [], shortfall: n, qualification: Q({ producible: null }), reason: '재고 없음 — 기존 공정 명령으로 생산 명세 가능(실행 · 적재는 승인 대상)' }
      return { role: line.role, state: 'unsupported', delivered: [], shortfall: n, qualification: Q({}), reason: '기출 유형 조건 미확인' }
    }
  }
}

export interface SupplyResult {
  demandKey: string
  lines: SupplyLine[]
  /** 이 수요에서 지금 바로 학습할 수 있는 줄이 하나라도 있는가 — 역할 자격이 확인된 공급만(NeedRank 와 별개) */
  anyAvailable: boolean
  /** 검수 전이지만 지금 열람할 수 있는 기존 해설이 있는가(I1 — anyAvailable 과 따로 센다) */
  anyReadable: boolean
}

export type Fulfillment = 'fully_supplied' | 'partially_supplied' | 'not_supplied'

/**
 * 충족도(파생 · v6.2 P-F6) — `available` 은 「지금 하나라도 쓸 수 있다」이지 수량 충족이 아니다. 공급 수 · 부족 수로 따로 가른다.
 * 자격 필드가 null(모름)이면 true 로 치지 않는다 — 평가 역할(독립 확인 · 전이 · 지연)은 assessment === true 일 때만 공급으로 센다.
 */
export function fulfillmentOf(line: SupplyLine): Fulfillment {
  const assessmentRole = line.role === 'independent_check' || line.role === 'transfer' || line.role === 'delayed_check'
  const teachingRole = line.role === 'source_analysis' || line.role === 'model_explanation' || line.role === 'guided_practice'
  // I1 — 교수 역할은 교수 적합성(D)이 확인된 것만 공급으로 센다(SQL fq_role_ok 와 같다). 열람 가능 해설은 readable_unreviewed 로 따로 보인다
  const counted = (assessmentRole && line.qualification.assessment !== true) || (teachingRole && line.qualification.teaching !== true) ? 0 : line.delivered.length
  if (counted === 0) return 'not_supplied'
  return line.shortfall > 0 ? 'partially_supplied' : 'fully_supplied'
}

export function supplyFor(demand: WorkspaceDemand, input: SupplyInput): SupplyResult {
  const lines = demand.lines.map((l) => supplyLine(l, input))
  return { demandKey: demand.key, lines, anyAvailable: lines.some((l) => l.state === 'available' && fulfillmentOf(l) !== 'not_supplied'), anyReadable: lines.some((l) => l.state === 'readable_unreviewed' && l.delivered.length > 0) }
}

export const SUPPLY_STATE_LABEL: Record<SupplyState, string> = {
  available: '지금 쓸 수 있는 자료',
  readable_unreviewed: '지금 읽을 수 있는 기존 해설 · 수업용 검수 전',
  factory_candidate: '교재공장 재고 있음 · 이 학습용 검수 전',
  order_spec_possible: '필요한 자료를 만들 수 있는 공정 있음(아직 주문 안 함)',
  awaiting_release: '자료 준비됨 · 출시 승인 대기',
  needs_review: '근거 · 원문 · 권리 확인 필요',
  unsupported: '지금은 만들 · 공급할 경로가 없음',
}

export const ROLE_LABEL_KO: Record<MaterialRole, string> = {
  source_analysis: '기출 원문 분석',
  model_explanation: '모델 설명',
  guided_practice: '지도 연습',
  independent_check: '독립 확인',
  transfer: '다른 글에 적용',
  delayed_check: '다른 날 다시 확인',
}
