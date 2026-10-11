// apps/web/src/app/api/admin/csat/order-runs/route.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const mocks = vi.hoisted(() => ({ requireAdminApi: vi.fn(), createAdminClient: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: mocks.requireAdminApi }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))

import { GET } from './route'

const h = (c: string) => c.repeat(64)
const order = (id: string, revision: number) => ({ grade: 'middle_1', product_order_id: id, order_revision: revision, order_hash: h('a') })
let root = ''
const write = (run: string, name: string, value: unknown) => {
  mkdirSync(path.join(root, run), { recursive: true })
  writeFileSync(path.join(root, run, name), JSON.stringify(value))
}
const dbRevision = (revision: number | null, error: unknown = null) => mocks.createAdminClient.mockReturnValue({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: revision === null ? null : { order_revision: revision }, error }) }) }) }),
})
const call = () => GET(new Request('http://localhost/api/admin/csat/order-runs?order_id=order-a'))

describe('admin order run status API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdminApi.mockResolvedValue({ id: 'admin', role: 'admin' })
    root = mkdtempSync(path.join(tmpdir(), 'vocaflow-order-runs-'))
    process.env.TEXTBOOK_ORDER_RUN_DIR = root
  })
  afterEach(() => {
    delete process.env.TEXTBOOK_ORDER_RUN_DIR
    rmSync(root, { recursive: true, force: true })
  })

  it('rejects curators and unconfigured roots without reading runs', async () => {
    mocks.requireAdminApi.mockResolvedValue({ id: 'c', role: 'curator' })
    expect((await call()).status).toBe(403)
    mocks.requireAdminApi.mockResolvedValue({ id: 'admin', role: 'admin' })
    delete process.env.TEXTBOOK_ORDER_RUN_DIR
    expect((await call()).status).toBe(503)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('reports complete, blocked and stale-revision runs for the order only', async () => {
    dbRevision(2)
    write('a-done', 'drain.json', { drain_hash: h('1'), cells: [1, 2], orders: [order('order-a', 2)] })
    write('a-done', 'result.json', { status: 'assembled', drain_hash: h('1') })
    write('a-done', 'complete.json', { manifest_hash: h('9') })
    write('b-blocked', 'drain.json', { drain_hash: h('1'), cells: [1], orders: [order('order-a', 1)] })
    write('b-blocked', 'result.json', { status: 'blocked', drain_hash: h('1'), blockers: [{ stage: 'items_gated', reason: 'READING_FAMILY_ITEM_UNGROUNDED' }] })
    write('c-other', 'drain.json', { drain_hash: h('1'), cells: [1], orders: [order('order-b', 1)] })
    const body = await (await call()).json()
    expect(body.registered_revision).toBe(2)
    expect(body.runs.map((run: { run: string }) => run.run)).toEqual(['a-done', 'b-blocked'])
    expect(body.runs[0]).toMatchObject({ status: 'complete', revision_current: true, manifest_hash: h('9') })
    expect(body.runs[1]).toMatchObject({ status: 'blocked', current_stage: 'items_gated', revision_current: false })
    expect(JSON.stringify(body)).not.toContain(root)
  })

  it('shows the atomic volume and journal state and never reuses a verdict whose files changed', async () => {
    const { createHash } = await import('node:crypto')
    const sha = (text: string) => createHash('sha256').update(text).digest('hex')
    dbRevision(1)
    write('a-run', 'drain.json', { drain_hash: h('1'), cells: [1], orders: [order('order-a', 1)] })
    write('b-run', 'drain.json', { drain_hash: h('1'), cells: [1], orders: [order('order-a', 1)] })
    write('c-run', 'drain.json', { drain_hash: h('1'), cells: [1], orders: [order('order-a', 1)] })
    const record = '{"sequence":3}'
    mkdirSync(path.join(root, 'a-run', 'atomic', 'journal', 'day-2-r2'), { recursive: true })
    writeFileSync(path.join(root, 'a-run', 'atomic', 'volume.html'), '<p>volume</p>')
    writeFileSync(path.join(root, 'a-run', 'atomic', 'journal', 'day-2-r2', 'revision-000003.json'), record)
    write('a-run', 'atomic/status.json', { state: 'volume_ready', html_sha256: sha('<p>volume</p>'), revision: 2,
      delivery_modes: ['grade_specific_adaptations'], days: [{ day: 1, grades: ['middle_1'] }, { day: 2, grades: ['middle_1'] }],
      journals: [{ journal: 'day-2-r2', state: 'complete', latest_file: 'revision-000003.json', latest_sha256: sha(record) }] })
    mkdirSync(path.join(root, 'b-run', 'atomic'), { recursive: true })
    const body = await (await call()).json()
    expect(body.runs[0].atomic).toEqual({ state: 'volume_ready', revision: 2, day_count: 2,
      delivery_modes: ['grade_specific_adaptations'], journals: [{ journal: 'day-2-r2', state: 'complete' }] })
    expect(body.runs[1].atomic.state).toBe('status_missing')
    expect(body.runs[2].atomic).toBeNull()

    // A journal record added after the status check, or a changed volume, makes the verdict stale.
    writeFileSync(path.join(root, 'a-run', 'atomic', 'journal', 'day-2-r2', 'revision-000004.json'), '{}')
    expect((await (await call()).json()).runs[0].atomic.state).toBe('status_stale')
    rmSync(path.join(root, 'a-run', 'atomic', 'journal', 'day-2-r2', 'revision-000004.json'))
    writeFileSync(path.join(root, 'a-run', 'atomic', 'volume.html'), '<p>edited</p>')
    expect((await (await call()).json()).runs[0].atomic.state).toBe('status_stale')
  })

  it('treats a DB read failure or a corrupt run file as unmeasured', async () => {
    dbRevision(null, { message: 'down' })
    expect((await call()).status).toBe(503)
    dbRevision(1)
    mkdirSync(path.join(root, 'bad'))
    writeFileSync(path.join(root, 'bad', 'drain.json'), '{not json')
    expect((await call()).status).toBe(503)
  })
})

