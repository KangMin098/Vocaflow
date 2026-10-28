// apps/web/src/lib/csat/bridge/skill-map.ts
//
// H7 — 여러 기출 유형을 관통하는 「사고 기능」 ↔ 학습지도 TASK 매핑(순수 · 판정 아님).
//   사고 기능 = 대량작업 E 루브릭의 유형군(FAM-CENTRAL · CHAIN · COMPARE …)이 관찰하는 판단. 유형 코드는 csat_items.type 정본 코드.
//   TASK 연결은 여기서 새로 정하지 않는다 — 지도 정본의 자료 탐색 조건 `TASK_CSAT_TYPES`(map/v62/demand.ts)를 뒤집어 계산한다.
//   그래서 정본이 TASK 를 더하거나 유형을 바꾸면 이 매핑도 따라 바뀐다. 정본에 연결이 없는 기능은 `tasks: []`(UNMAPPED) — 추정으로 채우지 않는다.

import { TASK_CSAT_TYPES } from '../map/v62/demand'
import type { TaskId } from '../map/v4/definition'

export type ThinkingSkillId = 'central_generalize' | 'option_correspondence' | 'evidence_chain' | 'context_sense' | 'form_scope' | 'data_compare' | 'notice_scope'

export interface ThinkingSkill {
  id: ThinkingSkillId
  /** 학습자에게 보일 판단 능력 — 「무엇을 판단하는가」 */
  label: string
  /** 이 판단이 실제로 쓰이는 평가원 유형 코드 */
  types: readonly string[]
  /** E 루브릭 근거 코드 군(U2~U4) — 관찰 단위 */
  evidenceCodes: readonly string[]
}

export const THINKING_SKILLS: readonly ThinkingSkill[] = [
  { id: 'central_generalize', label: '글 전체에서 중심 명제를 찾고 알맞은 수준으로 일반화하기', types: ['R-TOPIC', 'R-TITLE', 'R-GIST', 'R-CLAIM'], evidenceCodes: ['EV-U2-CENTRAL-1', 'EV-U4-CENTRAL-1'] },
  { id: 'option_correspondence', label: '선지 표현이 본문 내용과 같은 범위인지 대조하기', types: ['R-PURPOSE', 'R-MOOD'], evidenceCodes: ['EV-U3-OPTION-1'] },
  { id: 'evidence_chain', label: '빈칸 자리의 조건을 앞뒤 근거 연결로 좁히기', types: ['R-BLANK'], evidenceCodes: ['EV-U2-CHAIN-1', 'EV-U4-SLOT-COND-1'] },
  { id: 'context_sense', label: '문맥이 정하는 낱말 뜻·쓰임 판단하기', types: ['R-VOCAB'], evidenceCodes: ['EV-U2-CHAIN-1'] },
  { id: 'form_scope', label: '문장 구조가 허용하는 형태와 범위 판단하기', types: ['R-GRAMMAR'], evidenceCodes: ['EV-U2-CHAIN-1'] },
  { id: 'data_compare', label: '도표 수치를 조건대로 연산·비교하기', types: ['R-CHART'], evidenceCodes: ['EV-U2-COMPARE-1', 'EV-U4-CHART-1'] },
  { id: 'notice_scope', label: '안내문 조건과 예외의 범위 확인하기', types: ['R-NOTICE'], evidenceCodes: ['EV-U4-NOTICE-1'] },
]

/** 사고 기능 → 그 기능의 유형을 자료 조건으로 가진 지도 TASK(정본 TASK_CSAT_TYPES 에서 계산) */
export function tasksOfSkill(id: ThinkingSkillId, taskTypes: Readonly<Record<TaskId, readonly string[]>> = TASK_CSAT_TYPES): TaskId[] {
  const s = THINKING_SKILLS.find((x) => x.id === id)
  if (!s) return []
  return Object.entries(taskTypes).filter(([, types]) => types.some((t) => s.types.includes(t))).map(([task]) => task).sort()
}

/** 유형 코드 → 사고 기능(없으면 null — 매핑 안 된 유형을 다른 기능으로 끼워 넣지 않는다) */
export function skillOfType(type: string | null | undefined): ThinkingSkill | null {
  if (!type) return null
  return THINKING_SKILLS.find((s) => s.types.includes(type)) ?? null
}

/** TASK → 그 TASK 가 기르는 사고 기능(정본 유형 조건이 겹치는 것) */
export function skillsOfTask(task: TaskId, taskTypes: Readonly<Record<TaskId, readonly string[]>> = TASK_CSAT_TYPES): ThinkingSkill[] {
  const types = taskTypes[task] ?? []
  return THINKING_SKILLS.filter((s) => s.types.some((t) => types.includes(t)))
}

/** 문항 하나가 이 TASK 의 사고 기능을 연습하는가 — 정본 조건이 없으면 'unknown'(관련 없음으로 확정하지 않는다) */
export function itemFitsTask(type: string | null | undefined, task: TaskId, taskTypes: Readonly<Record<TaskId, readonly string[]>> = TASK_CSAT_TYPES): 'fits' | 'other' | 'unknown' {
  const types = taskTypes[task]
  if (!type || !types || types.length === 0) return 'unknown'
  return types.includes(type) ? 'fits' : 'other'
}
