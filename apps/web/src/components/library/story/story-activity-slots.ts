// apps/web/src/components/library/story/story-activity-slots.ts
//
// T-0228 — 근거 선택 활동의 진입점(읽기 전용 설정 한 항목). 결정 MP-STORY-LOCATION-20261029(sha ee1fd3e1…7086):
// live r3 의 why-horner-is-safe 하나만, 실제 입력(export 09cde981… · edition 8f38fea6… · activities 20dd1150…)에 결속해 둔다.
// - 이 설정은 「어디서 조회를 시도할지」만 고른다. 정답 · 오답 · 원문 · 해설은 복사하지 않는다. 클라이언트 값을 권한으로 믿지 않는다 —
//   권리 · 정답 · 진도 · 계정 자격은 서버 함수(story_unit_activity)가 매번 판정하고, locked · missing · mismatch 면 활동만 닫는다.
// - 이 발행본 · 이 단위가 아니면(다른 이야기 · 다른 단위 · 식별 불명) 활동 UI 도 RPC 도 없다. 일반 활동 카탈로그로 넓히지 않는다.

import type { StoryActivitySlot } from './story-activity-view'

export const STORY_ACTIVITY_SLOTS: readonly StoryActivitySlot[] = [
  { releaseKey: 'lsr_58490bbd38131e1b2e536c5fe08179e8', activityId: 'why-horner-is-safe', afterUnitId: 'u16', afterUnitIndex: 15 },
]
