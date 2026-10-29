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
  it('facade 만 부른다(기존 wrapper 0 · 중복 조회 0) · 실패 · viewer 를 넘기고 key 로 재마운트하지 않는다(r5)', async () => {
    const { default: PlanPage } = await import('@/app/(main)/plan/page')
    const tree = (await PlanPage()) as { props: { children: { key: string; props: Record<string, unknown> } } }
    expect(st.calls.sort()).toEqual(['materials', 'snapshot'])
    const el = tree.props.children
    expect(el.key).toBeNull()
    expect(el.props).toMatchObject({ initialItems: [], initialFailed: false, viewerId: 'user-a' })
  })
})

describe('리뷰 r2 — 쓰기 계정 경계 · props 교체(소스 결속 · 동작은 하네스 pb-t0240-r2)', () => {
  const src = () => fs.readFileSync(path.resolve(__dirname, '../PlanClient.tsx'), 'utf8')
  it('[P1] 일괄 담기 — 각 쓰기 직전 guard 토큰 확인, 바뀌면 멈추고 결과를 싣지 않는다', () => {
    const s = src()
    const batch = s.slice(s.indexOf('function commitSourceBatch'), s.indexOf('// 담은 항목 즉시 저장'))
    expect(batch).toMatch(/const token = guard\.token\(\)\s*\n\s*if \(!canWrite\(token\)\) \{/)
    expect(batch).toMatch(/for \(const m of picks\) \{[\s\S]*?if \(!canWrite\(token\)\) break\s*\n[\s\S]*?const res = await safeSave\(/)
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
    expect(eff).toContain('}, [initialItems, initialFailed, viewerId])')
    expect(eff).not.toMatch(/setArtSel|setDraft|setEditId/)
  })
})

describe('리뷰 r3 — expectedOwner 배선(서버 getUser 와 다르면 쓰기 전 거부)', () => {
  it('일괄 · 단건 추가 · 수정 저장과 삭제가 모두 화면 viewer 를 expectedOwner 로 넘긴다', () => {
    const s = fs.readFileSync(path.resolve(__dirname, '../PlanClient.tsx'), 'utf8')
    expect((s.match(/expectedOwner: owner/g) ?? []).length).toBe(3)
    expect(s).toContain('await safeRemove(item.id, owner)')
    expect(s).toContain('const owner = ownerId ?? undefined')
    // r10 — 저장 3곳은 throw 를 실패 계약으로 바꾸는 safeSave 를 거친다(그 안에서 savePlanItem 1회)
    expect((s.match(/await safeSave\(/g) ?? []).length).toBe(3)
    expect((s.match(/await savePlanItem\(/g) ?? []).length).toBe(1)
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

describe('리뷰 r5 — props 의 소유자 판정 · 재시도 성공 초점', () => {
  const src = () => fs.readFileSync(path.resolve(__dirname, '../PlanClient.tsx'), 'utf8')
  const eff = () => { const x = src(); return x.slice(x.indexOf('const firstProps = useRef(true)'), x.indexOf('const canWrite')) }
  it('[P2] 실패 · viewer null props(일시 인증 실패) → 기존 화면 · 선택 유지, 실패 고지만(경계를 닫지 않는다)', () => {
    const e = eff()
    const t = e.indexOf('const transient = initialFailed && viewerId === null')
    expect(t).toBeGreaterThan(0)
    expect(e).toContain('if (!transient && ownerId !== null && viewerId !== ownerId) return')
    expect(e).toContain('}, [initialItems, initialFailed, viewerId])')
  })
  it('[P2] (r13 로 변경) 다른 viewer props 는 버린다 · 소유자 미확정이면 새 viewer 로 세운다', () => {
    const e = eff()
    expect(e).toMatch(/if \(!transient && ownerId !== null && viewerId !== ownerId\) return/)
    expect(e).toContain('if (ownerId === null && viewerId !== null) {')
  })
  it('[P2] page 는 viewer key 를 쓰지 않는다', () => {
    const page = fs.readFileSync(path.resolve(__dirname, '../../../app/(main)/plan/page.tsx'), 'utf8')
    expect(page).not.toContain('key={plan.viewerId')
  })
  it('[P2] 키보드 재시도 성공 → 계획 제목(tabIndex -1 · 링)으로 초점', () => {
    const x = src()
    expect(x).toContain("const fromRetry = typeof document !== 'undefined' && document.activeElement === retryRef.current")
    expect(x).toContain('if (fromRetry) focusAfterReload.current = true')
    // r6 — 표식은 제목이 실제로 초점을 받은 뒤에만 지운다(아래 r6 테스트)
    expect(x).toContain('el.focus()')
    const h1 = /<h1[^>]*data-testid="plan-heading"[^>]*>/.exec(render({ items: [ITEM] }))?.[0] ?? ''
    expect(h1).toContain('tabindex="-1"')
    expect(h1).toContain('focus-visible:ring-2')
  })
})

describe('리뷰 r6 — 읽기 · 쓰기 겹침 금지 · 초점 표식', () => {
  const src = () => fs.readFileSync(path.resolve(__dirname, '../PlanClient.tsx'), 'utf8')
  it('[P2] 재조회 중 보드 · 구성 조작 잠금 — fieldset disabled + aria-describedby 안내, 쓰기 함수 4곳도 reloading 이면 중단', () => {
    const x = src()
    expect(x).toContain('<fieldset disabled={reloading} aria-describedby={reloading ? \'plan-reloading-note\' : undefined} data-testid="plan-controls"')
    expect(x).toContain('id="plan-reloading-note"')
    expect((x.match(/\n\s*if \(reloading\) return\n/g) ?? []).length).toBe(4)
  })
  it('[P2] 쓰기 중 재시도 단추 잠금 — disabled + aria-describedby · reloadPlan 도 writing 이면 중단', () => {
    const x = src()
    expect(x).toContain('const writing = adding || pendingWrites > 0')
    expect(x).toMatch(/disabled=\{writing \|\| reloading\}\s*\n\s*aria-describedby=\{writing \? 'plan-writing-note' : undefined\}/)
    expect(x).toMatch(/async function reloadPlan\(\) \{[\s\S]{0,200}if \(writing \|\| reloadInFlight\.current\) return/)
    expect(x).toMatch(/setPendingWrites\(\(n\) => n \+ 1\)[\s\S]*?finally \{\s*\n\s*setPendingWrites\(\(n\) => n - 1\)/)
  })
  it('[P2] 초점 표식은 제목이 실제로 초점을 받은 뒤에만 지운다 — ref 콜백 · 매 렌더 재시도', () => {
    const x = src()
    expect(x).toMatch(/el\.focus\(\)\s*\n\s*if \(typeof document !== 'undefined' && document\.activeElement === el\) focusAfterReload\.current = false/)
    expect(x).toContain('<h1 ref={setHeading} tabIndex={-1}')
    expect(x).toMatch(/useEffect\(\(\) => \{\s*\n\s*tryFocusHeading\(\)\s*\n\s*\}\)/)
  })
  it('정상 렌더: 조작 영역은 fieldset 안 · 평소엔 잠기지 않음', () => {
    const html = render({ items: [ITEM] })
    const fs0 = /<fieldset[^>]*data-testid="plan-controls"[^>]*>/.exec(html)?.[0] ?? ''
    expect(fs0).not.toContain('disabled')
    expect(html).not.toContain('plan-reloading-note')
  })
})

describe('리뷰 r7 — 쓰기 중 props 보류 → 쓰기 뒤 재조회 1회', () => {
  const src = () => fs.readFileSync(path.resolve(__dirname, '../PlanClient.tsx'), 'utf8')
  it('[P2] props effect 는 같은 viewer 의 props 만 writing 중 보류한다(r8: viewer 판정 뒤 · 반영보다 앞)', () => {
    const x = src()
    const e = x.slice(x.indexOf('const firstProps = useRef(true)'), x.indexOf('const canWrite'))
    const w = e.indexOf('if (writing) {')
    expect(w).toBeGreaterThan(0)
    expect(e.slice(w, w + 120)).toContain('deferredProps.current = true')
    expect(e.indexOf('setItems(initialItems)')).toBeGreaterThan(w)
    expect(e.indexOf('if (!transient && ownerId !== null && viewerId !== ownerId) return')).toBeLessThan(w)
    expect(e.indexOf('setReloading(false)')).toBeGreaterThan(w)
  })
  it('[P2] 쓰기가 끝나면 보류분은 버리고 reloadPlan 1회(기존 재조회 잠금 경로)', () => {
    expect(src()).toMatch(/if \(writing \|\| !deferredProps\.current\) return\s*\n\s*deferredProps\.current = false\s*\n\s*void reloadPlan\(\)/)
  })
})

describe('리뷰 r8 — 다른 viewer 는 쓰기 중에도 즉시 닫기 · 재조회 중복 금지', () => {
  const src = () => fs.readFileSync(path.resolve(__dirname, '../PlanClient.tsx'), 'utf8')
  it('[P1→r13] 다른 viewer props 판정(버림)이 writing 보류보다 먼저', () => {
    const x = src()
    const e = x.slice(x.indexOf('const firstProps = useRef(true)'), x.indexOf('const canWrite'))
    expect(e.indexOf('viewerId !== ownerId) return')).toBeGreaterThan(0)
    expect(e.indexOf('viewerId !== ownerId) return')).toBeLessThan(e.indexOf('if (writing) {'))
  })
  it('[P2] reloadPlan 진행 중 ref 잠금 · 재조회 중 재시도 단추 disabled', () => {
    const x = src()
    expect(x).toMatch(/if \(writing \|\| reloadInFlight\.current\) return\s*\n\s*reloadInFlight\.current = true/)
    expect(x).toMatch(/finally \{\s*\n\s*reloadInFlight\.current = false/)
    expect(x).toContain('disabled={writing || reloading}')
  })
})

describe('리뷰 r10 — 쓰기 상태 반드시 해제 · 재시도 실패 뒤 초점 복구', () => {
  const src = () => fs.readFileSync(path.resolve(__dirname, '../PlanClient.tsx'), 'utf8')
  it('[P2] 단건 · 일괄 추가는 finally 에서 adding 해제 · 수정 · 삭제는 finally 에서 pendingWrites 감소', () => {
    const x = src()
    const draft = x.slice(x.indexOf('function commitDraft'), x.indexOf('// ── 스크립트 다건 선택'))
    expect(draft).toMatch(/try \{\s*\n\s*res = await safeSave\([\s\S]*?\} finally \{\s*\n\s*setAdding\(false\)/)
    const batch = x.slice(x.indexOf('function commitSourceBatch'), x.indexOf('// 담은 항목 즉시 저장'))
    expect(batch).toMatch(/\} finally \{\s*\n\s*\/\/[^\n]*\n\s*setAdding\(false\)/)
    expect((x.match(/finally \{\s*\n\s*setPendingWrites\(\(n\) => n - 1\)/g) ?? []).length).toBe(2)
  })
  it('[P2] 서버 액션이 던지면 기존 실패 계약(ok:false · 안내)으로 — 저장 · 삭제 모두', () => {
    const x = src()
    expect(x).toMatch(/const safeSave = async[\s\S]*?try \{\s*\n\s*return await savePlanItem\(input\)\s*\n\s*\} catch \{[\s\S]{0,200}?return \{ ok: false as const/)
    expect(x).toMatch(/const safeRemove = async[\s\S]*?try \{\s*\n\s*return await removePlanItem\(id, expected\)\s*\n\s*\} catch \{[\s\S]{0,200}?return \{ ok: false as const/)
  })
  it('[P2] 키보드 재시도가 다시 실패하면 단추가 다시 활성이 된 뒤 그 단추로 초점(사용자가 옮기지 않았을 때만)', () => {
    const x = src()
    expect(x).toContain('if (fromRetry && !succeeded && gen === readGen.current) focusRetryAfter.current = true')
    expect(x).toMatch(/if \(!focusRetryAfter\.current \|\| reloading\) return\s*\n\s*const b = retryRef\.current\s*\n\s*if \(!b \|\| b\.disabled\) return/)
    expect(x).toContain('if (!a || a === document.body) b.focus()')
  })
})

describe('리뷰 r11 — 자료 목록의 소유자 경계(개인 스크립트 제목)', () => {
  const art = (id: string, title: string) => ({ id, title, subtitle: null, slug: null, vLevel: 3, coverUrl: null, coverEmoji: null, source: 'bbc', category: null, chapterCount: 0, bookId: null, chapterIdx: null, feedLabel: null })
  const mats = (viewerId: string | null) => ({ viewerId, books: [], articles: [], wordSets: [], scripts: [art('s1', 'A Private Script One'), art('s2', 'A Private Script Two')] })
  const tabCounts = (html: string) => [...html.matchAll(/<button[^>]*role="tab"[\s\S]*?<span class="font-mono text-\[10px\]">(\d+)<\/span>/g)].map((m) => Number(m[1]))
  const renderM = (m: ReturnType<typeof mats>, viewerId: string | null) =>
    renderToString(<PlanClient initialItems={[ITEM]} viewerId={viewerId} materials={m} todayWeekday={3} weekDates={WEEK} />)
  it('[P1] 목록을 읽은 viewer(A)와 계획 소유자(B)가 다르면 A 의 자료를 쓰지 않는다 — 탭 수 0 · 제목 0', () => {
    const html = renderM(mats('user-a'), 'user-b')
    expect(tabCounts(html)).toEqual([0, 0, 0, 0])
    expect(html).not.toContain('A Private Script')
  })
  it('대조 — 같은 viewer 면 그대로(내 스크립트 2)', () => {
    expect(tabCounts(renderM(mats('user-a'), 'user-a'))).toEqual([0, 0, 0, 2])
  })
  it('[P1] 소유자 불일치면 1회만 다시 읽고, 응답도 지금 소유자와 같을 때만 반영 · 소유자가 바뀌면 즉시 비움(렌더 시 판정)', () => {
    const x = fs.readFileSync(path.resolve(__dirname, '../PlanClient.tsx'), 'utf8')
    expect(x).toContain('const materials: AvailableMaterials = matsOwner === ownerId ? mats : EMPTY_MATERIALS')
    expect(x).toMatch(/if \(ownerId === null \|\| matsOwner === ownerId \|\| matsRefetched\.current\) return\s*\n\s*matsRefetched\.current = true\s*\n\s*const forOwner = ownerId\s*\n\s*void fetchAvailableMaterials\(\)/)
    expect(x).toContain('if (ownerRef.current !== forOwner) return')
    expect(x).toContain('if ((m.viewerId ?? null) === forOwner) {')
    const a = fs.readFileSync(path.resolve(__dirname, '../../../lib/learner/plan-actions.ts'), 'utf8')
    expect(a).toMatch(/return \{\s*\n\s*viewerId: user\.id,/)
    expect(a).toContain("const empty: AvailableMaterials = { viewerId: null,")
  })
})

describe('리뷰 r12 — 자료 재조회 실패 복구 · 쓰기 결과 미확인 시 재조회 단추', () => {
  const src = () => fs.readFileSync(path.resolve(__dirname, '../PlanClient.tsx'), 'utf8')
  it('[P2] 자료 재조회 실패(예외 · 다른 viewer 응답) → 실패 표시 · 「자료 다시 불러오기」가 표식을 다시 연다 · 소유자가 바뀌면 다시 연다', () => {
    const x = src()
    expect(x).toMatch(/\.catch\(\(\) => \{\s*\n\s*if \(ownerRef\.current === forOwner\) setMatsFailed\(true\)/)
    expect(x).toMatch(/\} else setMatsFailed\(true\)/)
    expect(x).toMatch(/const retryMaterials = \(\) => \{\s*\n\s*matsRefetched\.current = false\s*\n\s*setMatsFailed\(false\)\s*\n\s*setMatsTry\(\(n\) => n \+ 1\)/)
    expect(x).toMatch(/if \(matsFor\.current !== ownerId\) \{\s*\n\s*matsFor\.current = ownerId\s*\n\s*matsRefetched\.current = false/)
    expect(x).toContain('}, [ownerId, matsOwner, matsTry])')
    expect(x).toContain('data-testid="plan-materials-retry"')
  })
  it('[P2] 쓰기 예외 → writeUnknown 으로 같은 자리에 재조회 단추 · 안내는 지금 할 수 있는 행동 · 재조회 성공 시 해제', () => {
    const x = src()
    expect((x.match(/setWriteUnknown\(true\)/g) ?? []).length).toBe(2)
    expect(x).toContain('{(readFailed || writeUnknown) && (')
    expect(x).toContain("'저장 결과를 확인하지 못했어요. 다시 불러와 지금 계획을 확인해 주세요.'")
    expect(x).toMatch(/setReadFailed\(false\)\s*\n\s*setWriteUnknown\(false\)/)
  })
})

describe('리뷰 r13 — 자료 조회 예외가 계획 표시를 막지 않음 · 늦은 다른 viewer props 는 버림', () => {
  it('[P2] fetchAvailableMaterials 가 던져도 page 는 계획 결과를 그대로 넘기고 자료 실패를 표시 경로로', async () => {
    const pa = await import('@/lib/learner/plan-actions')
    const spy = vi.mocked(pa.fetchAvailableMaterials).mockImplementationOnce(async () => { throw new Error('network') })
    const { default: PlanPage } = await import('@/app/(main)/plan/page')
    const tree = (await PlanPage()) as { props: { children: { props: Record<string, unknown> } } }
    const p = tree.props.children.props
    expect(p).toMatchObject({ initialItems: [], initialFailed: false, viewerId: 'user-a', initialMaterialsFailed: true })
    expect((p.materials as { scripts: unknown[] }).scripts).toEqual([])
    spy.mockReset()
  })
  it('[P2] 실제 PlanClient — 자료 실패 props 면 「자료 다시 불러오기」가 처음부터 보인다', () => {
    const html = renderToString(<PlanClient initialItems={[ITEM]} viewerId="user-a" materials={{ viewerId: null, books: [], articles: [], wordSets: [], scripts: [] }} initialMaterialsFailed todayWeekday={3} weekDates={WEEK} />)
    expect(html).toContain('data-testid="plan-materials-retry"')
    expect(html).toContain('Book One')
  })
  it('[P2] props viewer 가 현재 소유자와 다르면 그 props 를 버린다 — guard 를 무효화하지 않는다(닫기는 브라우저 인증 이벤트만)', () => {
    const x = fs.readFileSync(path.resolve(__dirname, '../PlanClient.tsx'), 'utf8')
    const e = x.slice(x.indexOf('const firstProps = useRef(true)'), x.indexOf('const canWrite'))
    expect(e).not.toContain('invalidate()')
    expect(e).toMatch(/if \(!transient && ownerId !== null && viewerId !== ownerId\) return/)
  })
})

describe('리뷰 r14 — 새 소유자는 확인 상태를 물려받지 않음 · 새 props 의 자료 실패를 다시 계산', () => {
  const src = () => fs.readFileSync(path.resolve(__dirname, '../PlanClient.tsx'), 'utf8')
  it('[P2] null → viewer 로 소유자를 정하는 두 곳(props · 재조회) 모두 confirmed · 계획을 초기화', () => {
    const x = src()
    expect(x).toMatch(/if \(ownerId === null && viewerId !== null\) \{\s*\n[^\n]*\n\s*setOwnerId\(viewerId\)\s*\n\s*setConfirmed\(false\)\s*\n\s*setItems\(\[\]\)/)
    expect(x).toMatch(/setOwnerId\(snap\.viewerId\)\s*\n[^\n]*\n\s*setConfirmed\(false\)\s*\n\s*setItems\(\[\]\)/)
  })
  it('[P2] 자료 props 교체마다 matsFailed 재계산 · 재조회 성공 시 1회 표식 재개방', () => {
    const x = src()
    expect(x).toMatch(/setMats\(initialMaterials\)\s*\n\s*setMatsFailed\(initialMaterialsFailed\)/)
    expect(x).toContain('}, [initialMaterials, initialMaterialsFailed])')
    expect(x).toMatch(/matsRefetched\.current = false\s*\n\s*setMats\(m\)\s*\n\s*setMatsFailed\(false\)/)
  })
})
