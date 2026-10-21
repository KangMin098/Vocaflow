// apps/web/src/app/__tests__/factory-map-return.test.tsx
// Actual async page -> return URL -> existing recap. Auth/RPC and the runner are isolated substitutes; no DB access.
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import { parseMapReturn } from '@/lib/csat/map-return'
import { returnRecap } from '@/lib/csat/map/v62/return-recap'

const state = vi.hoisted(() => ({ loggedIn: true, installed: true }))
const DELIVERY = '11111111-1111-4111-8111-111111111111'
const WORKSPACE = '22222222-2222-4222-8222-222222222222'

vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw Object.assign(new Error('redirect'), { url }) },
  notFound: () => { throw new Error('not_found') },
}))
vi.mock('@/components/csat/home/CsatShell', () => ({ CsatShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/components/csat/factory/FactoryDcpRunner', () => ({
  FactoryDcpRunner: ({ returnHref }: { returnHref: string }) => <a href={returnHref}>Workspace return</a>,
}))
vi.mock('@/lib/csat/rail-data', () => ({ railExams: async () => [] }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.loggedIn ? { id: 'u' } : null } }) },
    rpc: async () => state.installed ? { data: {
      state: 'ok', delivery_id: '11111111-1111-4111-8111-111111111111',
      workspace_id: '22222222-2222-4222-8222-222222222222', source_id: '33333333-3333-4333-8333-333333333333', attempts: 1,
      item: { id: '44444444-4444-4444-8444-444444444444', type: 'title', paragraph_idx: 0,
        payload: { passage: 'Synthetic practice passage.', stem_ko: 'Choose a title.', choices: ['A', 'B', 'C', 'D', 'E'] } },
    }, error: null } : { data: null, error: { code: '42883', message: 'function not installed' } },
  }),
}))

import FactoryDcpPage from '../(app)/csat/factory/[deliveryId]/page'

const context = { from: 'map', map_task: 'r.central_meaning', ws: 'ws.central-meaning', map_ws: WORKSPACE, map_plan: '3', map_goal: '7' }
const page = (searchParams: Record<string, string | string[] | undefined>) => FactoryDcpPage({ params: { deliveryId: DELIVERY }, searchParams })
const returned = async (query: Record<string, string | string[] | undefined>) => {
  const html = renderToStaticMarkup(await page(query))
  const href = /href="([^"]+)"/.exec(html)?.[1].replaceAll('&amp;', '&')
  if (!href) throw new Error('return link missing')
  return new URL(href, 'https://vocaflow.test')
}

beforeEach(() => { state.loggedIn = true; state.installed = true })

describe('factory return does not reuse an authored activity receipt', () => {
  it.each([true, false])('installed=%s: discard stale receipt while preserving the same Workspace/goal/plan', async (installed) => {
    state.installed = installed
    const u = await returned({ ...context, map_item: ['r5-cm-ind-1', 'ev-ind-1'], map_attempt: ['63', '64'] })
    expect(u.pathname).toBe('/csat/diagnosis')
    expect(Object.fromEntries(u.searchParams)).toEqual({ tab: 'map', view: 'full', ...Object.fromEntries(Object.entries(context).filter(([k]) => k !== 'from')) })
  })

  it('a matching past own authored attempt cannot become this factory activity', async () => {
    const old = { userId: 'u', attemptId: '63', itemRef: 'authored:r5-cm-ind-1', taskKey: 'claim-support', phase: 'practice', isCorrect: false,
      synthetic: false, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, timingUncertain: false,
      answeredAt: '2026-10-21T12:00:00.000Z', activity: 'theater', sessionId: 's', contentHash: 'c', expectedContentHash: 'c' } satisfies FindAttemptRow
    const recap = (query: Record<string, string>) => {
      const ctx = parseMapReturn(query)
      return returnRecap({ keys: ['claim-support'], activityRef: ctx.mapItem ? `authored:${ctx.mapItem}` : null,
        activityAttempt: ctx.mapAttempt, attempts: [old], activity: [], transfer: undefined, history: [], proposalDiffers: false }).latest
    }
    const stale = { ...context, map_item: 'r5-cm-ind-1', map_attempt: '63' }
    expect(recap(stale)).toMatchObject({ state: 'found', kind: 'independent_counted' }) // old URL is a real counterexample
    expect(recap(Object.fromEntries((await returned(stale)).searchParams))).toEqual({ state: 'unidentified' })
    expect(old.attemptId).toBe('63') // the fix discards incoming attribution, not historical records
  })

  it('normal map entry preserves context without inventing an activity', async () => {
    const u = await returned(context)
    expect(parseMapReturn(Object.fromEntries(u.searchParams))).toMatchObject({ mapTask: 'r.central_meaning', ws: context.ws, mapPlan: '3', mapGoal: '7', mapItem: null, mapAttempt: null })
  })

  it('ordinary entry ignores map hints and external destinations', async () => {
    const u = await returned({ ...context, from: 'other', next: 'https://outside.example', map_item: 'r5-cm-ind-1', map_attempt: '63' })
    expect(Object.fromEntries(u.searchParams)).toEqual({ tab: 'map', view: 'full' })
  })

  it('login return preserves the delivery and Workspace but discards incoming activity', async () => {
    state.loggedIn = false
    const redirected = await page({ ...context, map_item: 'r5-cm-ind-1', map_attempt: '63' }).catch((error: { url: string }) => error)
    expect(redirected).toMatchObject({
      url: expect.not.stringMatching(/map_item|map_attempt/),
    })
    if (!('url' in redirected)) throw new Error('login redirect missing')
    const login = new URL(redirected.url, 'https://vocaflow.test')
    const next = new URL(login.searchParams.get('next')!, login)
    expect(next.pathname).toBe(`/csat/factory/${DELIVERY}`)
    expect(Object.fromEntries(next.searchParams)).toEqual(context)
  })
})
