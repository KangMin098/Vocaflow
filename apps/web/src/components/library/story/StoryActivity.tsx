// apps/web/src/components/library/story/StoryActivity.tsx
//
// T-0228 근거 선택 활동(after_unit 하나) — 주장과 질문을 두고 본문 인용 선택지 중 근거 하나를 고른 뒤 명시적으로 제출하면
// 「내가 고른 근거」와 「본문에 등록된 근거」를 나란히 보여 주고 「본문에서 다시 확인」으로 그 문장을 본문에서 다시 보게 한다.
// - 조회 1회 · 명시적 제출 1회(서버 함수 story_unit_activity). 제출 전에는 정답 · 등록 근거가 화면에 없다(서버도 주지 않는다).
// - 함수 없음(승인 전 미적용) · 진도 미달 · 없는 활동 · 자료 어긋남 · 권한 문제 → 아무것도 그리지 않는다. 일시 오류만 한 줄 + 다시 시도.
// - 요청은 { viewerId, releaseKey, activityId, generation, authToken } 에 묶는다 — 늦은 응답 · 계정 변경 · 단위 이동은 버린다
//   (판정은 story-activity-view.ts). 다시 고른 결과는 「도움을 받은 연습」. 점수 · 완료 · 진도 · FSRS · 이벤트 · 저장소 기록 없음.
// - 선택지는 네이티브 radio(fieldset · legend) — 화살표 · Space 로 고른다. 조작 높이 44px · 보이는 초점 · 결과는 role=status 로 알리고
//   결과 머리로 초점을 한 번 옮긴다. 정오는 색이 아니라 문구로 구분한다.

'use client'

import { useEffect, useReducer, useRef, type RefObject } from 'react'

import type {
  StoryActivity as StoryActivityData,
  StoryActivityFeedback,
  StoryActivityLoadInput,
  StoryActivityOption,
  StoryActivitySubmitInput,
  StoryLearnerResult,
} from '@/lib/library/story/learner-types'

import styles from './story.module.css'
import {
  ACTIVITY_LABELS,
  acceptsActivityResponse,
  feedbackHeadline,
  quoteWordIndex,
  reduceActivity,
  type StoryActivityRequestKey,
  type StoryActivitySlot,
  type StoryActivityState,
} from './story-activity-view'
import { tokenizeWords } from './story-view'

export interface StoryActivityCalls {
  load(input: StoryActivityLoadInput): Promise<StoryLearnerResult<StoryActivityData>>
  submit(input: StoryActivitySubmitInput): Promise<StoryLearnerResult<StoryActivityFeedback>>
}

/** 화면이 쓰는 인증 경계의 부분(StoryAuthGuard 가 만족한다). */
export interface StoryActivityAuth {
  token(): number
  isCurrent(token: number): boolean
}

const countWords = (s: string) => tokenizeWords(s).next

export function StoryActivity({
  slot,
  viewerId,
  auth,
  calls,
  unitIndex,
  unitText,
  onRevisit,
}: {
  slot: StoryActivitySlot
  viewerId: string
  auth: StoryActivityAuth
  calls: StoryActivityCalls
  /** 지금 화면의 단위(이 단위의 근거만 본문에서 다시 볼 수 있다). */
  unitIndex: number
  unitText: string
  /** 본문의 그 낱말이 든 문장으로 이동 · 강조(StoryUnitText 복귀 강조 재사용). */
  onRevisit: (wordIndex: number, kind: 'chosen' | 'registered') => void
}) {
  const [state, dispatch] = useReducer(reduceActivity, { phase: 'loading' } as StoryActivityState)
  const genRef = useRef(0)
  const live = useRef({ viewerId, slot, auth, calls })
  live.current = { viewerId, slot, auth, calls }
  const headRef = useRef<HTMLParagraphElement>(null)
  const focusedFor = useRef<StoryActivityFeedback | null>(null)
  // 「다시 골라 보기」로 누른 단추가 사라진다 — 선택지가 다시 그려진 직후 첫 radio 로 초점을 한 번 옮긴다
  const optionsRef = useRef<HTMLFieldSetElement>(null)
  const refocusOptions = useRef(false)

  const now = () => ({
    generation: genRef.current,
    viewerId: live.current.viewerId,
    releaseKey: live.current.slot.releaseKey,
    activityId: live.current.slot.activityId,
    authCurrent: (t: number) => live.current.auth.isCurrent(t),
  })
  const newKey = (): StoryActivityRequestKey => {
    genRef.current += 1
    return { viewerId, releaseKey: slot.releaseKey, activityId: slot.activityId, generation: genRef.current, authToken: auth.token() }
  }

  const load = () => {
    const key = newKey()
    if (!auth.isCurrent(key.authToken)) {
      dispatch({ type: 'reset' })
      return
    }
    dispatch({ type: 'reload' })
    void calls
      .load({ releaseKey: key.releaseKey, activityId: key.activityId, expectedViewerId: key.viewerId })
      .catch((): StoryLearnerResult<StoryActivityData> => ({ ok: false, code: 'temporary', message: '', retryable: true }))
      .then((result) => {
        if (result.ok ? !acceptsActivityResponse(key, now(), result.data) : key.generation !== genRef.current || !live.current.auth.isCurrent(key.authToken)) return
        dispatch({ type: 'loaded', result })
      })
  }

  // 단위 진입 1회 · 본인 · 발행본 · 활동 · 인증 경계가 바뀌면 이전 요청을 버리고 다시. 내려가면 세대를 올려 늦은 응답을 버린다.
  const authToken = auth.token()
  useEffect(() => {
    load()
    return () => {
      genRef.current += 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 결속 키가 바뀔 때만 다시 조회한다
  }, [viewerId, slot.releaseKey, slot.activityId, authToken])

  const submit = () => {
    if (state.phase !== 'ready' || state.submitting || state.feedback || !state.selected) return
    const choice = state.selected
    const key = newKey()
    if (!auth.isCurrent(key.authToken)) {
      dispatch({ type: 'reset' })
      return
    }
    dispatch({ type: 'submit' })
    void calls
      .submit({ releaseKey: key.releaseKey, activityId: key.activityId, choice, expectedViewerId: key.viewerId })
      .catch((): StoryLearnerResult<StoryActivityFeedback> => ({ ok: false, code: 'temporary', message: '', retryable: true }))
      .then((result) => {
        if (result.ok ? !acceptsActivityResponse(key, now(), result.data) : key.generation !== genRef.current || !live.current.auth.isCurrent(key.authToken)) return
        dispatch({ type: 'submitted', result })
      })
  }

  const select = (optionId: string) => {
    // 제출 대기 중에 다른 것을 고르면 세대를 올려 늦은 결과를 버린다
    if (state.phase === 'ready' && state.submitting) genRef.current += 1
    dispatch({ type: 'select', optionId })
  }

  const feedback = state.phase === 'ready' ? state.feedback : null
  useEffect(() => {
    if (!feedback || focusedFor.current === feedback) return
    focusedFor.current = feedback
    headRef.current?.focus({ preventScroll: false })
  }, [feedback])
  useEffect(() => {
    if (!refocusOptions.current || feedback) return
    const first = optionsRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')
    if (!first) return
    refocusOptions.current = false
    first.focus()
  }, [feedback])

  if (state.phase === 'loading' || state.phase === 'hidden') return null
  if (state.phase === 'retry') {
    return (
      <section className={styles.activity} aria-label="근거 고르기" data-story-activity="retry">
        <p className={`${styles.meta} break-keep`}>{ACTIVITY_LABELS.unavailable}</p>
        <button type="button" className={styles.ctaSecondary} onClick={load} data-story-activity-reload>
          다시 시도
        </button>
      </section>
    )
  }

  const { activity, selected, submitting, assisted, stale } = state
  const name = `story-activity-${activity.activityId}`
  return (
    <section className={styles.activity} aria-labelledby={`${name}-title`} data-story-activity={feedback ? 'result' : 'choose'}>
      <h2 id={`${name}-title`} className={`${styles.activityTitle} break-keep`}>
        근거 고르기
      </h2>
      <p className={styles.activityClaim} lang="en" data-story-activity-claim>
        {activity.claim}
      </p>
      {feedback ? null : (
        <fieldset ref={optionsRef} className={styles.activityOptions} data-story-activity-options>
          <legend className={styles.activityPrompt} lang="en">
            {activity.prompt}
          </legend>
          {activity.options.map((o) => (
            <label key={o.optionId} className={styles.activityOption} data-option={o.optionId} data-selected={selected === o.optionId}>
              <input type="radio" name={name} value={o.optionId} checked={selected === o.optionId} onChange={() => select(o.optionId)} />
              <span lang="en">{o.quote}</span>
            </label>
          ))}
        </fieldset>
      )}
      {feedback ? null : (
        <div className={styles.activityActions}>
          <button
            type="button"
            className={styles.cta}
            aria-disabled={!selected || submitting ? 'true' : undefined}
            aria-busy={submitting ? 'true' : undefined}
            onClick={submit}
            data-story-activity-submit
          >
            {ACTIVITY_LABELS.submit}
          </button>
          {stale ? (
            <span className={`${styles.meta} break-keep`} role="status" data-story-activity-stale>
              {selected ? '고른 근거로 다시 제출해 주세요.' : ''}
            </span>
          ) : null}
        </div>
      )}
      <div role="status" aria-live="polite" data-story-activity-status>
        {feedback ? (
          <Result
            feedback={feedback}
            assisted={assisted}
            headRef={headRef}
            unitIndex={unitIndex}
            unitText={unitText}
            onRevisit={onRevisit}
            onRetry={() => {
              refocusOptions.current = true
              dispatch({ type: 'retry_choice' })
            }}
          />
        ) : null}
      </div>
    </section>
  )
}

function Evidence({
  label,
  option,
  unitIndex,
  unitText,
  onRevisit,
  kind,
}: {
  label: string
  option: StoryActivityOption
  unitIndex: number
  unitText: string
  onRevisit: (wordIndex: number, kind: 'chosen' | 'registered') => void
  kind: 'chosen' | 'registered'
}) {
  const word = option.unitIndex === unitIndex ? quoteWordIndex(unitText, option, countWords) : null
  return (
    <div className={styles.activityEvidence} data-story-activity-evidence={kind}>
      <p className={`${styles.activityLabel} break-keep`}>{label}</p>
      <blockquote className={styles.activityQuote} lang="en">
        {option.quote}
      </blockquote>
      {word !== null ? (
        <button type="button" className={styles.ctaQuiet} onClick={() => onRevisit(word, kind)} data-story-activity-revisit={kind}>
          {ACTIVITY_LABELS.revisit}
        </button>
      ) : (
        <p className={`${styles.meta} break-keep`}>{option.unitIndex + 1}번째 단위의 문장이에요.</p>
      )}
    </div>
  )
}

function Result({
  feedback,
  assisted,
  headRef,
  unitIndex,
  unitText,
  onRevisit,
  onRetry,
}: {
  feedback: StoryActivityFeedback
  assisted: boolean
  headRef: RefObject<HTMLParagraphElement>
  unitIndex: number
  unitText: string
  onRevisit: (wordIndex: number, kind: 'chosen' | 'registered') => void
  onRetry: () => void
}) {
  return (
    <div className={styles.activityResult} data-story-activity-correct={feedback.correct ? 'same' : 'different'}>
      <p ref={headRef} tabIndex={-1} className={`${styles.activityHead} break-keep`} data-story-activity-head>
        {feedbackHeadline(feedback)}
        {assisted ? <span className={styles.activityAssisted}> · {ACTIVITY_LABELS.assisted}</span> : null}
      </p>
      <div className={styles.activityPair}>
        <Evidence label={ACTIVITY_LABELS.chosen} option={feedback.chosen} unitIndex={unitIndex} unitText={unitText} onRevisit={onRevisit} kind="chosen" />
        <Evidence label={ACTIVITY_LABELS.registered} option={feedback.registered} unitIndex={unitIndex} unitText={unitText} onRevisit={onRevisit} kind="registered" />
      </div>
      {feedback.correct ? null : (
        <button type="button" className={styles.ctaSecondary} onClick={onRetry} data-story-activity-retry>
          {ACTIVITY_LABELS.retry}
        </button>
      )}
    </div>
  )
}
