// apps/web/src/components/library/story/story-activity-slots.ts
//
// T-0228 — 이 화면이 연결한 근거 선택 활동. 승인된 UI 범위(MP-STORY-FACT-20261029) 그대로 live r3 의 why-horner-is-safe 하나다.
// 이 목록은 「어디에 붙일지」만 정한다 — 활동 존재 · 형태 · 정답 · 권리 · 진도 조건은 서버 함수(story_unit_activity)가 매번 다시 확인하고,
// 맞지 않으면(함수 없음 · 진도 미달 · 없는 활동) 화면은 아무것도 그리지 않는다.

import type { StoryActivitySlot } from './story-activity-view'

export const STORY_ACTIVITY_SLOTS: readonly StoryActivitySlot[] = [
  { releaseKey: 'lsr_58490bbd38131e1b2e536c5fe08179e8', activityId: 'why-horner-is-safe', afterUnitIndex: 15 },
]
