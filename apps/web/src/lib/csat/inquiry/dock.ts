// apps/web/src/lib/csat/inquiry/dock.ts
//
// **탐구 도크 — 네 탐구 요소 ↔ 일곱 장면.** (기출 탐구 작업공간 W2 · docs/csat-learner/WORKSPACE_COMPACT.md)
//
// 장면 정본(ID · 파서 · 별칭 · 기본 task)은 scenes.ts 그대로다. 도크는 그 장면을 학습자가 묻는 네 질문으로 묶어 보여 줄 뿐이다.
//   제목 클릭 = 그 요소에서 마지막으로 본 장면(첫 진입은 대표 장면) · 아이콘 클릭 = 정확한 장면.
// 열람은 완료 · 숙련이 아니다 — 방문 수 · 진행률을 만들지 않는다.

import type { SceneId } from './scenes'

export type DockGroupId = 'understand' | 'design' | 'transfer' | 'explain'

export interface DockGroup {
  id: DockGroupId
  label: string
  scenes: readonly SceneId[]
  /** 첫 진입의 대표 장면 */
  lead: SceneId
}

export const DOCK_GROUPS: readonly DockGroup[] = [
  { id: 'understand', label: '원문 이해', scenes: ['task', 'meaning'], lead: 'meaning' },
  { id: 'design', label: '문항 설계', scenes: ['judgment', 'design'], lead: 'judgment' },
  { id: 'transfer', label: '비교와 원리', scenes: ['compare', 'principle'], lead: 'compare' },
  { id: 'explain', label: '내 설명', scenes: ['explain'], lead: 'explain' },
]

export function groupOf(scene: SceneId): DockGroup {
  return DOCK_GROUPS.find((g) => g.scenes.includes(scene)) ?? DOCK_GROUPS[0]
}

/** 요소별 마지막 장면 — 지금 장면을 그 요소의 마지막으로 기록한다(다른 요소의 기억은 그대로) */
export function rememberScene(last: Partial<Record<DockGroupId, SceneId>>, scene: SceneId): Partial<Record<DockGroupId, SceneId>> {
  const g = groupOf(scene)
  return last[g.id] === scene ? last : { ...last, [g.id]: scene }
}

/** 제목 클릭이 여는 장면 — 그 요소에서 마지막으로 본 장면, 없으면 대표 장면 */
export function titleScene(group: DockGroup, last: Partial<Record<DockGroupId, SceneId>>): SceneId {
  const s = last[group.id]
  return s && group.scenes.includes(s) ? s : group.lead
}
