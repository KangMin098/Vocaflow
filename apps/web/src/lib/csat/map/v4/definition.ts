// apps/web/src/lib/csat/map/v4/definition.ts
//
// 학습 지도 rev4.0 교육 정의 — 영역 6 · TASK 30 · 기존 라인 54/활동 183 대응 · 관계 · Workspace Template.
// 값은 생성물 definition.data.ts(정적 import)에서만 온다. 이 파일은 조회 · 불변식만 — 순수 함수 · 상수.
// 정본: LEARNING_MAP_VNEXT rev2.1(바꾸지 않는다) · 설계: docs/csat-learner/LEARNING_MAP_V4_ARCHITECTURE.md.

import { V4_DATA } from './definition.data'
import type { Domain, TaskId, V4Data, V4Relation, V4Task, V4Template } from './types'

export type { Domain, TaskId, V4Data, V4Relation, V4Task, V4Template } from './types'

/** 정의(코드북 · 관계 · Workspace) 버전 — 계산 결과에 항상 싣는다 */
export const CANON_VERSION = V4_DATA.version

/**
 * 이 정의 버전이 쓰이기 시작한 시점. 이보다 앞선 기준 시점의 지도는 「당시 정의」가 없으므로 정확한 재현이 아니라
 * **현재 정의로 다시 분석한 것**이다(정의 버전 이력을 저장하기 전까지 — MIGRATION_PLAN §2 `map_v4_definition`).
 */
export const CANON_EFFECTIVE_FROM = '2026-10-10T00:00:00.000Z'

/** 진단 규칙 버전 — As-Is 가 빌려 쓰는 기존 규칙(skill-diagnosis 확정 · 해소 · 만료, 입력 신뢰도, 단계 근거 상태)의 묶음 이름 */
export const RULE_VERSION = 'v4-asis.1(skill-diagnosis D-8 v1.1 · record-quality · learner-path)'

export const DOMAIN_NAME: Record<Domain, string> = Object.fromEntries(V4_DATA.domains.map((d) => [d.axis, d.name])) as Record<Domain, string>
export const DOMAINS: readonly Domain[] = V4_DATA.domains.map((d) => d.axis)

const TASKS = new Map(V4_DATA.tasks.map((t) => [t.id, t]))

export function definition(): V4Data {
  return V4_DATA
}

export const tasks = (): readonly V4Task[] => V4_DATA.tasks
export function taskOf(id: TaskId): V4Task {
  const t = TASKS.get(id)
  if (!t) throw new Error(`알 수 없는 v4 TASK: ${id}`)
  return t
}
export const isHold = (id: TaskId): boolean => taskOf(id).status === 'hold'

/** 기존 라인 → rev4 TASK(라인 판단 · 대응). 라인이 TASK 층이 아니면(B 렌즈 일부 · C · D · I · J4) 빈 배열 */
export const tasksOfLine = (line: string): readonly TaskId[] => V4_DATA.lines[line]?.v4 ?? []

/** 기존 활동(csat_map_task id) → rev4 TASK — 활동 단위 대응이 있으면 그것, 없으면 라인 대응을 상속 */
export function tasksOfActivity(activityId: string): readonly TaskId[] {
  const own = V4_DATA.activityTaskOverride[activityId]
  if (own) return own
  return tasksOfLine(activityId.split('-')[0])
}

/** TASK ← 기존 라인(역대응) — 목표 관련도 계산이 이 라인들의 기준 문항을 쓴다 */
export function linesOfTask(id: TaskId): string[] {
  return Object.entries(V4_DATA.lines).filter(([, l]) => l.v4.includes(id)).map(([code]) => code)
}

export const templates = (): readonly V4Template[] => V4_DATA.templates
export const templateOf = (id: string): V4Template | undefined => V4_DATA.templates.find((t) => t.id === id)

/**
 * 확인 과제 키(knowledge_applications.surface_ref 의 과제 · learning_task_attempts.task_key) → 그 키가 **직접 확인하는** TASK.
 * Template 의 중심 TASK 만 — 보조 TASK 에 같은 판정을 붙이면 확인하지 않은 TASK 가 「확인됨」이 된다(직접 확인 판정은 한 원리 단위 · skill-diagnosis).
 */
export function checkedTaskOfKey(taskKey: string): TaskId | null {
  const t = V4_DATA.templates.find((w) => !w.hold && w.content_keys.includes(taskKey))
  return t && t.core.length === 1 ? t.core[0] : null
}
export const checkKeysOfTask = (id: TaskId): string[] => V4_DATA.templates.filter((w) => !w.hold && w.core.length === 1 && w.core[0] === id).flatMap((w) => w.content_keys)

/** 관계 — 승인된 것만 「구조적 연결」로 쓴다. proposed 는 화면에 「제안 연결」로만(근거 상태 · 요구를 바꾸지 않는다) */
export const relations = (status?: V4Relation['status']): readonly V4Relation[] => (status ? V4_DATA.relations.filter((r) => r.status === status) : V4_DATA.relations)
export const relationOf = (id: string): V4Relation | undefined => V4_DATA.relations.find((r) => r.id === id)

/** 통합 관찰의 구성 원자 — 승인된 PART_OF 로만(정본이 구성을 명시한 S · R · E) */
export function partsOf(integrated: TaskId): TaskId[] {
  return V4_DATA.relations.filter((r) => r.type === 'PART_OF' && r.status === 'approved' && r.to === integrated).map((r) => r.from)
}
