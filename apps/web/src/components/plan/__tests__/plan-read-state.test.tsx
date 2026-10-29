// apps/web/src/components/plan/__tests__/plan-read-state.test.tsx
// T-0240 — /plan 읽기 실패 표시 · 계정 경계(실제 PlanClient 초기 렌더) + page 배선(facade 만 · viewer key).
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const st = vi.hoisted(() => ({ auth: 'same' as 'same' | 'checking' | 'changed', calls: [] as string[] }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/plan', useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/learner/plan-actions', () => ({
  fetchBookChapters: vi.fn(async () => { st.calls.push('chapters'); return [] }),
  fetchStudyPlanSnapshot: vi.fn(async () => { st.calls.push('snapshot'); return { items: [], failed: false, viewerId: 'user-a' } }),
  fetchStudyPlanItems: vi.fn(async () => { st.calls.push('items'); return [] }),
  fetchAvailableMaterials: vi.fn(async () => { st.calls.push('materials'); return { books: [], articles: [], wordSets: [], scripts: [] } }),
  savePlanItem: vi.fn(async () => { st.calls.push('save'); return { ok: true, id: 'x' } }),
  removePlanItem: vi.fn(async () => { st.calls.push('remove'); return { ok: true } }),
}))
vi.mock('@/components/library/story/use-story-auth-guard', async () => {
  const actual = await vi.importActual<typeof import('@/components/library/story/use-story-auth-guard')>('@/components/library/story/use-story-auth-guard')
  return {
    ...actual,
    useStoryAuthGuard: (owner: string | null) => {
      const guard = new actual.StoryAuthGuard(owner)
      if (owner && st.auth === 'same') guard.observe({ event: 'KNOWN', userId: owner })
      if (owner && st.auth === 'changed') guard.observe({ event: 'KNOWN', userId: 'someone-else' })
      return { guard, status: owner ? guard.status : 'same' }
    },
  }
})
vi.mock('@/components/ui/ios', () => ({ Screen: ({ children }: { children: unknown }) => children }))

import type { PlanItem } from '@/lib/learner/plan-actions'
import { PlanClient } from '../PlanClient'

const MATERIALS = { books: [], articles: [], wordSets: [], scripts: [] }
const WEEK = ['10/27', '10/28', '10/29', '10/30', '10/31', '11/1', '11/2']
const ITEM: PlanItem = { id: 'p1', materialType: 'book', materialId: 'b1', modules: ['read'], title: 'Book One', subtitle: null, href: '/library/b1', slug: null, vLevel: 3, chapters: [], weekdays: [3], chapterCount: 12, coverUrl: null, coverEmoji: null, source: null }
const render = (o: { items?: PlanItem[]; failed?: boolean; viewerId?: string | null }) =>
  renderToString(<PlanClient initialItems={o.items ?? []} initialFailed={o.failed} viewerId={o.viewerId === undefined ? 'user-a' : o.viewerId} materials={MATERIALS} todayWeekday={3} weekDates={WEEK} />)

beforeEach(() => { st.auth = 'same'; st.calls = [] })

describe('PlanClient — 읽기 실패와 빈 계획의 구분', () => {
  it('첫 조회 실패 — 실패 고지 + 다시 불러오기(44px · 링) · 보드 · 컴포저 없음(빈 계획 문구 0)', () => {
    const html = render({ failed: true })
    expect(html).toContain('data-testid="plan-read-failed"')
    expect(html).toContain('계획이 비어 있다는 뜻이 아니에요')
    const btn = /<button[^>]*data-testid="plan-read-retry"[^>]*>/.exec(html)?.[0] ?? ''
    expect(btn).toContain('min-h-11')
    expect(btn).toContain('focus-visible:ring-2')
    expect(html).not.toContain('aria-label="자료 추가·구성"')
    expect(html).not.toContain('비어 있음')
  })
  it('첫 조회 실패 — 일부 읽힌 항목이 있어도 계획으로 그리지 않는다', () => {
    const html = render({ failed: true, items: [ITEM] })
    expect(html).not.toContain('Book One')
  })
  it('진짜 빈 계획 — 실패 고지 없음 · 보드 · 컴포저 그대로', () => {
    const html = render({})
    expect(html).not.toContain('plan-read-failed')
    expect(html).toContain('aria-label="자료 추가·구성"')
  })
  it('정상 — 항목 그대로 · 실패 고지 없음', () => {
    const html = render({ items: [ITEM] })
    expect(html).toContain('Book One')
    expect(html).not.toContain('plan-read-failed')
  })
  it('계정 확인 중 · 바뀜 — 계획 · 컴포저를 그리지 않는다', () => {
    for (const a of ['checking', 'changed'] as const) {
      st.auth = a
      const html = render({ items: [ITEM] })
      expect(html).toContain(`data-plan-private="${a}"`)
      expect(html).not.toContain('Book One')
      expect(html).not.toContain('aria-label="자료 추가·구성"')
    }
  })
  it('비로그인(viewer null) — 기존처럼 그린다', () => {
    const html = render({ viewerId: null })
    expect(html).toContain('aria-label="자료 추가·구성"')
  })
  it('초기 렌더에 조회 · 저장 · 삭제 호출 0', () => {
    render({ failed: true })
    render({ items: [ITEM] })
    expect(st.calls).toEqual([])
  })
})

describe('/plan page 배선', () => {
  it('facade 만 부른다(기존 wrapper 0 · 중복 조회 0) · 실패 · viewer 를 넘기고 viewer 로 key', async () => {
    const { default: PlanPage } = await import('@/app/(main)/plan/page')
    const tree = (await PlanPage()) as { props: { children: { key: string; props: Record<string, unknown> } } }
    expect(st.calls.sort()).toEqual(['materials', 'snapshot'])
    const el = tree.props.children
    expect(el.key).toBe('user-a')
    expect(el.props).toMatchObject({ initialItems: [], initialFailed: false, viewerId: 'user-a' })
  })
})
