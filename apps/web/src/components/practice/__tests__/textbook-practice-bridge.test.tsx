// apps/web/src/components/practice/__tests__/textbook-practice-bridge.test.tsx
// 교재 연습 계정 경계 — 같은 계정 확인 전 · 바뀐 뒤에는 문항 · 해설을 내리고, 같을 때만 revisit 을 켠다.
// 채점 콜백은 보낼 때 · 받을 때 경계 세대를 확인한다(실제 StoryAuthGuard).
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StoryAuthGuard, StoryAuthSourceContext, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import type { DcpItem } from '@/lib/learner/dcp'

const h = vi.hoisted(() => ({ scope: [] as Array<Record<string, unknown>> }))
vi.mock('@/lib/learner/dcp-actions', () => ({ gradeTextbookPracticeItem: vi.fn(), gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))
vi.mock('@/components/practice/TextbookPracticeScope', () => ({
  TextbookPracticeScope: (p: Record<string, unknown>) => {
    h.scope.push(p)
    return null
  },
}))

import { TextbookPracticeBridge, makeTextbookGrade } from '../TextbookPracticeBridge'

const A = 'user-a'
const ITEMS: DcpItem[] = [{ id: 'o1', type: 'order', paragraphIdx: 0, payload: { presented: ['A.', 'B.', 'C.'] } }]
const OK = { ok: true as const, correct: true, attemptId: 'x', answerKey: { explanation_ko: 'A 의 해설' } }

const sameGuard = () => {
  const g = new StoryAuthGuard(A)
  g.observe({ event: 'BASELINE', userId: A })
  return g
}

beforeEach(() => {
  h.scope = []
})

describe('makeTextbookGrade — 세대 확인', () => {
  it('same 이면 예상 주인 · 문항 · 답을 그대로 서버 래퍼에 넘긴다', async () => {
    const submit = vi.fn(async () => OK)
    const r = await makeTextbookGrade(A, sameGuard(), submit)('o1', { order: [0, 1, 2] })
    expect(submit).toHaveBeenCalledWith(A, 'o1', { order: [0, 1, 2] })
    expect(r).toEqual(OK)
  })
  it('확인 중(checking) · 바뀜(changed)이면 보내지 않는다', async () => {
    const submit = vi.fn(async () => OK)
    const checking = new StoryAuthGuard(A)
    const changed = sameGuard()
    changed.observe({ event: 'SIGNED_IN', userId: 'user-b' })
    for (const g of [checking, changed]) expect((await makeTextbookGrade(A, g, submit)('o1', {})).ok).toBe(false)
    expect(submit).not.toHaveBeenCalled()
  })
  it('응답 전에 A→B 또는 로그아웃이면 늦은 결과(해설)를 버린다', async () => {
    for (const change of [{ event: 'SIGNED_IN', userId: 'user-b' }, { event: 'SIGNED_OUT', userId: null }]) {
      const g = sameGuard()
      let release: (v: typeof OK) => void = () => {}
      const submit = vi.fn(() => new Promise<typeof OK>((r) => (release = r)))
      const pending = makeTextbookGrade(A, g, submit)('o1', {})
      g.observe(change)
      release(OK)
      const r = await pending
      expect(r.ok).toBe(false)
      expect(JSON.stringify(r)).not.toContain('A 의 해설')
    }
  })
  it('같은 계정이라도 재확인(recheck)으로 세대가 오르면 그 전에 출발한 결과를 버린다', async () => {
    const g = sameGuard()
    let release: (v: typeof OK) => void = () => {}
    const pending = makeTextbookGrade(A, g, () => new Promise<typeof OK>((r) => (release = r)))('o1', {})
    g.recheck({ currentUserId: () => new Promise(() => {}) })
    release(OK)
    expect((await pending).ok).toBe(false)
  })
})

describe('TextbookPracticeBridge — 경계 표시', () => {
  const as = (uid: string | null): StoryAuthSource => ({ subscribe: () => () => {}, currentUserId: async () => uid, testOnlyKnownUserId: () => uid })
  const render = (source: StoryAuthSource | null) =>
    renderToString(
      <StoryAuthSourceContext.Provider value={source}>
        <TextbookPracticeBridge items={ITEMS} scope="legacy_v_level" ownerId={A} backHref="/library/textbooks/vocab/5" backCta="이 교재로 돌아가기" reopenHref="/library/textbooks/vocab/5/practice" />
      </StoryAuthSourceContext.Provider>,
    )
  it('확인 중: 문항 · 해설 없음, 안내만', () => {
    const html = render({ subscribe: () => () => {}, currentUserId: () => new Promise(() => {}) })
    expect(html).toContain('로그인 상태를 확인하고 있어요.')
    expect(h.scope).toHaveLength(0)
  })
  it('바뀜(B · 로그아웃): 문항 없음, 다시 열기(전체 진입) · 권 복귀 44px, uid 노출 없음', () => {
    for (const uid of ['user-b', null]) {
      h.scope = []
      const html = render(as(uid))
      expect(h.scope).toHaveLength(0)
      expect(html).toMatch(/<a[^>]*href="\/library\/textbooks\/vocab\/5\/practice"[^>]*min-h-\[44px\][^>]*>연습 다시 열기<\/a>/)
      expect(html).toContain('href="/library/textbooks/vocab/5"')
      expect(html).not.toContain(A)
      expect(html).not.toContain('user-b')
    }
  })
  it('같은 계정: 범위 컴포넌트에 같은 문항 · revisit · 경계 채점 콜백', () => {
    render(as(A))
    expect(h.scope).toHaveLength(1)
    const p = h.scope[0]!
    expect(p.items).toBe(ITEMS)
    expect(p.scope).toBe('legacy_v_level')
    expect(p.revisit).toBe(true)
    expect(typeof p.grade).toBe('function')
    expect(JSON.stringify(p)).not.toContain(A)
  })
})
