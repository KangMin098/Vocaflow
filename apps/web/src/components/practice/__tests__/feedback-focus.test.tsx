// apps/web/src/components/practice/__tests__/feedback-focus.test.tsx
// T-0259 — 제출 성공 뒤 피드백 제목으로 초점 한 번(기사 연습 opt-in). 인계는 상태 전이 함수로 결속하고, 실제 activeElement 는 PC 하네스(pc-t259r2)가 잰다.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/learner/dcp-actions', () => ({ gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))
vi.mock('@/lib/learner/article-practice-actions', () => ({ submitArticlePractice: vi.fn() }))

import { nextFeedbackHandoff, shouldFocusFeedback, type FeedbackHandoff, type FeedbackHandoffEvent } from '../DcpPlayer'

/** 이벤트 시퀀스를 돌려 [최종 상태, 이동 횟수] */
function run(events: FeedbackHandoffEvent[], start: FeedbackHandoff = 'idle') {
  let state = start, moves = 0
  for (const ev of events) {
    const r = nextFeedbackHandoff(state, ev)
    state = r.state
    if (r.focus) moves++
  }
  return { state, moves }
}

describe('nextFeedbackHandoff — 이벤트 순서별', () => {
  it('제출 단추에서 제출 → (지연) → 성공: 한 번 이동', () => {
    expect(run([{ type: 'submit', focusedOnSubmit: true }, { type: 'rerender' }, { type: 'success' }])).toEqual({ state: 'idle', moves: 1 })
  })
  it('대기 중 이탈(본문 클릭 · 다른 요소로 초점) 뒤 성공: 이동 0', () => {
    expect(run([{ type: 'submit', focusedOnSubmit: true }, { type: 'leave' }, { type: 'success' }])).toEqual({ state: 'idle', moves: 0 })
    expect(run([{ type: 'submit', focusedOnSubmit: true }, { type: 'leave' }, { type: 'leave' }, { type: 'success' }]).moves).toBe(0)
  })
  it('대기 중 제목이 아닌 곳으로 focusin(잠긴 단추 → body → Shift+Tab): 이동 0 · 제목으로의 focusin 은 취소가 아니다', () => {
    expect(run([{ type: 'submit', focusedOnSubmit: true }, { type: 'focusin', toTitle: false }, { type: 'success' }]).moves).toBe(0)
    expect(run([{ type: 'submit', focusedOnSubmit: true }, { type: 'focusin', toTitle: true }, { type: 'success' }]).moves).toBe(1)
    expect(run([{ type: 'focusin', toTitle: false }, { type: 'submit', focusedOnSubmit: true }, { type: 'success' }]).moves).toBe(1) // 제출 전 이동은 무관
  })
  it('대기 중 창 밖(window blur · 탭 숨김)으로 나가면 이동 0 · 제출 전 창 이동은 무관', () => {
    expect(run([{ type: 'submit', focusedOnSubmit: true }, { type: 'windowAway' }, { type: 'success' }]).moves).toBe(0)
    expect(run([{ type: 'windowAway' }, { type: 'submit', focusedOnSubmit: true }, { type: 'success' }]).moves).toBe(1)
    expect(run([{ type: 'submit', focusedOnSubmit: true }, { type: 'windowAway' }, { type: 'fail' }, { type: 'submit', focusedOnSubmit: true }, { type: 'success' }]).moves).toBe(1)
  })
  it('제출 단추가 아닌 곳에서 제출: 이동 0', () => {
    expect(run([{ type: 'submit', focusedOnSubmit: false }, { type: 'success' }]).moves).toBe(0)
  })
  it('실패 → 재제출 → 성공: 두 번째 제출에서만 한 번', () => {
    expect(run([{ type: 'submit', focusedOnSubmit: true }, { type: 'fail' }])).toEqual({ state: 'idle', moves: 0 })
    expect(run([{ type: 'submit', focusedOnSubmit: true }, { type: 'fail' }, { type: 'submit', focusedOnSubmit: true }, { type: 'success' }]).moves).toBe(1)
    // 이탈로 취소된 뒤 실패해도 다음 제출은 새로 판정
    expect(run([{ type: 'submit', focusedOnSubmit: true }, { type: 'leave' }, { type: 'fail' }, { type: 'submit', focusedOnSubmit: true }, { type: 'success' }]).moves).toBe(1)
  })
  it('재렌더 · 성공 뒤 재렌더 · 다시 성공 이벤트는 이동을 만들지 않는다', () => {
    expect(run([{ type: 'rerender' }, { type: 'success' }]).moves).toBe(0)
    expect(run([{ type: 'submit', focusedOnSubmit: true }, { type: 'success' }, { type: 'rerender' }, { type: 'success' }]).moves).toBe(1)
  })
  it('반복 제출(문항마다): 각 성공에서 한 번씩', () => {
    expect(run([{ type: 'submit', focusedOnSubmit: true }, { type: 'success' }, { type: 'submit', focusedOnSubmit: true }, { type: 'success' }]).moves).toBe(2)
  })
})

describe('shouldFocusFeedback — 이동 직전 초점 위치 확인', () => {
  const body = { isConnected: true }
  it('초점이 body · 없음 · 끊긴 요소면 옮기고, 연결된 다른 요소면 그대로', () => {
    expect(shouldFocusFeedback({ intent: true, phase: 'graded', active: body, body })).toBe(true)
    expect(shouldFocusFeedback({ intent: true, phase: 'graded', active: null, body })).toBe(true)
    expect(shouldFocusFeedback({ intent: true, phase: 'graded', active: { isConnected: false }, body })).toBe(true)
    expect(shouldFocusFeedback({ intent: true, phase: 'graded', active: { isConnected: true }, body })).toBe(false)
    expect(shouldFocusFeedback({ intent: true, phase: 'answering', active: body, body })).toBe(false)
  })
})

describe('배선 — 기사 연습만 opt-in · 전이 함수로만 판정', () => {
  const player = fs.readFileSync(path.resolve(__dirname, '../DcpPlayer.tsx'), 'utf8')
  const bridge = fs.readFileSync(path.resolve(__dirname, '../ArticlePracticeBridge.tsx'), 'utf8')
  it('기본 꺼짐 · 기사 다리만 켠다 · 교재 다리는 켜지 않는다', () => {
    expect(player).toContain('feedbackFocus = false,')
    expect(bridge).toMatch(/\n\s+feedbackFocus\n/)
    expect(fs.readFileSync(path.resolve(__dirname, '../TextbookPracticeBridge.tsx'), 'utf8')).not.toContain('feedbackFocus')
  })
  it('제출 · 대기 중 이탈 · 성공/실패가 모두 nextFeedbackHandoff 를 거친다', () => {
    const submit = player.slice(player.indexOf('async function handleSubmit('), player.indexOf('async function handleCause('))
    expect(submit).toMatch(/nextFeedbackHandoff\(handoff\.current, \{ type: 'submit', focusedOnSubmit: onSubmit \}\)/)
    expect(player).toMatch(/document\.addEventListener\('pointerdown', leave, true\)/)
    expect(player).toMatch(/document\.addEventListener\('focusout', leave, true\)/)
    expect(player).toMatch(/document\.addEventListener\('focusin', enter, true\)/)
    expect(player).toMatch(/window\.addEventListener\('blur', away\)/)
    expect(player).toMatch(/if \(document\.visibilityState === 'hidden'\) away\(\)/)
    expect(player).toMatch(/\{ type: 'focusin', toTitle: e\.target === feedbackTitleRef\.current \}/)
    expect(player).toMatch(/if \(e\.type === 'focusout' && !\(e as FocusEvent\)\.relatedTarget\) return/)
    expect(player).toMatch(/nextFeedbackHandoff\(handoff\.current, \{ type: phase === 'graded' \? 'success' : 'fail' \}\)/)
    expect(player).toContain('titleRef={feedbackFocus ? feedbackTitleRef : undefined}')
  })
})
