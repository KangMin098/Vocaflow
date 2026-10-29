// apps/web/src/app/(main)/teacher/__tests__/received-failed-not-empty.test.tsx
// T-0235 — 받은 과제 조회 실패를 「아직 과제가 오지 않음」과 구별한다.
// ① page 배선: fetchMyAssignments 의 failed 를 TeacherClient(receivedFailed) · ReceivedAssignments(failed) 에 그대로 · 조회 호출 각 1회 불변
// ② 실제 TeacherClient + ReceivedAssignments 렌더: 성공 빈 / 과제 있음 / 조회 실패 / 교사·학생 겸임 / 학급 실패와 분리
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const st = vi.hoisted(() => ({
  received: { assignments: [] as { id: string }[], failed: false },
  calls: {} as Record<string, number>,
}))
const hit = (k: string) => { st.calls[k] = (st.calls[k] ?? 0) + 1 }

vi.mock('@/lib/analytics/funnel', () => ({ recordFunnel: vi.fn(async () => {}) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/teacher/assignment-actions', () => ({
  fetchMyAssignments: vi.fn(async () => { hit('received'); return st.received }),
  fetchMyCollectedIds: vi.fn(async () => { hit('collected'); return [] }),
  fetchSentAssignments: vi.fn(async () => { hit('sent'); return { rows: [], failed: false } }),
  markAssignmentCollected: vi.fn(async () => { hit('collect'); return { ok: true } }),
}))
vi.mock('@/lib/teacher/class-actions', () => ({
  fetchTeacherClasses: vi.fn(async () => { hit('taught'); return { classes: [], unavailable: false } }),
  fetchMyMemberships: vi.fn(async () => { hit('joined'); return { memberships: [{ class_id: 'c-9', class_name: '옆 반', joined_at: '2026-08-02T00:00:00Z' }], unavailable: false } }),
  createClass: vi.fn(), joinClassByCode: vi.fn(), leaveClass: vi.fn(), deleteClass: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }))
vi.mock('@/components/teacher/SentAssignments', () => ({ SentAssignments: () => null }))
vi.mock('@/components/ui/ios', () => ({ Screen: ({ children }: { children: unknown }) => children }))

import type { ClassAssignment } from '@/lib/teacher/assignment-actions'
import type { MyMembership, TeacherClass } from '@/lib/teacher/class-actions'
import { TeacherClient } from '@/components/teacher/TeacherClient'
import { ReceivedAssignments } from '@/components/teacher/ReceivedAssignments'

const { default: TeacherPage } = await import('../page')

type El = { type: unknown; props: Record<string, unknown> & { children?: unknown } }
function find(node: unknown, type: unknown): El | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const n of node) { const h = find(n, type); if (h) return h }
    return null
  }
  const el = node as El
  if (el.type === type) return el
  return find(el.props?.children, type)
}

const WAIT = '선생님이 단어를 보내면 여기에'
const FAIL = '받은 과제를 불러오지 못했어요'
const CLASS_FAIL = '불러오지 못했어요'
const MEMBER: MyMembership = { class_id: 'c-9', class_name: '옆 반', joined_at: '2026-08-02T00:00:00Z' }
const TAUGHT: TeacherClass = { id: 'c-1', name: '3학년 2반', invite_code: 'ABC234', created_at: '2026-08-01T00:00:00Z', member_count: 12 }
const A: ClassAssignment = { id: 'a-1', classId: 'c-9', className: '옆 반', title: '첫 과제', words: [{ w: 'harvest', m: '수확' }] as ClassAssignment['words'], createdAt: '2026-10-29T00:00:00Z' }

function screen(o: { assignments: ClassAssignment[]; failed: boolean; classes?: TeacherClass[]; unavailable?: boolean }) {
  return renderToString(
    <>
      <TeacherClient classes={o.classes ?? []} memberships={[MEMBER]} hasReceived={o.assignments.length > 0} receivedFailed={o.failed} unavailable={o.unavailable ?? false} />
      <ReceivedAssignments assignments={o.assignments} failed={o.failed} />
    </>,
  )
}

beforeEach(() => {
  st.calls = {}
  st.received = { assignments: [], failed: false }
})

describe('page 배선 — failed 를 버리지 않고 넘긴다 · 조회 호출 수 불변', () => {
  for (const [name, received] of [
    ['성공 빈 결과', { assignments: [], failed: false }],
    ['과제 있음', { assignments: [{ id: 'a-1' }], failed: false }],
    ['조회 실패', { assignments: [], failed: true }],
  ] as const) {
    it(name, async () => {
      st.received = { assignments: [...received.assignments], failed: received.failed }
      const tree = await TeacherPage()
      expect(find(tree, TeacherClient)?.props).toMatchObject({ hasReceived: received.assignments.length > 0, receivedFailed: received.failed, unavailable: false })
      expect(find(tree, ReceivedAssignments)?.props).toMatchObject({ failed: received.failed })
      expect(st.calls).toEqual({ taught: 1, joined: 1, received: 1, sent: 1, collected: 1 })
    })
  }
})

describe('실제 TeacherClient + ReceivedAssignments 표시', () => {
  it('성공 빈 결과 — 대기 안내 그대로 · 실패 고지 없음', () => {
    const html = screen({ assignments: [], failed: false })
    expect(html).toContain(WAIT)
    expect(html).not.toContain(FAIL)
  })
  it('과제 있음 — 대기 안내 없음 · 받은 단어 목록', () => {
    const html = screen({ assignments: [A], failed: false })
    expect(html).not.toContain(WAIT)
    expect(html).toContain('첫 과제')
    expect(html).not.toContain(FAIL)
  })
  it('조회 실패 — 대기 안내를 생략하고 실패 고지만', () => {
    const html = screen({ assignments: [], failed: true })
    expect(html).not.toContain(WAIT)
    expect(html).toContain(FAIL)
  })
  it('교사·학생 겸임 — 내 학급(교사)과 참여 학급(학생)이 함께 · 실패 중에도 학급 목록은 그대로 · 대기 안내만 생략', () => {
    const ok = screen({ assignments: [], failed: false, classes: [TAUGHT] })
    expect(ok).toContain('3학년 2반')
    expect(ok).toContain('옆 반')
    expect(ok).toContain(WAIT)
    const failed = screen({ assignments: [], failed: true, classes: [TAUGHT] })
    expect(failed).toContain('3학년 2반')
    expect(failed).toContain('옆 반')
    expect(failed).not.toContain(WAIT)
    expect(failed).toContain(FAIL)
  })
  it('학급 조회 실패와 합치지 않는다 — 받은 과제 실패는 학급 실패 고지를 띄우지 않고, 학급 실패는 받은 과제 실패를 띄우지 않는다', () => {
    const recvFail = screen({ assignments: [], failed: true })
    expect(recvFail).not.toContain('사라진 것은 아니에요')
    const classFail = renderToString(<TeacherClient classes={[]} memberships={[]} unavailable />)
    expect(classFail).toContain(CLASS_FAIL)
    expect(classFail).not.toContain(FAIL)
  })
  it('표시에 담기 호출 0', () => {
    screen({ assignments: [A], failed: false })
    expect(st.calls.collect ?? 0).toBe(0)
  })
})
