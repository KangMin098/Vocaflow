// apps/web/src/lib/csat/map/v4/observation.ts
//
// FINAL §3 — 통합 관찰 TASK(s.o.sentence_meaning_model · r.o.global_meaning_model · e.o.final_judgment)의 관찰 계약.
// 통합 TASK 는 자기 문항 · 숙달도 점수를 갖지 않는다(정본 criterion 「숙달도 계산 없음 — 관찰 기록만」). 하위 TASK(PART_OF)의 **직접 확인 근거만** 모아
// 세 상태 중 하나로 판정한다:
//   unmeasurable — 측정 불가: 하위 TASK 중 확인 도구가 아예 없는 것이 있다(정본 보류 · 확인 과제도 창작 확인 자료도 없음)
//   insufficient — 근거 부족: 도구는 있지만 하위 TASK 중 직접 확인 판정(verified_need · resolved)이 없는 것이 있다
//   observable   — 통합 관찰 가능: 모든 하위 TASK 에 직접 확인 판정이 있다 — 통합 관찰을 시작할 수 있다는 뜻이지 숙달 판정이 아니다
// 축 기록 proxy(observed · check_first)와 기한 지난 판정(expired)은 근거로 세지 않는다. 점수 · 비율 · 숙달도는 만들지 않는다(타입에 없다).
import type { AsIsMap, TaskEvidence } from './as-is'
import { partsOf, taskOf, type TaskId } from './definition'
import { authoredKeysOf } from '@/lib/knowledge/authored/tasks'

export type ObservationState = 'unmeasurable' | 'insufficient' | 'observable'
export type PartEvidence = 'direct' | 'no_direct' | 'no_instrument'

export interface PartObservation {
  task: TaskId
  status: TaskEvidence | 'missing'
  evidence: PartEvidence
}

export interface IntegratedObservation {
  task: TaskId
  state: ObservationState
  parts: PartObservation[]
  /** 판정을 막은 하위 TASK(측정 불가면 도구 없는 것, 근거 부족이면 직접 판정 없는 것) */
  blocking: TaskId[]
}

const DIRECT: ReadonlySet<TaskEvidence> = new Set(['verified_need', 'resolved'])

function partOf(task: TaskId, asIs: AsIsMap): PartObservation {
  const t = asIs.tasks[task]
  if (!t) return { task, status: 'missing', evidence: 'no_instrument' }
  if (DIRECT.has(t.status) && t.basis === 'direct_check') return { task, status: t.status, evidence: 'direct' }
  const instrument = t.status !== 'unmeasurable' && (t.check !== null || authoredKeysOf(task).length > 0)
  return { task, status: t.status, evidence: instrument ? 'no_direct' : 'no_instrument' }
}

/** 통합 TASK 하나의 관찰 상태. 통합 TASK 가 아니거나 하위 TASK 가 없으면 null(지어내지 않는다) */
export function integratedObservation(task: TaskId, asIs: AsIsMap): IntegratedObservation | null {
  let kind: string | undefined
  try { kind = taskOf(task).kind } catch { return null }
  if (kind !== 'integrated') return null
  const parts = partsOf(task).map((p) => partOf(p, asIs))
  if (parts.length === 0) return null
  const noTool = parts.filter((p) => p.evidence === 'no_instrument').map((p) => p.task)
  if (noTool.length > 0) return { task, state: 'unmeasurable', parts, blocking: noTool }
  const noDirect = parts.filter((p) => p.evidence === 'no_direct').map((p) => p.task)
  if (noDirect.length > 0) return { task, state: 'insufficient', parts, blocking: noDirect }
  return { task, state: 'observable', parts, blocking: [] }
}

export const OBSERVATION_LABEL: Record<ObservationState, string> = {
  unmeasurable: '측정 불가',
  insufficient: '근거 부족',
  observable: '통합 관찰 가능',
}

export const OBSERVATION_NOTE: Record<ObservationState, string> = {
  unmeasurable: '하위 TASK 중 확인할 자료가 아직 없는 것이 있어요 — 학생의 부족이 아니라 준비 상태예요',
  insufficient: '하위 TASK 를 모두 직접 확인하면 통합 관찰을 시작할 수 있어요',
  observable: '하위 TASK 가 모두 직접 확인됐어요 — 통합 관찰을 시작할 수 있어요(숙달 점수는 매기지 않아요)',
}
