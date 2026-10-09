// apps/web/src/lib/csat/__tests__/order-trace.test.ts
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { canonicalJson, reviewDigest } from '@vocaflow/library-pipeline'
import { deriveOrderTrace, parseOrderProductionTrace } from '../order-trace'

const h = (char: string) => char.repeat(64)
const sha = (value: string) => createHash('sha256').update(value).digest('hex')
const now = '2026-10-07T12:00:00Z'
function fixture(): Parameters<typeof deriveOrderTrace>[0] {
  const order = { order_id: 'order-one', order_revision: 2, order_hash: h('a') }
  const source = { id: 'source-one', source_id: 'frym:fixture', source_url: 'https://example.org/fixture',
    content: 'Original synthetic passage.', csat_fit: null, source: 'frym', license: 'CC BY 4.0', license_class: 'cc_by',
    display_only: false, copyright_safe_in_kr: true, status: 'ready', updated_at: now }
  const passage = 'Synthetic passage.'
  const audit = { request_id: 'request-one', request_hash: h('1'), evidence_hash: h('2'), article_id: 'article-one', source_id: source.id, order_revision: 2,
    order_hash: h('a'), trust_policy_hash: h('b'), benchmark_version: 'benchmark-v1', benchmark_snapshot_hash: h('c'),
    certificate_hash: h('d'), eligibility_hash: h('e'), result_status: 'ready', request_payload: {
      source_content_sha256: sha(source.content), child_content_sha256: sha(passage),
      source_updated_at: now, article_updated_at: now, child_source_id: 'reading:fixture',
      rights_hash: sha(canonicalJson({ id: source.id, source_id: source.source_id, source_url: source.source_url,
        content: source.content, csat_fit: source.csat_fit, license: source.license,
        license_class: source.license_class, display_only: source.display_only,
        copyright_safe_in_kr: source.copyright_safe_in_kr, status: source.status,
        updated_at: source.updated_at })),
    } }
  const payload = { passage, factory_lineage: {
    product_order_id: order.order_id, order_revision: 2, order_hash: order.order_hash,
    evidence_hash: audit.evidence_hash, promotion_request_id: audit.request_id,
    promotion_request_hash: audit.request_hash, source_revision: source.updated_at,
    source_hash: sha(source.content), adaptation_revision: now, adaptation_hash: sha(passage),
    rights_hash: audit.request_payload.rights_hash, certificate_hash: audit.certificate_hash,
    eligibility_hash: audit.eligibility_hash, trust_policy_hash: audit.trust_policy_hash,
    benchmark_version: audit.benchmark_version, benchmark_snapshot_hash: audit.benchmark_snapshot_hash,
  } }
  const answer_key = { answer: 2, explanation_ko: 'The synthetic passage supports option two.' }
  const item = { id: 'item-one', ref_id: audit.article_id, payload, answer_key }
  const digest = reviewDigest(payload, answer_key)
  return { order, audits: [audit], authority: {
    trust_policy_hash: audit.trust_policy_hash, benchmark_version: audit.benchmark_version, benchmark_snapshot_hash: audit.benchmark_snapshot_hash,
    valid_until: '2026-10-08T00:00:00Z', revoked_certificate_hashes: [], revoked_eligibility_hashes: [],
  }, article: { id: audit.article_id, status: 'ready', adapted_from_id: 'source-one',
    display_only: false, copyright_safe_in_kr: true, content: passage, source: source.source,
    license: source.license, license_class: source.license_class, source_id: 'reading:fixture', updated_at: now }, source,
  items: [item], itemStates: [], reviews: ['setter', 'analyst', 'tutor'].map(persona => ({
    item_id: item.id, persona, verdict: 'pass', reviewed_digest: digest,
  })), now }
}

describe('order trace keeps unknown separate from observed evidence', () => {
  it('shows only DB-observable stages and leaves production output unmeasured', () => {
    const trace = deriveOrderTrace(fixture())
    expect(trace.entries.find(row => row.stage === 'editorial')?.state).toBe('observed')
    expect(trace.entries.filter(row => ['unit', 'volume', 'rendered', 'published'].includes(row.stage))
      .every(row => row.state === 'unmeasured')).toBe(true)
    expect(trace.blocker).toBe('DOWNSTREAM_UNMEASURED')
  })

  it('blocks a changed order, revoked rights, expired authority and changed item lineage', () => {
    const changedOrder = fixture()
    changedOrder.order = { ...changedOrder.order!, order_revision: 3 }
    expect(deriveOrderTrace(changedOrder).blocker).toBe('ORDER_REVISION_STALE')
    const rights = fixture()
    rights.article = { ...rights.article!, copyright_safe_in_kr: false }
    expect(deriveOrderTrace(rights).blocker).toBe('RIGHTS_CHANGED')
    const parentRights = fixture()
    parentRights.source = { ...parentRights.source!, copyright_safe_in_kr: false }
    expect(deriveOrderTrace(parentRights).blocker).toBe('RIGHTS_CHANGED')
    const childLicense = fixture()
    childLicense.article = { ...childLicense.article!, license: 'CC BY-NC' }
    expect(deriveOrderTrace(childLicense).blocker).toBe('RIGHTS_CHANGED')
    const sourceText = fixture()
    sourceText.source = { ...sourceText.source!, content: 'Changed source passage.' }
    expect(deriveOrderTrace(sourceText).blocker).toBe('SOURCE_OR_PASSAGE_STALE')
    const expired = fixture()
    expired.authority = { ...expired.authority!, valid_until: now }
    expect(deriveOrderTrace(expired).blocker).toBe('AUTHORITY_EXPIRED')
    const item = fixture()
    item.items![0]!.payload.factory_lineage = { ...item.items![0]!.payload.factory_lineage as object,
      benchmark_snapshot_hash: h('f') }
    expect(deriveOrderTrace(item).blocker).toBe('ITEM_EVIDENCE_MISMATCH')
    const mixedRights = fixture()
    mixedRights.items![0]!.payload.factory_lineage = { ...(mixedRights.items![0]!.payload.factory_lineage as object),
      rights_hash: h('f') }
    expect(deriveOrderTrace(mixedRights).blocker).toBe('ITEM_EVIDENCE_MISMATCH')
    const state = fixture()
    state.itemStates = [{ item_id: 'item-one', status: 'blocked', reason_code: 'editorial' }]
    expect(deriveOrderTrace(state).blocker).toBe('ITEM_STATE_BLOCKED')
  })

  it('does not turn missing queries or other-order items into zero or stale success', () => {
    const missing = fixture()
    missing.authority = null
    expect(deriveOrderTrace(missing).blocker).toBe('AUTHORITY_UNMEASURED')
    const noItems = fixture()
    noItems.items = null
    expect(deriveOrderTrace(noItems).entries.find(row => row.stage === 'item')?.state).toBe('unmeasured')
    const otherOrder = fixture()
    otherOrder.items![0]!.payload.factory_lineage = { product_order_id: 'another-order' }
    expect(deriveOrderTrace(otherOrder).blocker).toBe('ITEM_PENDING')
  })

  it('reports only DB-observed render/publication and does not invent unit or volume evidence', () => {
    const input = fixture()
    input.production = { status: 'not_registered' }
    expect(deriveOrderTrace(input).blocker).toBe('PRODUCTION_GROUP_PENDING')
    input.production = { status: 'registered_unverified', group_id: 'group-one', group_revision: 1 }
    expect(deriveOrderTrace(input).entries.find(row => row.stage === 'unit')?.state).toBe('hold')
    input.production = { status: 'registered_stale', group_id: 'group-one', group_revision: 1 }
    expect(deriveOrderTrace(input).entries.find(row => row.stage === 'published')?.state).toBe('stale')
    input.production = { status: 'captured_current', group_id: 'group-one', group_revision: 1,
      snapshot_id: '00000000-0000-4000-8000-000000000001', snapshot_hash: h('a') }
    expect(deriveOrderTrace(input).blocker).toBe('RENDER_PENDING')
    input.production = { ...input.production, status: 'rendered_current', output_hash: h('b') }
    expect(deriveOrderTrace(input).entries.find(row => row.stage === 'rendered')?.state).toBe('observed')
    expect(deriveOrderTrace(input).entries.find(row => row.stage === 'published')?.state).toBe('hold')
    input.production = { ...input.production, status: 'published_current' }
    const published = deriveOrderTrace(input)
    expect(published.entries.find(row => row.stage === 'published')?.state).toBe('observed')
    expect(published.entries.find(row => row.stage === 'unit')?.state).toBe('unmeasured')
    expect(published.entries.find(row => row.stage === 'volume')?.state).toBe('unmeasured')
    input.production = { ...input.production, status: 'stale' }
    expect(deriveOrderTrace(input).entries.find(row => row.stage === 'published')?.state).toBe('stale')
  })

  it('rejects malformed production observations before attaching them to an order', () => {
    expect(parseOrderProductionTrace({ status: 'published_current' })).toBeNull()
    expect(parseOrderProductionTrace({ status: 'published_current', group_id: 'group-one',
      group_revision: 1, snapshot_id: '00000000-0000-4000-8000-000000000001', snapshot_hash: h('a'),
      output_hash: null })).toBeNull()
    expect(parseOrderProductionTrace({ status: 'not_registered', html: '<p>raw</p>' })).toBeNull()
    expect(parseOrderProductionTrace({ status: 'registered_stale', group_id: 'group-one',
      group_revision: 1 })).toEqual({ status: 'registered_stale', group_id: 'group-one', group_revision: 1 })
  })
})
