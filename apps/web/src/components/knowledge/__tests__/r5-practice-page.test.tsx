// apps/web/src/components/knowledge/__tests__/r5-practice-page.test.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ admin: false, pool: ['2022#20', '2020#24'], reserved: ['2022#20'], error: false }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('404') }, redirect: () => { throw new Error('redirect') } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'learner' } } }) } }) }))
vi.mock('@/lib/auth/require-admin', () => ({ getAdminUser: async () => state.admin ? { id: 'admin' } : null }))
vi.mock('@/lib/csat/rail-data', () => ({ railExams: async () => [] }))
vi.mock('@/components/csat/home/CsatShell', () => ({ CsatShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))
vi.mock('@/components/knowledge/ClaimPractice', () => ({ ClaimPractice: ({ initialItemId, pool, preview }: { initialItemId: string; pool: { itemId: string }[]; preview: boolean }) => <div data-selected={initialItemId} data-pool={pool.map((p) => p.itemId).join(',')} data-preview={preview} /> }))
vi.mock('@/lib/knowledge/practice-server', () => ({
  loadPracticePool: async () => state.pool.map((itemId) => ({ itemId, phase: 'practice', kind: 'annotated' })),
  practiceReservation: async () => ({ status: state.error ? 'error' : 'ok', reserved: new Set(state.reserved) }),
  loadMyAttempts: async () => [], loadMyReviewSessions: async () => [], loadReviewResolvers: async () => [],
}))
import PracticePage from '@/app/(app)/csat/practice/[slug]/page'
const page = async (query: { item?: string; preview?: string } = {}) => renderToStaticMarkup(await PracticePage({ params: { slug: 'claim-support' }, searchParams: query }))

beforeEach(() => { Object.assign(state, { admin: false, pool: ['2022#20', '2020#24'], reserved: ['2022#20'], error: false }) })
it('direct URL and learner preview query cannot select a reserved item', async () => {
  const html = await page({ item: '2022#20', preview: '1' })
  expect(html).toContain('data-selected="2020#24"')
  expect(html).toContain('data-pool="2020#24"')
  expect(html).toContain('data-preview="false"')
})
it('genuine admin preview can inspect the reserved item', async () => {
  state.admin = true
  expect(await page({ item: '2022#20', preview: '1' })).toContain('data-selected="2022#20"')
})
it('already exposed item remains ordinary practice', async () => {
  state.reserved = []
  expect(await page({ item: '2022#20' })).toContain('data-selected="2022#20"')
})
it.each([false, true])('empty reserved pool gives a map return with ledgerError=%s', async (error) => {
  Object.assign(state, { reserved: [...state.pool], error })
  const html = await page()
  expect(html).toContain(`data-reason="${error ? 'ledger_error' : 'reserved_for_check'}"`)
  expect(html).toContain('href="/csat/diagnosis?tab=map&amp;map_task=r.central_meaning"')
})
it('actual live practice pool zero has a truthful empty state and map return', async () => {
  state.pool = []
  const html = await page()
  expect(html).toContain('data-reason="no_live_items"')
  expect(html).not.toContain('남은 문항 0개는')
  expect(html).toContain('href="/csat/diagnosis?tab=map&amp;map_task=r.central_meaning"')
})
