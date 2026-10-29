// apps/web/src/components/teacher/__tests__/SentAssignments.test.tsx
//
// 보낸 과제 — **조회 실패를 "학생 없음" · "아무도 안 열어 봄" 으로 그리지 않는다**(TEACHER-COUNTS-01).
// 목록 실패는 빈 목록처럼 숨지 않고, 집계 실패(`progress:null`)는 과제는 보이되 숫자·막대·학생 행동
// 문장을 그리지 않는다. 정상 0명은 지금처럼 초대 안내를 보인다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { ClassAssignment } from '@/lib/teacher/assignment-actions'

import { SentAssignments, type SentAssignmentRow } from '../SentAssignments'

const A: ClassAssignment = {
  id: 'a-1',
  classId: 'c-1',
  className: '1반',
  title: '7과 어휘',
  words: [{ w: 'apple' }, { w: 'pear' }],
  createdAt: '2026-10-01T00:00:00Z',
}

const row = (progress: SentAssignmentRow['progress'], a: ClassAssignment = A): SentAssignmentRow => ({
  assignment: a,
  progress,
})

const STUDENT_CLAIMS = ['아직 학생이 없어요', '아직 아무도 열어 보지 않았어요', '열어 본 학생은 모두 담았어요', '열어만 보고']

describe('SentAssignments', () => {
  it('목록 실패 → 실패 안내(빈 목록처럼 사라지지 않음)', () => {
    const html = renderToString(<SentAssignments rows={[]} failed />)
    expect(html).toContain('보낸 과제를 불러오지 못했어요')
    expect(html).toContain('role="status"')
  })

  it('진짜 빈 목록 → 아무것도 그리지 않는다', () => {
    expect(renderToString(<SentAssignments rows={[]} />)).toBe('')
  })

  it('집계 실패 → 제목·학급·단어 수는 보이고 숫자·막대·학생 행동 단정은 없다', () => {
    const html = renderToString(<SentAssignments rows={[row(null)]} />)
    expect(html).toContain('7과 어휘')
    expect(html).toContain('1반<!-- --> · 단어 <!-- -->2<!-- -->개')
    expect(html).toContain('수행 현황을 확인할 수 없어요')
    expect(html).not.toContain('role="img"')
    expect(html).not.toMatch(/\d+ \/ \d+/)
    expect(html).not.toContain('<!-- --> / <!-- -->')
    for (const claim of STUDENT_CLAIMS) expect(html).not.toContain(claim)
    // 원시 오류 · 내부 ID 를 노출하지 않는다
    expect(html).not.toContain('a-1')
    expect(html).not.toContain('c-1')
  })

  it('한 과제만 집계 실패해도 다른 과제의 정상 수치는 그대로', () => {
    const b = { ...A, id: 'a-2', title: '8과 어휘' }
    const html = renderToString(
      <SentAssignments rows={[row(null), row({ memberCount: 3, openedCount: 2, collectedCount: 1 }, b)]} />,
    )
    expect(html).toContain('수행 현황을 확인할 수 없어요')
    expect(html).toContain('3명 중 2명이 열어 봤고 1명이 담았어요.')
  })

  it('정상 0명 → 초대 안내는 지금처럼', () => {
    const html = renderToString(<SentAssignments rows={[row({ memberCount: 0, openedCount: 0, collectedCount: 0 })]} />)
    expect(html).toContain('아직 학생이 없어요')
    expect(html).not.toContain('확인할 수 없어요')
  })

  it('정상 일부 · 미열람 · 전체 문장', () => {
    expect(renderToString(<SentAssignments rows={[row({ memberCount: 3, openedCount: 2, collectedCount: 1 })]} />)).toContain(
      '열어만 보고',
    )
    expect(renderToString(<SentAssignments rows={[row({ memberCount: 3, openedCount: 0, collectedCount: 0 })]} />)).toContain(
      '아직 아무도 열어 보지 않았어요',
    )
    expect(renderToString(<SentAssignments rows={[row({ memberCount: 3, openedCount: 3, collectedCount: 3 })]} />)).toContain(
      '열어 본 학생은 모두 담았어요',
    )
  })
})
