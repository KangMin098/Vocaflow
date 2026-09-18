// apps/web/src/app/api/admin/csat/sources/__tests__/route.test.ts
import { beforeEach, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { evaluateSource, sourceEligibilityInput } from '@vocaflow/library-pipeline'
import { SOURCE_QUEUES } from '@/lib/textbook/source-operations'
const { guard, create, chain } = vi.hoisted(() => ({ guard: vi.fn(), create: vi.fn(), chain: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: guard }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: create }))
import { GET, POST } from '../route'
beforeEach(() => { vi.clearAllMocks(); guard.mockResolvedValue({ id: 'admin' }); create.mockReturnValue({ from: chain }) })
it('GET and POST refuse before service access when admin guard fails', async () => {
  guard.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  expect((await GET(new Request('http://localhost/api/admin/csat/sources'))).status).toBe(403)
  expect((await POST(new Request('http://localhost/api/admin/csat/sources', { method: 'POST' }))).status).toBe(403)
  expect(create).not.toHaveBeenCalled()
})
it('rejects cross-origin cache writes before parsing or service access', async () => {
  const r = await POST(new Request('http://localhost/api/admin/csat/sources', { method: 'POST', headers: { origin: 'https://untrusted.example' }, body: '{}' }))
  expect(r.status).toBe(403); expect(create).not.toHaveBeenCalled()
})
it.each(['?queue=constructor', '?id=not-a-uuid', '?page=-1'])('invalid filter %s is an error, not an empty success', async suffix => {
  expect((await GET(new Request('http://localhost/api/admin/csat/sources' + suffix))).status).toBe(400)
  expect(chain).not.toHaveBeenCalled()
})
it('missing count is not interpreted as zero inventory', async () => {
  const q = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [], count: null, error: null }) }
  chain.mockReturnValue(q)
  const response = await GET(new Request('http://localhost/api/admin/csat/sources?queue=all'))
  expect(response.status).toBe(503)
  expect(response.headers.get('cache-control')).toBe('no-store')
})

type QueryCall = { table: string; steps: Array<[string, ...unknown[]]> }
type DbResult = { data: unknown; count?: number | null; error: unknown }
function mockDatabase(resolveQuery: (call: QueryCall) => DbResult) {
  const calls: QueryCall[] = []
  chain.mockImplementation((table: string) => {
    const call: QueryCall = { table, steps: [] }
    calls.push(call)
    const query: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'neq', 'not', 'filter', 'gt', 'order', 'range', 'limit', 'ilike', 'maybeSingle', 'single', 'upsert']) {
      query[method] = (...args: unknown[]) => { call.steps.push([method, ...args]); return query }
    }
    query.then = (resolve: (result: DbResult) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(resolveQuery(call)).then(resolve, reject)
    return query
  })
  return calls
}

it.each(['eligible', 'conditional', 'review', 'rejected'])('%s list uses live effective status and current title', async queue => {
  const calls = mockDatabase(() => ({ data: [], count: 0, error: null }))
  const response = await GET(new Request(`http://localhost/api/admin/csat/sources?queue=${queue}&q=wetlands`))
  expect(response.status).toBe(200)
  expect(calls).toHaveLength(1)
  expect(calls[0].table).toBe('csat_source_operations')
  expect(calls[0].steps).toContainEqual(['eq', 'effective_status', queue])
  expect(calls[0].steps).toContainEqual(['ilike', 'current_title', '%wetlands%'])
})

it.each(['analysis', 'analyzed', 'content', 'cefr', 'excerpt', 'quality', 'p0'])('%s does not classify stale cache judgments', async queue => {
  const calls = mockDatabase(() => ({ data: [], count: 0, error: null }))
  expect((await GET(new Request(`http://localhost/api/admin/csat/sources?queue=${queue}`))).status).toBe(200)
  expect(calls[0].steps).toContainEqual(['eq', 'cache_state', 'current'])
})

it('summary reads one aggregate result without concurrent full-table counts', async () => {
  const counts = Object.fromEntries(Object.keys(SOURCE_QUEUES).map(queue => [queue, 2]))
  const calls = mockDatabase(() => ({ data: { counts, measured_at: '2026-09-19T00:00:00Z', policy_version: 3 }, error: null }))
  const response = await GET(new Request('http://localhost/api/admin/csat/sources?summary=1'))
  const body = await response.json()
  expect(response.status).toBe(200)
  expect(body.counts.stale).toBe(2)
  expect(body.measuredAt).toBe('2026-09-19T00:00:00Z')
  expect(body.counts).toEqual(counts)
  expect(body.policyVersion).toBe(3)
  expect(calls).toEqual([{ table: 'csat_source_operations_summary', steps: [['select', 'counts,measured_at,policy_version'], ['single']] }])
})

it.each([undefined, null, -1, 0.5, '2', NaN, Infinity])('invalid aggregate count %s is unavailable, never zero inventory', async invalid => {
  const counts = Object.fromEntries(Object.keys(SOURCE_QUEUES).map(queue => [queue, 2]))
  mockDatabase(() => ({ data: { counts: { ...counts, stale: invalid }, measured_at: null, policy_version: 3 }, error: null }))
  expect((await GET(new Request('http://localhost/api/admin/csat/sources?summary=1'))).status).toBe(503)
})

it('aggregate read failure is unavailable', async () => {
  mockDatabase(() => ({ data: null, error: { message: 'statement timeout' } }))
  expect((await GET(new Request('http://localhost/api/admin/csat/sources?summary=1'))).status).toBe(503)
})

const id = '11111111-1111-4111-8111-111111111111'
const revision = '2026-09-19T08:00:00.123456+00:00'
const article = { id, title: 'Coastal wetlands', status: 'ready', source: 'nasa', updated_at: revision,
  article_v_level: 5, word_count: 150, register: 'expository', cefr_level: 'B2', syntax_score: { score: 70 },
  display_only: false, license_class: 'cc_by', copyright_safe_in_kr: true,
  gate: { publishable: true, verdict: 'use', purpose: 'csat' }, windows: [{ s: 0, e: 2 }],
  content: 'Coastal wetlands sustain many forms of life.', source_url: null }
function cachedRow(overrides: Record<string, unknown> = {}) {
  const input = sourceEligibilityInput(article, false)
  return { article_id: id, source: article.source, source_updated_at: revision, policy_version: 3,
    input, result: evaluateSource(input), quality_flags: [], linked_items: 0, measured_at: '2026-09-19T09:00:00Z',
    excerpt_evidence: { windows: 1, invalidRanges: 0, approved: false, contentRevisionRecorded: false }, ...overrides }
}
function inspectorDatabase(cached: ReturnType<typeof cachedRow> | null, linkedItems = 0) {
  return mockDatabase(call => {
    if (call.table === 'library_articles') return { data: article, error: null }
    if (call.table === 'csat_source_eligibility') return { data: cached, error: null }
    if (call.table === 'csat_dcp_items') return { data: [], count: linkedItems, error: null }
    if (call.table === 'csat_item_attempts') return { data: null, count: 0, error: null }
    return { data: [], error: null }
  })
}

it('inspector exposes missing cache with unmeasured synthetic evidence instead of blocking revalidation', async () => {
  inspectorDatabase(null)
  const response = await GET(new Request(`http://localhost/api/admin/csat/sources?id=${id}`))
  const body = await response.json()
  expect(response.status).toBe(200)
  expect(body).toMatchObject({ stale: true, content: article.content, row: { article_id: id, measured_at: null,
    excerpt_evidence: { invalidRanges: null, approved: false } } })
  expect(body.current.status).toBe('eligible')
})

it.each([
  ['microsecond source change', { source_updated_at: '2026-09-19T08:00:00.123455+00:00' }, true],
  ['old policy', { policy_version: 2 }, true],
  ['last excerpt item deleted', { result: { ...cachedRow().result, grade: 'excerpt' }, linked_items: 1 }, true],
  ['same revision in another timezone', { source_updated_at: '2026-09-19T17:00:00.123456+09:00' }, false],
] as const)('inspector detects %s', async (_name, overrides, stale) => {
  inspectorDatabase(cachedRow(overrides))
  const body = await (await GET(new Request(`http://localhost/api/admin/csat/sources?id=${id}`))).json()
  expect(body.stale).toBe(stale)
})

it.each([
  ['changed by one microsecond', '2026-09-19T08:00:00.123455Z', null],
  ['same instant', '2026-09-19T17:00:00.123456+09:00', 0],
] as const)('POST handles excerpt evidence when revision is %s', async (_name, source_updated_at, invalidRanges) => {
  const calls = inspectorDatabase(cachedRow({ source_updated_at }))
  const response = await POST(new Request('http://localhost/api/admin/csat/sources', {
    method: 'POST', body: JSON.stringify({ id, action: 'revalidate' }),
  }))
  expect(response.status).toBe(200)
  const payload = calls.flatMap(call => call.steps).find(step => step[0] === 'upsert')?.[1]
  expect(payload).toMatchObject({ source_updated_at: revision, excerpt_evidence: { invalidRanges } })
})

it('POST creates the missing cache without changing the article', async () => {
  const calls = inspectorDatabase(null)
  expect((await POST(new Request('http://localhost/api/admin/csat/sources', {
    method: 'POST', body: JSON.stringify({ id, action: 'revalidate' }),
  }))).status).toBe(200)
  expect(calls.filter(call => call.steps.some(step => step[0] === 'upsert')).map(call => call.table)).toEqual(['csat_source_eligibility'])
})
