// apps/web/src/lib/learner/prescription-blocks.ts
//
// 처방 5블록의 **이름**. 화면에서 짓지 않는다 (apps/web/CLAUDE.md §학습자가 읽는 이름).
//
// 다섯 중 넷은 이미 이름을 가진 활동이라 `PLAN_ACTIVITIES` 에서 그대로 가져온다.
// 여기서 다시 적으면 계획 화면과 오늘 화면이 같은 활동을 다른 이름으로 부르게 된다 —
// 한글이던 시절 `article` 이 화면마다 '스크립트'/'짧은 글'로 갈렸던 것과 같은 계열의 결함이다.
//
// 하나(`syntax`)만 여기서 정의한다. DCP 문장 배열·삽입은 계획에서 고르는 활동이 아니라
// 처방에만 등장하므로 `PLAN_ACTIVITIES` 에 넣으면 계획 피커에 없던 선택지가 생긴다.
// 그래서 "처방 전용 이름" 으로 이 파일이 소유한다. 화면은 여기서 import 한다.

import { ACTIVITY_BY_ID } from './plan-activities'

export type PrescriptionBlockId = 'review' | 'listen' | 'read' | 'syntax' | 'check'

/** 처방 블록의 표시 이름 — 영어(이름), 설명 문장은 화면이 한국어로 짓는다. */
export const PRESCRIPTION_BLOCK_NAME: Record<PrescriptionBlockId, string> = {
  review: ACTIVITY_BY_ID.flashcard.label, // 'Flashcard'
  listen: ACTIVITY_BY_ID.echo.label, // 'Echo'
  read: ACTIVITY_BY_ID.read.label, // 'Read'
  // 처방 전용 — 계획 피커에는 없다. 문장 단위 구조 연습(order/insert)이라 'Syntax'.
  syntax: 'Syntax',
  check: ACTIVITY_BY_ID.scriptquiz.label, // 'ScriptQuiz'
}

/** 처방 블록의 인지 계층 표기 — 활동 레지스트리와 같은 문자열을 쓴다. */
export const PRESCRIPTION_BLOCK_LAYER: Record<PrescriptionBlockId, string> = {
  review: ACTIVITY_BY_ID.flashcard.layer,
  listen: ACTIVITY_BY_ID.echo.layer,
  read: ACTIVITY_BY_ID.read.layer,
  syntax: 'L5 Structure',
  check: ACTIVITY_BY_ID.scriptquiz.layer,
}
