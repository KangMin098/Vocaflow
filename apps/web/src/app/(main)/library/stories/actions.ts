// apps/web/src/app/(main)/library/stories/actions.ts
//
// LCP Story S5 — 학습자 독서 서버 액션(얇은 배선). 판정 · RPC · 응답 검사는 lib/library/story/learner.ts.
// - 쿠키 세션 클라이언트(createClient)만 쓴다 — 서비스 주체 클라이언트 · DEV_ADMIN_BYPASS 없음. 매 호출 학습자 판정을 다시 한다.
// - 입력은 unknown 으로 받아 learner.ts 가 런타임으로 검사한다. expectedViewerId 는 쿠키 세션 uid 와 비교하는 전제일 뿐 —
//   RPC 인자 · 권한 근거로 쓰지 않는다(다르면 viewer_changed · 저장 없음).
// - 실패는 throw 하지 않고 StoryLearnerFailure 로 돌려준다. 로그 · 텔레메트리를 남기지 않는다.

'use server'

import {
  completeStoryUnit,
  recordStoryPosition,
  storyLearnerFailure,
  type StoryLearnerClient,
} from '@/lib/library/story/learner'
import type { StoryLearnerResult, StoryPositionResult, StoryUnitCompletionResult, StoryWordSaveOutcome } from '@/lib/library/story/learner-types'
import { saveStoryWord, storyWordSaveFailure, type StoryWordSaveClient } from '@/lib/library/story/save-word'
import { createClient } from '@/lib/supabase/server'

/** 위치 기록(이동만 · 완료 아님). 입력 StoryPositionInput { releaseKey, unitIndex, reason, expectedViewerId(전제일 뿐 권한 아님) }. */
export async function recordStoryPositionAction(input: unknown): Promise<StoryLearnerResult<StoryPositionResult>> {
  try {
    const client = (await createClient()) as unknown as StoryLearnerClient
    return await recordStoryPosition({ client }, input)
  } catch {
    return storyLearnerFailure('temporary')
  }
}

/** 단위 하나 완료(명시적 표시 · 재호출 안전). 입력 StoryCompleteInput { releaseKey, unitIndex, expectedViewerId }. */
export async function completeStoryUnitAction(input: unknown): Promise<StoryLearnerResult<StoryUnitCompletionResult>> {
  try {
    const client = (await createClient()) as unknown as StoryLearnerClient
    return await completeStoryUnit({ client }, input)
  } catch {
    return storyLearnerFailure('temporary')
  }
}

/**
 * D5-I01 고른 낱말 하나를 내 단어장에 담기(명시 행동 · 재호출 안전). 입력 StoryWordSaveInput
 * { releaseKey, unitIndex, wordIndex, surface, expectedViewerId } — 뜻 · 예문 · 원형 · 사용자/텍스트 id 는 받지 않는다.
 * 본문 · 사전 재확인과 저장은 lib/library/story/save-word.ts. 위치 · 완료 · FSRS 를 바꾸지 않는다.
 */
export async function saveStoryWordAction(input: unknown): Promise<StoryWordSaveOutcome> {
  try {
    const client = (await createClient()) as unknown as StoryWordSaveClient
    return await saveStoryWord({ client }, input)
  } catch {
    return storyWordSaveFailure('temporary')
  }
}
