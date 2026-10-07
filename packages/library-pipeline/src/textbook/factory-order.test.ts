// packages/library-pipeline/src/textbook/factory-order.test.ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  FACTORY_STATE_STAGE,
  PRODUCT_CAPABILITIES,
  planFactoryTransition,
  planFactoryImpact,
  assessFactoryEvidence,
  bindFactoryEvidence,
  productOrderSchema,
  routeFactorySource,
  sealProductOrder,
} from './factory-order'
import { FACTORY_STAGES, stageForFactoryOrderState } from '../../../../apps/web/src/lib/csat/factory-model'
import type { ArticleLicense } from './academic-reading'

const target = JSON.parse(readFileSync(new URL('../../../../scripts/textbook/targets/knowledge-middle1.json', import.meta.url), 'utf8'))
const difficulty = { lexical: 3, syntax: 3, information_density: 3, discourse: 3, inference: 3, abstraction: 3, background_knowledge: 3 }
const order = (age: 'middle_1' | 'high_1' = 'middle_1') => ({
  schema: 'textbook-product-order/1', product_order_id: `f02-${age}`, order_revision: 1,
  series_id: 'bridge-reading', edition_id: 'first', product_family: 'P03', product_variant: 'knowledge',
  target: age === 'middle_1' ? target : {
    ...target, age_band: 'high_1', reasoning_band: 'high_1', skills: ['R2', 'R3', 'R4'],
  },
  grade_target: age, reading_skill_targets: ['R2', 'R3', 'R4'], purposes: ['knowledge'],
  exam_alignment: [], domain_mix: { science: 100 }, genre_mix: { explanation: 100 },
  source_policy_version: 'source-v1', source_policy_hash: h('3'), rights_policy_version: 'rights-v1', rights_policy_hash: h('4'),
  adaptation_policy_version: 'adapt-v1', adaptation_policy_hash: h('5'),
  item_types: ['main_point'], activity_types: [], passage_difficulty_profile: difficulty,
  item_difficulty_profile: { reasoning: age === 'middle_1' ? 3 : 6 },
  unit_spec_version: 'unit-v1', chapter_spec_version: 'chapter-v1', volume_spec_version: 'volume-v1',
  layout_profile: 'reading-v1', benchmark_contract_version: 'benchmark-v1', benchmark_contract_hash: h('6'),
  evidence_policy_version: 'evidence-v1', evidence_policy_hash: h('2'),
  trust_policy_version: 'trust-v1', trust_policy_hash: h('1'),
  created_at: '2026-10-07T00:00:00Z', sealed_at: '2026-10-07T00:01:00Z',
})
const h = (c: string) => c.repeat(64)
const evidence = {
  source_id: 'source-f02', source_route: 'ADAPT_REQUIRED', source_hash: h('a'), rights_hash: h('b'), trust_policy_hash: h('1'), evidence_policy_hash: h('2'), adaptation_hash: h('c'),
  benchmark_version: 'benchmark-v1', benchmark_snapshot_hash: h('d'), certificate_hash: h('e'),
}
const rights: ArticleLicense = {
  canonical_source: 'frym', canonical_url: 'https://example.org/f02', original_author: 'author',
  published_at: null, license: 'CC BY', license_url: 'https://example.org/license',
  commercial_use: true, derivative_use: true, ai_processing: 'allowed', third_party_text: false,
  third_party_image: false, attribution_required: true, share_alike: false, original_work_id: null,
  discovered_via: null, checked_at: '2026-10-07T00:00:00Z', evidence: 'Official article license evidence',
}

describe('factory order contract', () => {
  it('keeps two grades of the same source in independent evidence graphs', () => {
    const middle = bindFactoryEvidence(productOrderSchema.parse(order()), evidence)
    const high = bindFactoryEvidence(productOrderSchema.parse(order('high_1')), evidence)
    expect(middle.evidence.source_id).toBe(high.evidence.source_id)
    expect(middle.evidence.order_hash).not.toBe(high.evidence.order_hash)
    expect(middle.evidence.target_hash).not.toBe(high.evidence.target_hash)
    expect(assessFactoryEvidence(middle.evidence, high.evidence).state).toBe('stale')
    expect(assessFactoryEvidence(middle.evidence, middle.evidence).state).toBe('current')
    expect(() => bindFactoryEvidence(productOrderSchema.parse(order()), { ...evidence, trust_policy_hash: h('f') })).toThrow()
    const revised = bindFactoryEvidence(productOrderSchema.parse({ ...order(), benchmark_contract_hash: h('f') }), evidence)
    expect(assessFactoryEvidence(middle.evidence, revised.evidence).state).toBe('stale')
  })

  it('blocks unsupported products, items and target revision mixing at order creation', () => {
    expect(productOrderSchema.safeParse({ ...order(), product_family: 'P14' }).success).toBe(false)
    expect(productOrderSchema.safeParse({ ...order(), item_types: ['integrated_chart'] }).success).toBe(false)
    expect(productOrderSchema.safeParse({ ...order(), target: { ...target, age_band: 'high_1' } }).success).toBe(false)
    expect(PRODUCT_CAPABILITIES.P14.state).toBe('PLANNED')
    expect(sealProductOrder(order()).capability_state).toBe('PARTIAL')
    expect(productOrderSchema.safeParse({ ...order(), domain_mix: {} }).success).toBe(false)
    expect(productOrderSchema.safeParse({ ...order(), genre_mix: { explanation: 10 } }).success).toBe(false)
    expect(productOrderSchema.safeParse({ ...order(), activity_types: ['unbuilt_activity'] }).success).toBe(false)
    expect(productOrderSchema.safeParse({ ...order(), exam_alignment: ['csat'] }).success).toBe(false)
  })

  it('routes only eligible sources into direct use or adaptation', () => {
    const base = { rights, target, age_suitable: true as const, source_quality: 'pass' as const }
    expect(routeFactorySource({ ...base, original_fit: 'fits' }).route).toBe('DIRECT_USE')
    expect(routeFactorySource({ ...base, original_fit: 'requires_adaptation' }).route).toBe('ADAPT_REQUIRED')
    expect(routeFactorySource({ ...base, original_fit: 'fits', age_suitable: false }).route).toBe('ADAPT_REQUIRED')
    expect(routeFactorySource({ ...base, original_fit: 'unknown' }).route).toBe('REFERENCE_ONLY')
    expect(routeFactorySource({ ...base, rights: { ...rights, commercial_use: false }, original_fit: 'fits' }).route).toBe('REFERENCE_ONLY')
    expect(routeFactorySource({ ...base, rights: { ...rights, derivative_use: false }, original_fit: 'requires_adaptation' }).route).toBe('REFERENCE_ONLY')
    expect(routeFactorySource({ ...base, rights: { ...rights, canonical_source: 'openalex' }, original_fit: 'fits' }).route).toBe('DISCOVERY_ONLY')
  })

  it('invalidates any changed evidence and refuses a skipped production transition', () => {
    const bound = bindFactoryEvidence(productOrderSchema.parse(order()), evidence).evidence
    for (const field of ['source_hash', 'rights_hash', 'trust_policy_hash', 'evidence_policy_hash', 'capability_hash', 'adaptation_hash', 'benchmark_version', 'benchmark_snapshot_hash', 'certificate_hash'] as const) {
      const changed = { ...bound, [field]: field === 'benchmark_version' ? 'benchmark-v2' : h('f') }
      const assessment = assessFactoryEvidence(bound, changed)
      expect(assessment.state).toBe('stale')
      expect(() => planFactoryTransition('queued', 'promotion_ready', bound, changed)).toThrow()
    }
    expect(assessFactoryEvidence(bound, bound, false).state).toBe('invalidated')
    expect(() => planFactoryTransition('queued', 'ready', bound, bound)).toThrow()
    expect(() => planFactoryTransition('queued', 'promotion_ready', bound, bound, false)).toThrow()
    const plan = planFactoryTransition('queued', 'promotion_ready', bound, bound)
    expect(plan).toMatchObject({ proposed_state: 'promotion_ready', required_gate: 'promotion_preflight', authorized: false })
    const fake = { ...bound, certificate_hash: h('f') }
    expect(planFactoryTransition('gold_review_ready', 'gold_certified', fake, fake))
      .toMatchObject({ required_gate: 'signed_gold_s_issuance', authorized: false })
    const direct = { ...bound, source_route: 'DIRECT_USE' as const, adaptation_hash: null, certificate_hash: null }
    expect(planFactoryTransition('source_candidate', 'direct_use_reviewed', direct, direct))
      .toMatchObject({ required_gate: 'content_review', authorized: false })
    expect(planFactoryTransition('benchmark_validated', 'ready', direct, direct))
      .toMatchObject({ required_gate: 'db_promotion_or_existing_direct_article', authorized: false })
    const reference = { ...bound, source_route: 'REFERENCE_ONLY' as const }
    expect(() => planFactoryTransition('source_candidate', 'adaptation_candidate', reference, reference)).toThrow()
  })

  it('maps every contract state to one existing factory stage', () => {
    const stages = new Set(FACTORY_STAGES.map(stage => stage.id))
    expect(Object.values(FACTORY_STATE_STAGE).every(stage => stages.has(stage))).toBe(true)
    expect(stageForFactoryOrderState('ready').id).toBe('author')
    expect(stageForFactoryOrderState('queued').id).toBe('source')
  })

  it('plans stale propagation through descendants without crossing unrelated orders', () => {
    const rows = [
      { artifact_id: 'source-f02', kind: 'source' as const, product_order_id: null, order_revision: null, evidence_hash: h('a'), depends_on: [] },
      { artifact_id: 'm1-passage', kind: 'passage' as const, product_order_id: 'f02-middle_1', order_revision: 1, evidence_hash: h('b'), depends_on: ['source-f02'] },
      { artifact_id: 'm1-item', kind: 'item' as const, product_order_id: 'f02-middle_1', order_revision: 1, evidence_hash: h('c'), depends_on: ['m1-passage'] },
      { artifact_id: 'h1-passage', kind: 'passage' as const, product_order_id: 'f02-high_1', order_revision: 1, evidence_hash: h('d'), depends_on: ['source-f02'] },
      { artifact_id: 'other-source', kind: 'source' as const, product_order_id: null, order_revision: null, evidence_hash: h('e'), depends_on: [] },
    ]
    expect(planFactoryImpact(rows, ['m1-passage'], 'changed').map(x => x.artifact_id)).toEqual(['m1-passage', 'm1-item'])
    expect(planFactoryImpact(rows, ['source-f02'], 'rights_revoked').map(x => x.artifact_id)).toEqual(['source-f02', 'm1-passage', 'm1-item', 'h1-passage'])
    expect(() => planFactoryImpact(rows.map(row => row.artifact_id === 'm1-item' ? { ...row, depends_on: ['h1-passage'] } : row), ['m1-passage'], 'changed')).toThrow('cross-order')
    expect(() => planFactoryImpact(rows.map(row => row.artifact_id === 'm1-item' ? { ...row, depends_on: [] } : row), ['source-f02'], 'rights_revoked')).toThrow('source-rooted')
  })
})
