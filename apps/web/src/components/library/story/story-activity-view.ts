// apps/web/src/components/library/story/story-activity-view.ts
//
// T-0228 근거 선택 활동의 화면 판정(순수) — StoryActivity.tsx 가 그대로 부른다.
// - 요청은 { viewerId, releaseKey, activityId, generation } 에 묶는다. 응답은 세대 · 인증(same · 같은 토큰) · 본인 · 발행 키 · 활동이
//   모두 지금과 같을 때만 받는다(늦은 응답 · 계정 변경 · 단위 이동은 버린다).
// - 함수 없음 · 진도 미달 · 없는 활동 · 지원 안 함 · 자료 어긋남 · 권한 문제는 「그리지 않음」이다(오류 안내가 아니다).
//   일시 오류만 「불러오지 못했어요 · 다시 시도」 한 줄이다. 독서는 어느 경우든 그대로다.
// - 다른 답을 고른 뒤 「다시 골라 보기」 로 바꾼 결과는 「도움을 받은 연습」 — 처음 선택과 구분한다. 점수 · 완료 · 숙달 · FSRS · 기록 없음.

import type { StoryActivity, StoryActivityFeedback, StoryActivityOption, StoryLearnerFailure, StoryLearnerResult } from '@/lib/library/story/learner-types'

/** 이 화면이 연결한 활동 하나 — 판정 · 권리 · 진도 조건은 서버 함수가 다시 한다(틀린 등록이면 서버가 거절해 그리지 않을 뿐). */
export interface StoryActivitySlot {
  releaseKey: string
  activityId: string
  /** 판의 after_unit id(기록용 — 화면 판정은 아래 reader 단위 번호로 한다) */
  afterUnitId: string
  /** 이 단위 본문 뒤에만 붙는다(after_unit 의 reader unitIndex). */
  afterUnitIndex: number
}

export function activitySlotFor(slots: readonly StoryActivitySlot[], releaseKey: string | null | undefined, unitIndex: number | null | undefined): StoryActivitySlot | null {
  // 식별 불명(발행 키 · 단위 없음)은 조회하지 않는다
  if (!releaseKey || typeof unitIndex !== 'number') return null
  return slots.find((s) => s.releaseKey === releaseKey && s.afterUnitIndex === unitIndex) ?? null
}

export interface StoryActivityRequestKey {
  viewerId: string
  releaseKey: string
  activityId: string
  generation: number
  /** 인증 경계 세대(StoryAuthGuard.token()) */
  authToken: number
}

export interface StoryActivityNow {
  generation: number
  viewerId: string | null
  releaseKey: string
  activityId: string
  authCurrent: (token: number) => boolean
}

/** 보낸 요청의 응답을 지금 받아도 되는가. */
export function acceptsActivityResponse(
  key: StoryActivityRequestKey,
  now: StoryActivityNow,
  data: { viewerId: string; releaseKey: string; activityId: string },
): boolean {
  return (
    key.generation === now.generation &&
    now.authCurrent(key.authToken) &&
    key.viewerId === now.viewerId &&
    data.viewerId === key.viewerId &&
    key.releaseKey === now.releaseKey &&
    data.releaseKey === key.releaseKey &&
    key.activityId === now.activityId &&
    data.activityId === key.activityId
  )
}

/** 실패 → 그리지 않음(hidden) 또는 다시 시도(retry). 일시 오류만 다시 시도다. */
export function activityFailureView(failure: StoryLearnerFailure): 'hidden' | 'retry' {
  return failure.code === 'temporary' ? 'retry' : 'hidden'
}

function sameOption(a: StoryActivityOption, b: StoryActivityOption): boolean {
  return a.optionId === b.optionId && a.unitIndex === b.unitIndex && a.start === b.start && a.end === b.end && a.quote === b.quote
}

/** 제출 결과가 화면에 보인 선택지와 맞물리는가 — 고른 것 = 보낸 선택 · 두 근거 모두 보인 선택지 그대로. */
export function feedbackMatchesActivity(activity: StoryActivity, choice: string, fb: StoryActivityFeedback): boolean {
  if (fb.choice !== choice || fb.chosen.optionId !== choice) return false
  const chosen = activity.options.find((o) => o.optionId === fb.chosen.optionId)
  const registered = activity.options.find((o) => o.optionId === fb.registered.optionId)
  return !!chosen && !!registered && sameOption(chosen, fb.chosen) && sameOption(registered, fb.registered)
}

export type StoryActivityState =
  | { phase: 'loading' }
  | { phase: 'hidden' }
  | { phase: 'retry' }
  | {
      phase: 'ready'
      activity: StoryActivity
      selected: string | null
      submitting: boolean
      /** 제출 결과(없으면 아직 고르는 중) */
      feedback: StoryActivityFeedback | null
      /** 다른 답 뒤 다시 고른 시도 — 「도움을 받은 연습」 */
      assisted: boolean
      /** 제출 대기 중 다른 선택지를 골라 결과를 버렸는가(다시 제출 필요 안내) */
      stale: boolean
    }

export type StoryActivityEvent =
  | { type: 'loaded'; result: StoryLearnerResult<StoryActivity> }
  | { type: 'select'; optionId: string }
  | { type: 'submit' }
  | { type: 'submitted'; result: StoryLearnerResult<StoryActivityFeedback> }
  | { type: 'retry_choice' }
  | { type: 'reload' }
  | { type: 'reset' }

/**
 * 상태 전이. 세대 · 인증 결속(acceptsActivityResponse)은 부르는 쪽이 먼저 확인하고, 받기로 한 응답만 loaded · submitted 로 넣는다.
 * select 는 결과가 나온 뒤에는 무시한다(다시 고르려면 「다시 골라 보기」).
 */
export function reduceActivity(state: StoryActivityState, ev: StoryActivityEvent): StoryActivityState {
  switch (ev.type) {
    case 'reset':
      return { phase: 'hidden' }
    case 'reload':
      return { phase: 'loading' }
    case 'loaded':
      if (state.phase !== 'loading') return state
      if (!ev.result.ok) return { phase: activityFailureView(ev.result) }
      return { phase: 'ready', activity: ev.result.data, selected: null, submitting: false, feedback: null, assisted: false, stale: false }
    case 'select':
      if (state.phase !== 'ready' || state.feedback) return state
      if (!state.activity.options.some((o) => o.optionId === ev.optionId)) return state
      if (state.selected === ev.optionId) return state
      return { ...state, selected: ev.optionId, submitting: false, stale: state.submitting }
    case 'submit':
      if (state.phase !== 'ready' || state.feedback || state.submitting || !state.selected) return state
      return { ...state, submitting: true, stale: false }
    case 'submitted': {
      if (state.phase !== 'ready' || !state.submitting || !state.selected) return state
      if (!ev.result.ok) {
        const view = activityFailureView(ev.result)
        // 일시 오류는 고른 것을 둔 채 다시 제출할 수 있다 · 그 밖(계정 · 권한 · 자료)은 활동을 닫는다
        return view === 'retry' ? { ...state, submitting: false, stale: true } : { phase: 'hidden' }
      }
      if (!feedbackMatchesActivity(state.activity, state.selected, ev.result.data)) return { phase: 'hidden' }
      return { ...state, submitting: false, feedback: ev.result.data }
    }
    case 'retry_choice':
      if (state.phase !== 'ready' || !state.feedback || state.feedback.correct) return state
      return { ...state, feedback: null, selected: null, assisted: true, stale: false }
  }
}

/** 고른 근거 · 본문에 등록된 근거 — 결과 문구는 기능 안내만(해설 · 번역 · 오답별 설명 없음). */
export function feedbackHeadline(fb: StoryActivityFeedback): string {
  return fb.correct ? '등록된 근거와 같아요' : '등록된 근거와 달라요'
}

export const ACTIVITY_LABELS = {
  chosen: '내가 고른 근거',
  registered: '본문에 등록된 근거',
  revisit: '본문에서 다시 확인',
  retry: '다시 골라 보기',
  assisted: '도움을 받은 연습',
  submit: '제출',
  unavailable: '이 활동을 지금 불러오지 못했어요',
} as const

/** 근거 인용의 시작 위치(UTF-16 offset)가 본문의 몇 번째 낱말인가 — 본문 구간이 인용과 다르면 null(돌아가기 조작을 그리지 않는다). */
export function quoteWordIndex(unitText: string, option: StoryActivityOption, countWords: (s: string) => number): number | null {
  if (option.end > unitText.length || unitText.slice(option.start, option.end) !== option.quote) return null
  return countWords(unitText.slice(0, option.start))
}
