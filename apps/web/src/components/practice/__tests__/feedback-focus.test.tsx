// apps/web/src/components/practice/__tests__/feedback-focus.test.tsx
// T-0259 — 제출 성공 뒤 피드백 제목으로 초점 한 번(기사 연습 opt-in). 판정은 순수 함수, 실제 activeElement 는 PC 하네스(pc-t259)가 잰다.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/learner/dcp-actions', () => ({ gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))
vi.mock('@/lib/learner/article-practice-actions', () => ({ submitArticlePractice: vi.fn() }))

import { shouldFocusFeedback } from '../DcpPlayer'

const body = { isConnected: true, tag: 'body' }

describe('shouldFocusFeedback', () => {
  it('제출 의도 + 성공 피드백 + 초점이 body 이거나 사라졌으면 옮긴다', () => {
    expect(shouldFocusFeedback({ intent: true, phase: 'graded', active: body, body })).toBe(true)
    expect(shouldFocusFeedback({ intent: true, phase: 'graded', active: null, body })).toBe(true)
    expect(shouldFocusFeedback({ intent: true, phase: 'graded', active: { isConnected: false }, body })).toBe(true)
  })
  it('기다리는 동안 학습자가 다른 곳(연결된 요소)으로 옮긴 초점은 빼앗지 않는다', () => {
    expect(shouldFocusFeedback({ intent: true, phase: 'graded', active: { isConnected: true }, body })).toBe(false)
  })
  it('실패(답하기로 돌아옴) · 의도 없음(부모 재렌더 · 다음 문항) · 대기 중에는 옮기지 않는다', () => {
    expect(shouldFocusFeedback({ intent: true, phase: 'answering', active: body, body })).toBe(false)
    expect(shouldFocusFeedback({ intent: true, phase: 'grading', active: body, body })).toBe(false)
    expect(shouldFocusFeedback({ intent: false, phase: 'graded', active: body, body })).toBe(false)
    expect(shouldFocusFeedback({ intent: true, phase: 'done', active: body, body })).toBe(false)
  })
})

describe('배선 — 기사 연습만 opt-in · 의도는 제출에서만', () => {
  const player = fs.readFileSync(path.resolve(__dirname, '../DcpPlayer.tsx'), 'utf8')
  const bridge = fs.readFileSync(path.resolve(__dirname, '../ArticlePracticeBridge.tsx'), 'utf8')
  it('기본 꺼짐 · 기사 다리만 켠다 · 교재 다리는 켜지 않는다', () => {
    expect(player).toContain('feedbackFocus = false,')
    expect(bridge).toMatch(/\n\s+feedbackFocus\n/)
    expect(fs.readFileSync(path.resolve(__dirname, '../TextbookPracticeBridge.tsx'), 'utf8')).not.toContain('feedbackFocus')
  })
  it('의도는 handleSubmit 한 곳에서 opt-in 값으로만, 효과가 한 번 쓰고 비운다 · 제목 ref 는 opt-in 일 때만', () => {
    expect(player.match(/feedbackIntent\.current = feedbackFocus/g)).toHaveLength(1)
    const submit = player.slice(player.indexOf('async function handleSubmit('), player.indexOf('async function handleCause('))
    expect(submit).toContain('feedbackIntent.current = feedbackFocus')
    expect(player).toMatch(/feedbackIntent\.current = false\s+if \(go\) feedbackTitleRef\.current\?\.focus\(\)/)
    expect(player).toContain('titleRef={feedbackFocus ? feedbackTitleRef : undefined}')
  })
})
