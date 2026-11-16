// apps/web/src/lib/csat/map/v62/instructional-supplement.ts
//
// T-0083 — 학습 전용 보조 진입(닫힌 표). 정본 core/support 에 넣지 않는다 — 독립성 보류(v6.2 S2/S3)인 TASK 의
//   교수 자료(원리 설명 · 안내 연습)만 그 TASK 와 PART_OF 로 맞닿은 기존 Workspace 안에서 받아 배우게 한다.
//   평가 역할(혼자 확인 · 전이 · 다른 날 확인)은 이 진입으로 요청 · 공급하지 않는다 → 독립 근거 · 숙달 · PLAN 판정과 무관.
//   서버(공급 API · buildDemand)와 화면(WorkspaceModal)이 이 표 하나만 읽는다.

import type { TaskId } from '../v4/definition'

export type InstructionalRole = 'model_explanation' | 'guided_practice'

export interface InstructionalSupplement {
  template: string
  task: TaskId
  roles: readonly InstructionalRole[]
}

export const INSTRUCTIONAL_SUPPLEMENTS: readonly InstructionalSupplement[] = [
  // 긴 문장 뼈대 Workspace 안의 수식 관계(S3) — 독립 확인은 아직 준비 중(정본 독립성 보류)
  { template: 'ws.sentence-core', task: 's.attachment' as TaskId, roles: ['model_explanation', 'guided_practice'] },
]

export function supplementOf(template: string | null | undefined, task: string): InstructionalSupplement | null {
  return INSTRUCTIONAL_SUPPLEMENTS.find((s) => s.template === template && s.task === task) ?? null
}

export function supplementsOfTemplate(template: string): InstructionalSupplement[] {
  return INSTRUCTIONAL_SUPPLEMENTS.filter((s) => s.template === template)
}
