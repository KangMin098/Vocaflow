// apps/web/src/components/plan/__tests__/plan-read-state.test.tsx
// T-0240 — /plan 읽기 실패 표시 · 계정 경계(실제 PlanClient 초기 렌더) + page 배선(facade 만 · viewer key).
import fs from 'node:fs'
import path from 'node:path'
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

describe('리뷰 r2 — 쓰기 계정 경계 · props 교체(소스 결속 · 동작은 하네스 pb-t0240-r2)', () => {
  const src = () => fs.readFileSync(path.resolve(__dirname, '../PlanClient.tsx'), 'utf8')
  it('[P1] 일괄 담기 — 각 쓰기 직전 guard 토큰 확인, 바뀌면 멈추고 결과를 싣지 않는다', () => {
    const s = src()
    const batch = s.slice(s.indexOf('function commitSourceBatch'), s.indexOf('// 담은 항목 즉시 저장'))
    expect(batch).toMatch(/const token = guard\.token\(\)\s*\n\s*if \(!canWrite\(token\)\) \{/)
    expect(batch).toMatch(/for \(const m of picks\) \{[\s\S]*?if \(!canWrite\(token\)\) break\s*\n[\s\S]*?const res = await savePlanItem\(/)
    expect(batch).toMatch(/setAdding\(false\)\s*\n\s*if \(!canWrite\(token\)\) return/)
  })
  it('[P1] 단건 추가 · 수정 · 삭제도 쓰기 전에 계정 확인', () => {
    const s = src()
    const n = (s.match(/!canWrite\(token\)/g) ?? []).length
    expect(n).toBeGreaterThanOrEqual(7)
    expect(s).toMatch(/const canWrite = \(token: number\) => ownerId !== null && guard\.isCurrent\(token\) && guardRef\.current === guard/)
  })
  it('[P2] 같은 viewer props 교체 — 새 snapshot 반영 · 진행 중 읽기 무효 · 선택은 그대로', () => {
    const s = src()
    const eff = s.slice(s.indexOf('const firstProps = useRef(true)'), s.indexOf('const canWrite'))
    expect(eff).toContain('readGen.current++')
    expect(eff).toContain('setItems(initialItems)')
    expect(eff).toContain('}, [initialItems, initialFailed])')
    expect(eff).not.toMatch(/setArtSel|setDraft|setEditId/)
  })
})

describe('리뷰 r3 — expectedOwner 배선(서버 getUser 와 다르면 쓰기 전 거부)', () => {
  it('일괄 · 단건 추가 · 수정 저장과 삭제가 모두 화면 viewer 를 expectedOwner 로 넘긴다', () => {
    const s = fs.readFileSync(path.resolve(__dirname, '../PlanClient.tsx'), 'utf8')
    expect((s.match(/expectedOwner: owner/g) ?? []).length).toBe(3)
    expect(s).toContain('await removePlanItem(item.id, owner)')
    expect(s).toContain('const owner = ownerId ?? undefined')
    expect((s.match(/await savePlanItem\(/g) ?? []).length).toBe(3)
  })
})

describe('리뷰 r4 — viewer 가 null 인 경로(소유자 미확정 · 일시 인증 실패 · 확정된 변경)', () => {
  const s = () => fs.readFileSync(path.resolve(__dirname, '../PlanClient.tsx'), 'utf8')
  const reload = () => { const x = s(); return x.slice(x.indexOf('async function reloadPlan'), x.indexOf('const [, startTransition]')) }
  it('[P2] 재시도 응답이 failed·viewer null(일시 인증 실패) — 계정 변경으로 확정하지 않고 기존 화면 · 재시도 유지(무효화보다 먼저 판정)', () => {
    const r = reload()
    const transient = r.indexOf('if (snap.viewerId === null && snap.failed) {')
    expect(transient).toBeGreaterThan(0)
    expect(r.indexOf('invalidate()')).toBeGreaterThan(transient)
    expect(r.slice(transient, r.indexOf('}', transient))).toContain('setReadFailed(true)')
  })
  it('[P1] 첫 인증 실패(viewer null) 뒤 재시도 성공 — 그 응답의 viewer 로 소유자 경계를 새로 세운다', () => {
    expect(reload()).toMatch(/\} else if \(snap\.viewerId !== null\) \{[\s\S]*?setOwnerId\(snap\.viewerId\)/)
    expect(s()).toContain('const { guard, status: authStatus } = useStoryAuthGuard(ownerId)')
    expect(s()).toContain("if (ownerId && authStatus !== 'same') return <PlanIdentityNotice")
  })
  it('[P1] 소유자 확정 전에는 쓰지 않는다 — 쓰기 시작 4곳 모두 NO_OWNER 안내 후 중단', () => {
    expect((s().match(/if \(!canWrite\(token\)\) \{\s*\n\s*if \(ownerId === null\) setError\(NO_OWNER\)\s*\n\s*return/g) ?? []).length).toBe(4)
  })
  it('비로그인 확인 화면(viewer null · 실패 아님)은 그리되 쓰기는 막힌다', () => {
    const html = render({ viewerId: null })
    expect(html).toContain('aria-label="자료 추가·구성"')
  })
})
