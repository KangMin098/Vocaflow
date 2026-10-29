// apps/web/src/components/library/story/__tests__/story-activity-view.test.ts
// T-0228 근거 선택 활동의 화면 판정(순수) — 요청 결속 · 실패 표시 · 상태 전이 · 본문 복귀 위치, 그리고 화면이 그 판정을 실제로 쓴다는 소스 결속.
// 저장소에 jsdom/testing-library 가 없어(새 의존성 금지) 실제 클릭 · 키보드 · 초점 왕복은 PC 하네스가 덮는다.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import type { StoryActivity, StoryActivityFeedback, StoryLearnerFailureCode } from '@/lib/library/story/learner-types'

import {
  ACTIVITY_LABELS,
  acceptsActivityResponse,
  activityFailureView,
  activityNoticeText,
  activitySlotFor,
  feedbackHeadline,
  feedbackMatchesActivity,
  quoteWordIndex,
  reduceActivity,
  nextReloadHandoff,
  shouldHandOffReloadFocus,
  type StoryActivityState,
} from '../story-activity-view'
import { STORY_ACTIVITY_SLOTS } from '../story-activity-slots'
import { tokenizeWords } from '../story-view'

const RK = `lsr_${'a'.repeat(32)}`
const UID = 'u-1'
const opt = (id: string, i: number) => ({ optionId: id, unitIndex: 15, start: i * 10, end: i * 10 + 8, quote: `quote ${id}` })
const OPTIONS = ['case-collapses', 'too-frightened', 'opt-c'].map(opt)
const ACTIVITY: StoryActivity = { viewerId: UID, releaseKey: RK, activityId: 'why', prompt: 'Why?', claim: 'Claim.', options: OPTIONS }
const fb = (choice: string): StoryActivityFeedback => ({
  viewerId: UID,
  releaseKey: RK,
  activityId: 'why',
  choice,
  correct: choice === 'case-collapses',
  chosen: OPTIONS.find((o) => o.optionId === choice)!,
  registered: OPTIONS[0],
})
const failure = (code: StoryLearnerFailureCode) => ({ ok: false as const, code, message: 'm', retryable: code === 'temporary' })
const ready = (): StoryActivityState => reduceActivity({ phase: 'loading' }, { type: 'loaded', result: { ok: true, data: ACTIVITY } })

describe('요청 결속 — 늦은 응답 · 계정 변경 · 다른 활동은 버린다', () => {
  const key = { viewerId: UID, releaseKey: RK, activityId: 'why', generation: 3, authToken: 7 }
  const now = { generation: 3, viewerId: UID, releaseKey: RK, activityId: 'why', authCurrent: (t: number) => t === 7 }
  const data = { viewerId: UID, releaseKey: RK, activityId: 'why' }
  it('모두 같을 때만 받는다', () => {
    expect(acceptsActivityResponse(key, now, data)).toBe(true)
    expect(acceptsActivityResponse(key, { ...now, generation: 4 }, data)).toBe(false) // 다른 선택 · 단위 이동 · 언마운트
    expect(acceptsActivityResponse(key, { ...now, authCurrent: () => false }, data)).toBe(false) // 계정 변경
    expect(acceptsActivityResponse(key, { ...now, viewerId: 'u-2' }, data)).toBe(false)
    expect(acceptsActivityResponse(key, now, { ...data, viewerId: 'u-2' })).toBe(false) // 응답 주인이 다름
    expect(acceptsActivityResponse(key, now, { ...data, releaseKey: `lsr_${'b'.repeat(32)}` })).toBe(false)
    expect(acceptsActivityResponse(key, now, { ...data, activityId: 'other' })).toBe(false)
  })
})

describe('실패 표시 — 일시 오류만 다시 시도, 그 밖은 그리지 않음', () => {
  it('함수 없음 · 진도 미달 · 없는 활동 · 자료 어긋남 · 권한 → hidden', () => {
    for (const code of ['reader_not_ready', 'activity_locked', 'activity_unavailable', 'reader_data_invalid', 'auth_required', 'account_blocked', 'release_unavailable', 'viewer_changed', 'invalid_input'] as const) {
      expect(activityFailureView(failure(code))).toBe('hidden')
      expect(reduceActivity({ phase: 'loading' }, { type: 'loaded', result: failure(code) })).toEqual({ phase: 'hidden' })
    }
    expect(reduceActivity({ phase: 'loading' }, { type: 'loaded', result: failure('temporary') })).toEqual({ phase: 'retry', pending: false })
  })
})

describe('상태 전이', () => {
  it('제출 전에는 결과 · 등록 근거가 없다', () => {
    const s = reduceActivity(ready(), { type: 'select', optionId: 'too-frightened' })
    expect(s).toMatchObject({ phase: 'ready', selected: 'too-frightened', feedback: null, submitting: false })
    expect(JSON.stringify(s)).not.toMatch(/registered|correct/)
  })

  it('선택 없이 제출 · 대기 중 두 번째 제출 · 없는 선택지는 무시', () => {
    expect(reduceActivity(ready(), { type: 'submit' })).toEqual(ready())
    const picked = reduceActivity(ready(), { type: 'select', optionId: 'opt-c' })
    const sending = reduceActivity(picked, { type: 'submit' })
    expect(reduceActivity(sending, { type: 'submit' })).toBe(sending)
    expect(reduceActivity(picked, { type: 'select', optionId: 'nope' })).toBe(picked)
  })

  it('다름 → 다시 골라 보기 → 맞음은 「도움을 받은 연습」', () => {
    let s = reduceActivity(ready(), { type: 'select', optionId: 'too-frightened' })
    s = reduceActivity(s, { type: 'submit' })
    s = reduceActivity(s, { type: 'submitted', result: { ok: true, data: fb('too-frightened') } })
    expect(s).toMatchObject({ feedback: { correct: false }, assisted: false })
    expect(reduceActivity(s, { type: 'select', optionId: 'case-collapses' })).toBe(s) // 결과 뒤에는 다시 골라 보기로만
    s = reduceActivity(s, { type: 'retry_choice' })
    expect(s).toMatchObject({ feedback: null, selected: null, assisted: true })
    s = reduceActivity(reduceActivity(s, { type: 'select', optionId: 'case-collapses' }), { type: 'submit' })
    s = reduceActivity(s, { type: 'submitted', result: { ok: true, data: fb('case-collapses') } })
    expect(s).toMatchObject({ feedback: { correct: true }, assisted: true })
    expect(reduceActivity(s, { type: 'retry_choice' })).toBe(s) // 맞은 뒤에는 다시 고르기 없음
  })

  it('제출 대기 중 다른 선택 → 대기 해제 · 다시 제출 안내(늦은 결과는 부르는 쪽이 세대로 버린다)', () => {
    const sending = reduceActivity(reduceActivity(ready(), { type: 'select', optionId: 'opt-c' }), { type: 'submit' })
    const moved = reduceActivity(sending, { type: 'select', optionId: 'too-frightened' })
    expect(moved).toMatchObject({ selected: 'too-frightened', submitting: false, notice: 'changed' })
    expect(reduceActivity(moved, { type: 'submitted', result: { ok: true, data: fb('opt-c') } })).toBe(moved)
  })

  it('결과가 보인 선택지와 맞물리지 않으면 닫는다 · 일시 오류는 다시 제출', () => {
    const sending = reduceActivity(reduceActivity(ready(), { type: 'select', optionId: 'opt-c' }), { type: 'submit' })
    expect(reduceActivity(sending, { type: 'submitted', result: { ok: true, data: fb('too-frightened') } })).toEqual({ phase: 'hidden' })
    const moved = { ...fb('opt-c'), registered: { ...OPTIONS[0], quote: 'tampered' } }
    expect(feedbackMatchesActivity(ACTIVITY, 'opt-c', moved)).toBe(false)
    expect(reduceActivity(sending, { type: 'submitted', result: failure('temporary') })).toMatchObject({ phase: 'ready', submitting: false, notice: 'failed' })
    expect(reduceActivity(sending, { type: 'submitted', result: failure('viewer_changed') })).toEqual({ phase: 'hidden' })
  })

  it('결과 문구는 기능 안내만 · 정해진 이름', () => {
    expect(feedbackHeadline(fb('case-collapses'))).toBe('등록된 근거와 같아요')
    expect(feedbackHeadline(fb('opt-c'))).toBe('등록된 근거와 달라요')
    expect(ACTIVITY_LABELS).toMatchObject({ chosen: '내가 고른 근거', registered: '본문에 등록된 근거', revisit: '본문에서 다시 확인', assisted: '도움을 받은 연습' })
  })
})

describe('붙일 자리 · 본문 복귀 위치', () => {
  it('결정 MP-STORY-LOCATION 의 한 항목 그대로 · 정답 · 원문 없음', () => {
    expect(STORY_ACTIVITY_SLOTS).toStrictEqual([{ releaseKey: 'lsr_58490bbd38131e1b2e536c5fe08179e8', activityId: 'why-horner-is-safe', afterUnitId: 'u16', afterUnitIndex: 15 }])
  })

  it('같은 활동 id 라도 다른 발행본 · 다른 단위 · 식별 불명이면 없음(조회 0)', () => {
    const slot = STORY_ACTIVITY_SLOTS[0]
    expect(activitySlotFor(STORY_ACTIVITY_SLOTS, `lsr_${'c'.repeat(32)}`, 15)).toBeNull()
    expect(activitySlotFor(STORY_ACTIVITY_SLOTS, slot.releaseKey, 14)).toBeNull()
    expect(activitySlotFor(STORY_ACTIVITY_SLOTS, slot.releaseKey, 16)).toBeNull()
    expect(activitySlotFor(STORY_ACTIVITY_SLOTS, null, 15)).toBeNull()
    expect(activitySlotFor(STORY_ACTIVITY_SLOTS, '', 15)).toBeNull()
    expect(activitySlotFor(STORY_ACTIVITY_SLOTS, slot.releaseKey, null)).toBeNull()
  })

  it('연결한 활동의 after_unit 단위에서만', () => {
    const slot = STORY_ACTIVITY_SLOTS[0]
    expect(activitySlotFor(STORY_ACTIVITY_SLOTS, slot.releaseKey, slot.afterUnitIndex)).toBe(slot)
    expect(activitySlotFor(STORY_ACTIVITY_SLOTS, slot.releaseKey, slot.afterUnitIndex - 1)).toBeNull()
    expect(activitySlotFor(STORY_ACTIVITY_SLOTS, RK, slot.afterUnitIndex)).toBeNull()
  })

  it('인용이 본문 그 구간과 같을 때만 낱말 번호 — 다르면 돌아가기 조작 없음', () => {
    const text = 'He did not move.\n\nThe case collapses without him.'
    const start = text.indexOf('The case')
    const o = { optionId: 'a', unitIndex: 15, start, end: start + 'The case collapses'.length, quote: 'The case collapses' }
    const count = (s: string) => tokenizeWords(s).next
    expect(quoteWordIndex(text, o, count)).toBe(4)
    expect(quoteWordIndex(text, { ...o, quote: 'The case is open' }, count)).toBeNull()
    expect(quoteWordIndex(text, { ...o, end: text.length + 5 }, count)).toBeNull()
  })
})

describe('화면 소스 결속', () => {
  const src = readFileSync(path.resolve(__dirname, '../StoryActivity.tsx'), 'utf8')
  const reader = readFileSync(path.resolve(__dirname, '../StoryReader.tsx'), 'utf8')
  it('StoryActivity 는 판정을 순수 함수로 · radio · role=status · aria-disabled', () => {
    expect(src).toMatch(/useReducer\(reduceActivity,/)
    expect(src.match(/acceptsActivityResponse\(key, now\(\), result\.data\)/g)?.length).toBe(2)
    expect(src).toMatch(/type="radio"/)
    expect(src).toMatch(/role="status"/)
    expect(src).toMatch(/aria-disabled=\{!selected \|\| submitting/)
    expect(src).not.toMatch(/\sdisabled=\{/)
    // 다시 골라 보기 → 선택지가 다시 그려진 뒤 첫 radio 로 초점(T-0228 리뷰 P2)
    expect(src).toMatch(/refocusOptions\.current = true\s*dispatch\(\{ type: 'retry_choice' \}\)/)
    expect(src).toMatch(/querySelector<HTMLInputElement>\('input\[type="radio"\]'\)/)
    expect(src).toMatch(/<fieldset ref=\{optionsRef\}/)
    expect(src).not.toMatch(/track\(|localStorage|sessionStorage|completeUnit|recordPosition/)
  })
  it('StoryReader 는 연결 단위 · same 확인 · 두 액션이 있을 때만 붙이고 단위 키로 새로 시작한다', () => {
    expect(reader).toMatch(/activitySlotFor\(STORY_ACTIVITY_SLOTS, releaseKey, unit\.unitIndex\)/)
    expect(reader).toMatch(/\{activitySlot && loadActivity && submitActivity && verified \? \(/)
    expect(reader).toMatch(/key=\{`activity:\$\{releaseKey\}:\$\{unit\.unitIndex\}:\$\{activitySlot\.activityId\}`\}/)
    expect(reader).toMatch(/revisit=\{unitRevisit\}/)
    // 리뷰 P2 — 다시 확인 강조는 본인 · 발행본 · 단위 · 인증 세대에 묶이고, 결속이 바뀌면 버린다(돌아와도 되살아나지 않는다)
    expect(reader).toMatch(/const revisitContext = verified && unitIndex !== null \? `\$\{anchorOwner\}\|\$\{releaseKey\}\|\$\{unitIndex\}\|\$\{guard\.token\(\)\}` : null/)
    expect(reader).toMatch(/if \(revisit && revisit\.context !== revisitContext\) setRevisit\(null\)/)
    expect(reader).toMatch(/revisit\.context === revisitContext \?/)
  })
})

describe('T-0252 일시 실패 · 선택 변경 구별 · 다시 시도 이어가기', () => {
  it('제출 실패(failed)와 제출 중 선택 변경(changed)은 다른 안내다', () => {
    const sending = reduceActivity(reduceActivity(ready(), { type: 'select', optionId: 'opt-c' }), { type: 'submit' })
    const failed = reduceActivity(sending, { type: 'submitted', result: failure('temporary') })
    const changed = reduceActivity(sending, { type: 'select', optionId: 'too-frightened' })
    expect(failed).toMatchObject({ notice: 'failed', selected: 'opt-c' })
    expect(changed).toMatchObject({ notice: 'changed', selected: 'too-frightened' })
    const ft = activityNoticeText('failed', 'opt-c')
    const ct = activityNoticeText('changed', 'too-frightened')
    expect(ft).toBe(ACTIVITY_LABELS.submitFailed)
    expect(ct).toBe(ACTIVITY_LABELS.choiceChanged)
    expect(ft).toContain('결과를 불러오지 못했어요')
    expect(ft).not.toBe(ct)
    expect(activityNoticeText(null, 'opt-c')).toBeNull()
    expect(activityNoticeText('changed', null)).toBeNull()
  })

  it('실패 뒤 선택은 그대로 · 같은 제출로 여러 번 다시 시도 · 성공하면 결과(비교)로 이어간다', () => {
    let s = reduceActivity(ready(), { type: 'select', optionId: 'opt-c' })
    for (let i = 0; i < 3; i += 1) {
      s = reduceActivity(s, { type: 'submit' })
      expect(s).toMatchObject({ submitting: true, notice: null, selected: 'opt-c' })
      s = reduceActivity(s, { type: 'submitted', result: failure('temporary') })
      expect(s).toMatchObject({ submitting: false, notice: 'failed', selected: 'opt-c', feedback: null })
    }
    s = reduceActivity(reduceActivity(s, { type: 'submit' }), { type: 'submitted', result: { ok: true, data: fb('opt-c') } })
    expect(s).toMatchObject({ notice: null, feedback: { choice: 'opt-c' } })
  })

  it('실패 뒤 다른 선택은 실패 안내를 거둔다 · 제출 없이 결과가 생기지 않는다(자동 재전송 없음)', () => {
    let s = reduceActivity(ready(), { type: 'select', optionId: 'opt-c' })
    s = reduceActivity(reduceActivity(s, { type: 'submit' }), { type: 'submitted', result: failure('temporary') })
    const moved = reduceActivity(s, { type: 'select', optionId: 'too-frightened' })
    expect(moved).toMatchObject({ notice: null, submitting: false, selected: 'too-frightened' })
    // 대기 중이 아니면 늦게 온 결과는 넣지 않는다
    expect(reduceActivity(moved, { type: 'submitted', result: { ok: true, data: fb('too-frightened') } })).toBe(moved)
  })

  it('조회 다시 시도: 안내 · 단추를 둔 채 기다리고(pending) · 실패면 다시 · 성공하면 선택지', () => {
    let s: StoryActivityState = reduceActivity({ phase: 'loading' }, { type: 'loaded', result: failure('temporary') })
    for (let i = 0; i < 2; i += 1) {
      s = reduceActivity(s, { type: 'reload' })
      expect(s).toEqual({ phase: 'retry', pending: true })
      s = reduceActivity(s, { type: 'loaded', result: failure('temporary') })
      expect(s).toEqual({ phase: 'retry', pending: false })
    }
    // 기다리지 않는 retry 에 늦게 온 응답은 넣지 않는다
    expect(reduceActivity(s, { type: 'loaded', result: { ok: true, data: ACTIVITY } })).toBe(s)
    s = reduceActivity(reduceActivity(s, { type: 'reload' }), { type: 'loaded', result: { ok: true, data: ACTIVITY } })
    expect(s).toMatchObject({ phase: 'ready', selected: null, notice: null })
    expect(reduceActivity(reduceActivity({ phase: 'retry', pending: true }, { type: 'loaded', result: failure('viewer_changed') }), { type: 'reload' })).toEqual({ phase: 'loading' })
  })

  it('초점 인계: 요청이 살아 있고 단추가 사라져 초점이 body 로 떨어졌을 때만', () => {
    const body = {} as Element
    const other = {} as Element
    expect(shouldHandOffReloadFocus(false, body, body)).toBe(false)
    expect(shouldHandOffReloadFocus(true, body, body)).toBe(true)
    expect(shouldHandOffReloadFocus(true, null, body)).toBe(true)
    expect(shouldHandOffReloadFocus(true, other, body)).toBe(false)
  })

  it('인계 요청(fromRetry 패턴): 누른 순간 단추에 초점이 있을 때만 · 대기 중 어디든 누르거나(본문 클릭) 다른 조작으로 옮기면 취소', () => {
    expect(nextReloadHandoff(false, { type: 'press', onButton: true })).toBe(true)
    expect(nextReloadHandoff(false, { type: 'press', onButton: false })).toBe(false)
    // 본문 클릭으로 초점 해제 — 그 뒤 성공해도 body 라서 넘기면 안 된다
    const clicked = nextReloadHandoff(true, { type: 'pointerdown' })
    expect(clicked).toBe(false)
    expect(shouldHandOffReloadFocus(clicked, null, null)).toBe(false)
    expect(nextReloadHandoff(true, { type: 'blur', toElement: true })).toBe(false)
    // 단추가 사라져 초점을 잃는 것(옮겨 갈 대상 없음)은 취소가 아니다
    expect(nextReloadHandoff(true, { type: 'blur', toElement: false })).toBe(true)
  })
})
