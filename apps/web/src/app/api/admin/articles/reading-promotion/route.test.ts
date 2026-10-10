// apps/web/src/app/api/admin/articles/reading-promotion/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sealProductOrder } from '@vocaflow/library-pipeline/factory-order'

const mocks = vi.hoisted(() => ({
  requireAdminApi: vi.fn(), createClient: vi.fn(), getUser: vi.fn(), rpc: vi.fn(),
}))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: mocks.requireAdminApi }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
import { POST } from './route'

const send = (body: unknown) => POST(new Request('http://localhost/api/admin/articles/reading-promotion', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}))
const order = () => ({
  schema: 'textbook-product-order/1', product_order_id: 'f02-middle_1', order_revision: 1,
  series_id: 'bridge-reading', edition_id: 'first', product_family: 'P03', product_variant: 'knowledge',
  target: JSON.parse(readFileSync(resolve(process.cwd(), '../../scripts/textbook/targets/knowledge-middle1.json'), 'utf8')) as unknown,
  grade_target: 'middle_1', reading_skill_targets: ['R2', 'R3', 'R4'], purposes: ['knowledge'],
  exam_alignment: [], domain_mix: { science: 100 }, genre_mix: { explanation: 100 },
  source_policy_version: 'source-v1', source_policy_hash: '3'.repeat(64),
  rights_policy_version: 'rights-v1', rights_policy_hash: '4'.repeat(64),
  adaptation_policy_version: 'adapt-v1', adaptation_policy_hash: '5'.repeat(64),
  item_types: ['main_point'], activity_types: [],
  passage_difficulty_profile: { lexical: 3, syntax: 3, information_density: 3, discourse: 3,
    inference: 3, abstraction: 3, background_knowledge: 3 },
  item_difficulty_profile: { reasoning: 3 }, unit_spec_version: 'unit-v1',
  chapter_spec_version: 'chapter-v1', volume_spec_version: 'volume-v1', layout_profile: 'reading-v1',
  benchmark_contract_version: 'benchmark-v1', benchmark_contract_hash: '6'.repeat(64),
  evidence_policy_version: 'evidence-v1', evidence_policy_hash: '2'.repeat(64),
  trust_policy_version: 'trust-v1', trust_policy_hash: '1'.repeat(64),
  created_at: '2026-10-07T00:00:00Z', sealed_at: '2026-10-07T00:01:00Z',
})

describe('reading promotion admin authorization route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdminApi.mockResolvedValue({ id: 'admin-1', role: 'admin' })
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mocks.rpc.mockResolvedValue({ data: { status: 'approved' }, error: null })
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc })
  })

  it('rejects curator and development bypass without a real matching session', async () => {
    mocks.requireAdminApi.mockResolvedValueOnce({ id: 'curator-1', role: 'curator' })
    expect((await send({ action: 'approve', p_request: {}, p_rationale: 'A long enough rationale.' })).status).toBe(403)
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    expect((await send({ action: 'approve', p_request: {}, p_rationale: 'A long enough rationale.' })).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('passes only the selected authenticated-admin RPC fields', async () => {
    const response = await send({ action: 'approve', p_request: { request_id: 'fixture' }, p_rationale: 'The complete order and evidence were reviewed.' })
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('approve_reading_promotion', { p_request: { request_id: 'fixture' }, p_rationale: 'The complete order and evidence were reviewed.' })
    expect((await send({ action: 'approve', p_request: {}, p_rationale: 'long rationale', extra: true })).status).toBe(400)
    expect((await send({ action: 'toString' })).status).toBe(400)
  })

  it('seals a complete order on the server before registering its exact revision and hash', async () => {
    const candidate = order()
    const response = await send({ action: 'register-order-document', order: candidate })
    expect(response.status).toBe(200)
    const sealed = sealProductOrder(candidate)
    expect(mocks.rpc).toHaveBeenCalledWith('register_reading_product_order', {
      p_order_id: candidate.product_order_id, p_order_revision: 1, p_order_hash: sealed.order_hash,
    })
    expect(await response.json()).toMatchObject({ order_hash: sealed.order_hash, capability_state: 'PARTIAL' })
  })

  it('rejects mixed or unsupported order evidence without contacting the database', async () => {
    expect((await send({ action: 'register-order', p_order_id: 'forged', p_order_revision: 1,
      p_order_hash: '0'.repeat(64) })).status).toBe(400)
    expect((await send({ action: 'register-order-document', order: {
      ...order(), grade_target: 'high_1',
    } })).status).toBe(400)
    expect((await send({ action: 'register-order-document', order: {
      ...order(), product_family: 'P14', target: { ...(order().target as object), family: 'P14' },
    } })).status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
