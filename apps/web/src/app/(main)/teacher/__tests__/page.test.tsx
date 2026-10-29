// apps/web/src/app/(main)/teacher/__tests__/page.test.tsx
//
// TeacherPage → SentAssignments 배선 — 목록 조회 실패(`failed`)를 **버리지 않고** 넘긴다
// (TEACHER-COUNTS-01). 버리면 실패가 "보낸 과제 없음" 과 똑같이 아무것도 안 보인다.

import { describe, expect, it, vi } from 'vitest'

const sent = vi.hoisted(() => ({ value: { rows: [] as unknown[], failed: false } }))
const received = vi.hoisted(() => ({ value: { assignments: [] as { id: string }[], failed: false } }))

vi.mock('@/lib/analytics/funnel', () => ({ recordFunnel: vi.fn(async () => {}) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/teacher/assignment-actions', () => ({
  fetchMyAssignments: vi.fn(async () => received.value),
  fetchMyCollectedIds: vi.fn(async () => []),
  fetchSentAssignments: vi.fn(async () => sent.value),
}))
vi.mock('@/lib/teacher/class-actions', () => ({
  fetchTeacherClasses: vi.fn(async () => ({ classes: [], unavailable: false })),
  fetchMyMemberships: vi.fn(async () => ({ memberships: [], unavailable: false })),
}))
vi.mock('@/components/teacher/TeacherClient', () => ({ TeacherClient: () => null }))
vi.mock('@/components/teacher/ReceivedAssignments', () => ({ ReceivedAssignments: () => null }))
vi.mock('@/components/teacher/SentAssignments', () => ({ SentAssignments: () => null }))
vi.mock('@/components/ui/ios', () => ({ Screen: () => null }))

const { default: TeacherPage } = await import('../page')
const { SentAssignments } = await import('@/components/teacher/SentAssignments')
const { ReceivedAssignments } = await import('@/components/teacher/ReceivedAssignments')

type El = { type: unknown; props: Record<string, unknown> & { children?: unknown } }

function find(node: unknown, type: unknown): El | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = find(n, type)
      if (hit) return hit
    }
    return null
  }
  const el = node as El
  if (el.type === type) return el
  return find(el.props?.children, type)
}

describe('TeacherPage', () => {
  it('목록 실패를 SentAssignments 에 그대로 넘긴다', async () => {
    sent.value = { rows: [], failed: true }
    const tree = await TeacherPage()
    expect(find(tree, SentAssignments)?.props).toMatchObject({ rows: [], failed: true })
  })

  it('정상 목록은 failed:false 와 rows · 받은 과제 중복 제거 유지', async () => {
    const rows = [{ assignment: { id: 'a-1' }, progress: null }]
    sent.value = { rows, failed: false }
    received.value = { assignments: [{ id: 'a-1' }, { id: 'a-9' }], failed: false }
    const tree = await TeacherPage()
    expect(find(tree, SentAssignments)?.props).toMatchObject({ rows, failed: false })
    expect(find(tree, ReceivedAssignments)?.props.assignments).toEqual([{ id: 'a-9' }])
  })
})
