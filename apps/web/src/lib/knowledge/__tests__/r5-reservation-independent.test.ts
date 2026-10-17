// apps/web/src/lib/knowledge/__tests__/r5-reservation-independent.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ExposureLedger } from '@/lib/csat/map/v62/assessment-exposure'

const m = vi.hoisted(() => ({ links: vi.fn(), ledger: vi.fn() }))
vi.mock('../product-server', () => ({
  CLAIM_SUPPORT_TASK: 'claim-support', itemTaskRef: (_: string, id: string) => id,
  loadMapPracticeLinks: m.links,
  loadLiveApplication: async () => ({ app: { id: 'app', version: 1 } }),
}))
vi.mock('@/lib/csat/map/v62/exposure-ledger', () => ({ loadExposureLedger: m.ledger }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/csat/embargo-gate', () => ({ embargoedItemIds: async () => new Set(), canRevealItem: async () => true }))
import { practiceReservation } from '../practice-server'

const db = {} as SupabaseClient
const clean = (): ExposureLedger => ({ status: 'ok', events: [], passageKeys: { '2022#20': 'p' } })
beforeEach(() => {
  m.links.mockReset().mockResolvedValue({ otherTask: { confirm: [{ target: '2022#20', taskKey: 'other-task' }] } })
  m.ledger.mockReset().mockResolvedValue(clean())
})
it('unseen confirmation under another TASK is reserved', async () => {
  expect([...(await practiceReservation('learner-a', db)).reserved]).toEqual(['2022#20'])
})
it('reservation link query failure closes all live practice candidates', async () => {
  m.links.mockRejectedValue(new Error('links unavailable'))
  const result = await practiceReservation('learner-a', db)
  expect(result.status).toBe('error')
  expect(result.reserved.has('2022#20')).toBe(true)
  expect(result.reserved.has('2025#20')).toBe(true)
})
it('partial ledger or thrown ledger failure does not expose reserved candidates', async () => {
  for (const failure of [false, true]) {
    if (failure) m.ledger.mockRejectedValueOnce(new Error('network'))
    else m.ledger.mockResolvedValueOnce({ status: 'error', failed: ['trap'] })
    const result = await practiceReservation('learner-a', db)
    expect(result.status).toBe('error')
    expect(result.reserved.has('2022#20')).toBe(true)
  }
})
it('learner exposure never transfers to another user', async () => {
  m.ledger.mockImplementation(async (_db: unknown, user: string) => user === 'learner-a' ? {
    ...clean(), events: [{ itemRef: '2022#20', source: 'g2_attempt', taskKey: 'other-task', activity: 'theater', phase: 'practice', helpLevel: null, sessionId: null, contentHash: null, deleted: false }],
  } : clean())
  expect((await practiceReservation('learner-a', db)).reserved.size).toBe(0)
  expect((await practiceReservation('learner-b', db)).reserved.has('2022#20')).toBe(true)
})
