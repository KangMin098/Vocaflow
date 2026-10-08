// scripts/textbook/reading-promotion/preflight.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { bindFactoryEvidence, sealProductOrder } from '@vocaflow/library-pipeline/factory-order'
import { reviewDigest } from '@vocaflow/library-pipeline'
import { sealMultiGradeProductOrder } from '@vocaflow/library-pipeline/multi-grade-order'
import { hash } from '../frym-benchmark/benchmark.mjs'
import { sourceRightsHash, validateGoldSImport } from '../frym-benchmark/gold-s-import-gate.mjs'
import { adaptationKey, canonical, digest, targetKey } from '../academic-reading-contract.mjs'
import { READING_ENGINE_VERSION } from '@vocaflow/library-pipeline/academic-reading'
import { REVIEWERS, REVIEW_DIMENSIONS, reviewTemplate, validateAgentReviews } from '../academic-reading-review.mjs'
import { prepareReadingPromotion } from './preflight.mjs'
import { assessPromotionAuthorization } from './authorization.mjs'
import { currentReadingLineage, verifyOrderRenderItems, verifyRenderPromotionProofs } from '../factory-lineage.mjs'
import { resolveProductionEvidence, runLiveMultiGradeFactoryDryRun } from '../production-evidence-resolver.mjs'

const globalTarget = JSON.parse(readFileSync(new URL('../targets/knowledge-middle1.json', import.meta.url), 'utf8'))
const sourceId = '11111111-1111-4111-8111-111111111111'
const childId = '22222222-2222-4222-8222-222222222222'
const requestId = '33333333-3333-4333-8333-333333333333'
const now = '2026-10-07T12:00:00Z'
const h = c => c.repeat(64)
const signBody = (body, key) => ({ ...body, signature: sign(null, Buffer.from(hash(body)), key).toString('base64') })
const profile = () => {
  const axis = { level: 3, evidence: 'Synthetic level evidence' }
  return {
    lexical_level: axis, syntax_level: axis, abstraction_level: axis, information_density: axis,
    discourse_level: axis, inference_level: axis, background_knowledge: axis,
    age_appropriateness: { appropriate: true, evidence: 'Appropriate synthetic example' },
    exam_level: { exam: 'none', evidence: 'No exam target in fixture' }, overall_level: axis,
  }
}

function fixture({ grade = 'middle_1', child = childId, request = requestId, orderId = 'fixture-order', keys = null } = {}) {
  const target = grade === 'middle_1' ? globalTarget : { ...globalTarget, age_band: grade, reasoning_band: grade }
  const goldKey = keys?.goldKey ?? generateKeyPairSync('ed25519')
  const seedKey = keys?.seedKey ?? generateKeyPairSync('ed25519')
  const entry = (id, key) => ({ id, public_key: key.publicKey.export({ type: 'spki', format: 'pem' }), valid_from: '2026-10-01T00:00:00Z', valid_until: '2026-11-01T00:00:00Z' })
  const policy = { schema: 'frym-gold-s-operational-policy/1', revision: 'fixture-r1', gold_issuers: [entry('gold-issuer', goldKey)], seed_issuers: [entry('seed-issuer', seedKey)], gold_max_age_days: 30, seed_max_age_days: 7, revoked: { certificate_hashes: [], eligibility_hashes: [], issuer_ids: [] } }
  const source = { id: sourceId, source_id: 'frym-full:fixture', source: 'frym', source_url: 'https://example.org/f02', content: 'The original research claim is supported by clear evidence.', license: 'CC BY 4.0', license_class: 'cc_by', display_only: false, copyright_safe_in_kr: true, status: 'ready', csat_fit: null, updated_at: '2026-10-07T00:00:00Z' }
  const rights = { canonical_source: 'frym', canonical_url: source.source_url, original_author: 'Fixture Author', published_at: null, license: source.license, license_url: 'https://example.org/license', commercial_use: true, derivative_use: true, ai_processing: 'allowed', third_party_text: false, third_party_image: false, attribution_required: true, share_alike: false, original_work_id: null, discovered_via: null, checked_at: '2026-10-07T00:00:00Z', evidence: 'Official article license evidence' }
  const analysis = { source_profile: profile(), passage_profile: profile(), source_claims: [{ claim: 'Original research claim', quote: 'original research claim' }], discourse: [{ relation: 'Evidence supports claim', quote: 'supported by clear evidence' }], preserved_claims: [{ source_quote: 'original research claim', passage_quote: 'same original research claim' }], added_background: [], item_plan: [{ skill: 'R2', kind: 'question', item_reasoning_level: 3, item_difficulty: 3, difficulty_evidence: 'Explicit claim in the passage', prompt: 'What does the claim say?', expected_response: 'The claim stays the same.', evidence: ['same original research claim'], resource_evidence: [], time_limit_seconds: null }], parallel_pair: null }
  const passage = 'The same original research claim is explained to students with clear evidence.'
  const title = 'Synthetic research explanation'
  const key = targetKey(target)
  const exported = { adapted_from_id: source.id, source_text: source.content, reading: { source_revision: source.updated_at, source_hash: digest(source.content), target_key: key, target } }
  const draft = { title, text: passage, source_text: source.content, reading: { source_rights: rights, reading_analysis: analysis } }
  const reviews = REVIEWERS.map(reviewer => ({ ...reviewTemplate(draft, exported, reviewer), verdict: 'pass', dimensions: Object.fromEntries(REVIEW_DIMENSIONS.map(d => [d, true])), distortions: [], source_quote: 'The original research claim', passage_quote: 'The same original research claim', rationale: 'The synthetic claim and evidence are preserved without distortion.' }))
  const review = validateAgentReviews(draft, exported, reviews.map(row => [row]))
  assert.equal(review.ok, true)
  const childRow = { id: child, source_id: adaptationKey(sourceId, target), source: source.source, source_url: source.source_url, title, adapted_from_id: sourceId, status: 'queued', content: passage, updated_at: '2026-10-07T01:00:00Z', license: source.license, license_class: source.license_class, display_only: false, copyright_safe_in_kr: true, article_v_level: target.passage_v_level, composed_spec: { academic_reading: { version: READING_ENGINE_VERSION, state: 'agent_reviewed', target, target_key: key, analysis, content_review: review.certificate, provenance: { rights, source_id: sourceId, source_revision: source.updated_at, source_hash: digest(source.content) } } } }
  const passage_hash = hash(passage)
  const content_hash = hash({ source_id: sourceId, target_key: key, passage_hash })
  const rights_hash = sourceRightsHash(source)
  const certificate = signBody({ schema: 'frym-gold-s-certificate/1', certificate_id: `fixture-cert-${grade}`, issued_at: '2026-10-07T00:00:00Z', issuer_id: 'gold-issuer', curator_id: 'fixture-curator', owner_id: 'fixture-owner', source_id: sourceId, target_key: key, passage_hash, content_hash, rights_hash, benchmark_version: 'fixture-v1', review_evidence_hash: h('a'), decision_hash: h('b'), distribution_hash: h('c'), admission_receipt_hash: h('d'), benchmark_snapshot_hash: h('e'), review_hash: h('f') }, goldKey.privateKey)
  const eligibility = signBody({ schema: 'frym-seed-eligibility/1', eligibility_id: `fixture-eligibility-${grade}`, issued_at: '2026-10-07T00:00:00Z', issuer_id: 'seed-issuer', operations_id: 'fixture-operations', approver_id: 'fixture-approver', certificate_hash: hash(certificate), content_hash, rights_hash, seed_evidence_hash: h('1'), operations_hash: h('2'), approval_hash: h('3') }, seedKey.privateKey)
  const bundle = { certificate, eligibility }
  const gold = validateGoldSImport({ draft: { adapted_from_id: sourceId, text: passage, reading: { target } }, targetKey: key, source, bundle, policy, now })
  assert.equal(gold.ok, true)
  childRow.composed_spec.academic_reading.provenance.gold_s = gold.certificate
  const difficulty = { lexical: 3, syntax: 3, information_density: 3, discourse: 3, inference: 3, abstraction: 3, background_knowledge: 3 }
  const order = { schema: 'textbook-product-order/1', product_order_id: orderId, order_revision: 1, series_id: 'bridge-reading', edition_id: 'first', product_family: 'P03', product_variant: 'knowledge', target, grade_target: grade, reading_skill_targets: ['R2','R3','R4'], purposes: ['knowledge'], exam_alignment: [], domain_mix: { science: 100 }, genre_mix: { explanation: 100 }, source_policy_version: 'source-v1', source_policy_hash: h('3'), rights_policy_version: 'rights-v1', rights_policy_hash: h('4'), adaptation_policy_version: 'adapt-v1', adaptation_policy_hash: h('5'), item_types: ['main_point'], activity_types: [], passage_difficulty_profile: difficulty, item_difficulty_profile: { reasoning: 3 }, unit_spec_version: 'unit-v1', chapter_spec_version: 'chapter-v1', volume_spec_version: 'volume-v1', layout_profile: 'reading-v1', benchmark_contract_version: 'benchmark-v1', benchmark_contract_hash: h('6'), evidence_policy_version: 'evidence-v1', evidence_policy_hash: h('2'), trust_policy_version: 'trust-v1', trust_policy_hash: hash(policy), created_at: '2026-10-07T00:00:00Z', sealed_at: '2026-10-07T00:01:00Z' }
  const evidence = bindFactoryEvidence(order, { source_id: sourceId, source_route: 'ADAPT_REQUIRED', source_hash: hash(source.content), rights_hash, trust_policy_hash: hash(policy), evidence_policy_hash: order.evidence_policy_hash, adaptation_hash: hash(passage), benchmark_version: certificate.benchmark_version, benchmark_snapshot_hash: certificate.benchmark_snapshot_hash, certificate_hash: hash(certificate) })
  const promotionRequest = { request_id: request, article_id: child, order, order_hash: sealProductOrder(order).order_hash, target_key: key, evidence: evidence.evidence, evidence_hash: evidence.evidence_hash, bundle, policy }
  return { request: promotionRequest, child: childRow, source, goldKey, seedKey }
}

test('fresh synthetic order, review, signed Gold-S and seed evidence prepare one atomic RPC request', () => {
  const input = fixture()
  const result = prepareReadingPromotion({ ...input, now, requestedBy: 'fixture-operator' })
  assert.equal(result.ok, true, result.reason)
  assert.equal(result.rpc.product_order_id, 'fixture-order')
  assert.equal(result.rpc.certificate_hash, hash(input.request.bundle.certificate))
  assert.equal(result.rpc.child_source_id, input.child.source_id)
  assert.equal(Object.keys(result.rpc).length, 22)
})

test('stale, revoked, expired and mixed evidence fail closed before the RPC', () => {
  const input = fixture()
  const run = overrides => prepareReadingPromotion({ ...input, ...overrides, now, requestedBy: 'fixture-operator' })
  assert.equal(run({ source: { ...input.source, content: 'Changed original source.' } }).ok, false)
  assert.equal(run({ source: { ...input.source, license_class: 'restricted' } }).ok, false)
  assert.equal(run({ child: { ...input.child, display_only: true } }).reason, 'CHILD_RIGHTS_BLOCKED')
  assert.equal(run({ child: { ...input.child, copyright_safe_in_kr: false } }).reason, 'CHILD_RIGHTS_BLOCKED')
  assert.equal(run({ child: { ...input.child, content: 'Changed adaptation.' } }).ok, false)
  assert.equal(run({ child: { ...input.child, composed_spec: { academic_reading: { ...input.child.composed_spec.academic_reading, content_review: {} } } } }).reason, 'CONTENT_REVIEW_STALE')
  assert.equal(run({ request: { ...input.request, order: { ...input.request.order, order_revision: 2 } } }).reason, 'PRODUCT_ORDER_STALE')
  assert.equal(run({ request: { ...input.request, evidence: { ...input.request.evidence, benchmark_snapshot_hash: h('9') } } }).ok, false)
  assert.equal(run({ request: { ...input.request, bundle: { ...input.request.bundle, eligibility: { ...input.request.bundle.eligibility, certificate_hash: h('9') } } } }).ok, false)
  assert.equal(run({ request: { ...input.request, policy: { ...input.request.policy, revoked: { ...input.request.policy.revoked, certificate_hashes: [hash(input.request.bundle.certificate)] } } } }).ok, false)
  assert.equal(prepareReadingPromotion({ ...input, now: '2026-11-01T00:00:00Z', requestedBy: 'fixture-operator' }).ok, false)
  assert.equal(run({ child: { ...input.child, status: 'ready' } }).reason, 'QUEUED_READING_CHILD_REQUIRED')
  assert.equal(run({ child: { ...input.child, status: 'ready' }, allowReady: true }).ok, true)
})

test('an independent, current administrator approval binds the exact order and evidence packet', () => {
  const input = fixture()
  const { rpc } = prepareReadingPromotion({ ...input, now, requestedBy: 'fixture-operator' })
  const approval = { request_payload: rpc, approved_by: '44444444-4444-4444-8444-444444444444', expires_at: '2026-10-07T12:15:00Z', consumed_at: null }
  const authority = { trust_policy_hash: rpc.trust_policy_hash, benchmark_version: rpc.benchmark_version, benchmark_snapshot_hash: rpc.benchmark_snapshot_hash, revoked_certificate_hashes: [], revoked_eligibility_hashes: [], valid_until: '2026-10-08T00:00:00Z' }
  const currentOrder = { order_id: rpc.product_order_id, order_revision: rpc.order_revision, order_hash: rpc.order_hash }
  const assess = (packet = rpc, currentApproval = approval, currentAuthority = authority, at = now, order = currentOrder) => assessPromotionAuthorization({ rpc: packet, approval: currentApproval, authority: currentAuthority, currentOrder: order, now: at })
  assert.equal(assess().ok, true)
  assert.equal(assess({ ...rpc, product_order_id: 'other-order' }).ok, false)
  assert.equal(assess({ ...rpc, order_hash: h('9') }).ok, false)
  assert.equal(assess({ ...rpc, evidence_hash: h('9') }).ok, false)
  assert.equal(assess(rpc, { ...approval, consumed_at: now }).ok, false)
  assert.equal(assess(rpc, approval, authority, '2026-10-07T12:15:00Z').ok, false)
  assert.equal(assess(rpc, approval, { ...authority, trust_policy_hash: h('9') }).ok, false)
  assert.equal(assess(rpc, approval, { ...authority, benchmark_snapshot_hash: h('9') }).ok, false)
  assert.equal(assess(rpc, approval, { ...authority, revoked_certificate_hashes: [rpc.certificate_hash] }).ok, false)
  assert.equal(assess(rpc, approval, { ...authority, revoked_eligibility_hashes: [rpc.eligibility_hash] }).ok, false)
  assert.equal(assess(rpc, approval, null).ok, false)
  assert.equal(assess(rpc, approval, authority, now, { ...currentOrder, order_revision: 2 }).ok, false)
  assert.equal(assess(rpc, approval, authority, now, { ...currentOrder, order_hash: h('9') }).ok, false)
})

test('order render rechecks signed promotion proof against live source and current policy', async () => {
  const input = fixture()
  const prepared = prepareReadingPromotion({ ...input, now, requestedBy: 'fixture-operator' })
  assert.equal(prepared.ok, true)
  const child = { ...input.child, status: 'ready' }
  const audit = { request_id: input.request.request_id, requested_by: 'fixture-operator', request_hash: prepared.rpc.request_hash, evidence_hash: prepared.rpc.evidence_hash }
  const item = { ref_id: child.id, payload: { factory_lineage: { promotion_request_id: audit.request_id, promotion_request_hash: audit.request_hash, evidence_hash: audit.evidence_hash } } }
  const db = { from: table => ({ select: () => ({ eq: (_column, value) => ({ single: async () => ({ data: table === 'reading_promotion_audit' ? audit : value === child.id ? child : input.source, error: null }) }) }) }) }
  await verifyRenderPromotionProofs(db, [item], [input.request], input.request.policy, now)
  await assert.rejects(verifyRenderPromotionProofs(db, [item], [input.request], { ...input.request.policy, revision: 'changed' }, now), /RENDER_TRUST_POLICY_STALE/)
  const revoked = { ...input.request, policy: { ...input.request.policy, revoked: { ...input.request.policy.revoked, certificate_hashes: [hash(input.request.bundle.certificate)] } } }
  await assert.rejects(verifyRenderPromotionProofs(db, [item], [revoked], revoked.policy, now), /RENDER_PROMOTION_PROOF_STALE/)
})

test('the render script gate reloads item, authority, and proof before emitting lineage', async () => {
  const input = fixture()
  const rpc = prepareReadingPromotion({ ...input, now, requestedBy: 'fixture-operator' }).rpc
  const child = { ...input.child, status: 'ready' }
  const order = { order_id: rpc.product_order_id, order_revision: rpc.order_revision, order_hash: rpc.order_hash }
  const authority = { singleton: true, trust_policy_hash: rpc.trust_policy_hash, benchmark_version: rpc.benchmark_version, benchmark_snapshot_hash: rpc.benchmark_snapshot_hash, revoked_certificate_hashes: [], revoked_eligibility_hashes: [], valid_until: '2026-10-08T00:00:00Z' }
  const audit = { request_id: rpc.request_id, article_id: child.id, source_id: input.source.id, requested_by: 'fixture-operator', request_hash: rpc.request_hash, order_id: rpc.product_order_id, order_revision: rpc.order_revision, order_hash: rpc.order_hash, evidence_hash: rpc.evidence_hash, certificate_hash: rpc.certificate_hash, eligibility_hash: rpc.eligibility_hash, trust_policy_hash: rpc.trust_policy_hash, benchmark_version: rpc.benchmark_version, benchmark_snapshot_hash: rpc.benchmark_snapshot_hash, request_payload: rpc, result_status: 'ready', promoted_at: now }
  const lineage = currentReadingLineage({ article: child, parent: input.source, audit, order, authority, now })
  const item = { id: '55555555-5555-4555-8555-555555555555', ref_id: child.id, payload: { passage: child.content, factory_lineage: lineage }, answer_key: { answer: 1, explanation_ko: 'This explanation is supported by the article.' } }
  item.source_item_digest = reviewDigest(item.payload, item.answer_key)
  const printedItem = { ...item, answer_key: { ...item.answer_key } }
  const tables = { csat_dcp_items: [item], library_articles: [child, input.source], reading_promotion_audit: [audit], reading_product_order_revision: [order] }
  const db = { from: table => ({ select: () => ({
    in: (column, values) => Promise.resolve({ data: (tables[table] ?? []).filter(row => values.includes(row[column])), error: null }),
    eq: (column, value) => ({
      maybeSingle: () => Promise.resolve({ data: table === 'reading_promotion_authority' && value === true ? authority : null, error: null }),
      single: () => Promise.resolve({ data: (tables[table] ?? []).find(row => row[column] === value) ?? null, error: null }),
    }),
  }) }) }
  const checked = await verifyOrderRenderItems(db, [printedItem], order.order_id, [input.request], input.request.policy, now)
  assert.equal(checked.order.order_hash, rpc.order_hash)
  assert.equal(checked.itemEvidence[0].lineage.evidence_hash, rpc.evidence_hash)
  const section = { grade: 'single', orderId: order.order_id, printedItems: [printedItem], requests: [input.request] }
  const live = await resolveProductionEvidence(db, { sections: [section], policy: input.request.policy, now })
  assert.equal(live.evidence_level, 'live_revalidated_non_atomic')
  assert.equal(live.production_verified, false)
  assert.equal(live.sections[0].item_evidence[0].lineage.evidence_hash, rpc.evidence_hash)
  let itemReads = 0
  const changingDb = { from(table) {
    if (table === 'csat_dcp_items' && ++itemReads === 2)
      item.answer_key = { ...item.answer_key, explanation_ko: 'Changed between grade sweeps.' }
    return db.from(table)
  } }
  await assert.rejects(resolveProductionEvidence(changingDb, { sections: [section], policy: input.request.policy, now }),
    /RENDER_ITEM_OR_EXPLANATION_STALE/)
  item.answer_key = printedItem.answer_key
  item.answer_key = { ...item.answer_key, explanation_ko: 'Changed after review.' }
  await assert.rejects(verifyOrderRenderItems(db, [printedItem], order.order_id, [input.request], input.request.policy, now), /RENDER_ITEM_OR_EXPLANATION_STALE/)
  item.answer_key = printedItem.answer_key
  authority.revoked_certificate_hashes.push(rpc.certificate_hash)
  await assert.rejects(verifyOrderRenderItems(db, [printedItem], order.order_id, [input.request], input.request.policy, now), /FACTORY_LINEAGE_MISSING/)
})

test('one live resolver revalidates both grade sections and blocks stale members', async () => {
  const first = fixture()
  const second = fixture({ grade: 'middle_2', child: '44444444-4444-4444-8444-444444444444',
    request: '55555555-5555-4555-8555-555555555555', orderId: 'fixture-order-2',
    keys: { goldKey: first.goldKey, seedKey: first.seedKey } })
  const inputs = [first, second]
  const prepared = inputs.map(input => prepareReadingPromotion({ ...input, now, requestedBy: 'fixture-operator' }))
  assert(prepared.every(value => value.ok), prepared.map(value => value.reason).join(', '))
  const authority = { singleton: true, trust_policy_hash: prepared[0].rpc.trust_policy_hash,
    benchmark_version: prepared[0].rpc.benchmark_version, benchmark_snapshot_hash: prepared[0].rpc.benchmark_snapshot_hash,
    revoked_certificate_hashes: [], revoked_eligibility_hashes: [], valid_until: '2026-10-08T00:00:00Z' }
  const tables = { csat_dcp_items: [], library_articles: [first.source], reading_promotion_audit: [],
    reading_product_order_revision: [] }
  const sections = inputs.map((input, index) => {
    const rpc = prepared[index].rpc
    const child = { ...input.child, status: 'ready' }
    const order = { order_id: rpc.product_order_id, order_revision: rpc.order_revision, order_hash: rpc.order_hash }
    const audit = { request_id: rpc.request_id, article_id: child.id, source_id: input.source.id,
      requested_by: 'fixture-operator', request_hash: rpc.request_hash, order_id: rpc.product_order_id,
      order_revision: rpc.order_revision, order_hash: rpc.order_hash, evidence_hash: rpc.evidence_hash,
      certificate_hash: rpc.certificate_hash, eligibility_hash: rpc.eligibility_hash,
      trust_policy_hash: rpc.trust_policy_hash, benchmark_version: rpc.benchmark_version,
      benchmark_snapshot_hash: rpc.benchmark_snapshot_hash, request_payload: rpc, result_status: 'ready', promoted_at: now }
    const lineage = currentReadingLineage({ article: child, parent: first.source, audit, order, authority, now })
    const item = { id: `66666666-6666-4666-8666-66666666666${index}`, ref_id: child.id,
      payload: { passage: child.content, factory_lineage: lineage }, answer_key: { answer: index + 1 } }
    item.source_item_digest = reviewDigest(item.payload, item.answer_key)
    tables.csat_dcp_items.push(item)
    tables.library_articles.push(child)
    tables.reading_promotion_audit.push(audit)
    tables.reading_product_order_revision.push(order)
    return { grade: input.request.order.grade_target, orderId: order.order_id,
      printedItems: [{ ...item }], requests: [input.request] }
  })
  const group = { schema: 'textbook-product-order-group/1', group_id: 'fixture-m1-m2', group_revision: 1,
    grade_scope: { mode: 'grade_range', grades: ['middle_1', 'middle_2'] },
    delivery_mode: 'shared_passage_grade_specific_items',
    orders: inputs.map(input => ({ grade: input.request.order.grade_target, order: input.request.order })) }
  const evidence = { schema: 'textbook-multi-grade-evidence/1', group_id: group.group_id,
    group_revision: group.group_revision, group_hash: sealMultiGradeProductOrder(group).group_hash,
    source_id: first.source.id, source_hash: createHash('sha256').update(first.source.content).digest('hex'),
    rights_hash: sourceRightsHash(first.source), variants: sections.map((section, index) => ({
      grade: section.grade, product_order_id: section.orderId, order_revision: 1,
      order_hash: prepared[index].rpc.order_hash, passage_hash: section.printedItems[0].payload.factory_lineage.adaptation_hash,
      adaptation_hash: inputs[index].request.evidence.adaptation_hash,
      item_set_hash: hash(section.printedItems.map(item => [item.id, item.source_item_digest])),
      activity_hash: null, benchmark_version: prepared[index].rpc.benchmark_version,
      benchmark_snapshot_hash: prepared[index].rpc.benchmark_snapshot_hash,
      gold_s_candidate_hash: null, unit_set_hash: h(index ? '1' : '2'), analysis_hash: h(index ? '3' : '4'),
    })) }
  const db = { from: table => ({ select: () => ({
    in: (column, values) => Promise.resolve({ data: (tables[table] ?? []).filter(row => values.includes(row[column])), error: null }),
    eq: (column, value) => ({
      maybeSingle: () => Promise.resolve({ data: table === 'reading_promotion_authority' && value === true ? authority : null, error: null }),
      single: () => Promise.resolve({ data: (tables[table] ?? []).find(row => row[column] === value) ?? null, error: null }),
    }),
  }) }) }
  const options = { sections, policy: first.request.policy, now, group, evidence }
  const live = await resolveProductionEvidence(db, options)
  assert.equal(live.sections.length, 2)
  assert.equal(live.group_hash, evidence.group_hash)
  assert.equal(live.production_verified, false)
  const rawSha = value => createHash('sha256').update(value).digest('hex')
  const stages = sections.map((section, index) => {
    const sourceItem = section.printedItems[0]
    const { source_item_digest: itemDigest, ...item } = sourceItem
    const text = `Synthetic explanation for ${section.grade}.`
    const unit = { unit_id: `unit-${index}`, html: `<section class="unit"><p>${item.payload.passage}</p></section>` }
    const analysis = { grade: section.grade }
    evidence.variants[index].unit_set_hash = hash([[unit.unit_id, rawSha(unit.html)]])
    evidence.variants[index].analysis_hash = hash(analysis)
    return { grade: section.grade, article_id: item.ref_id, passage: item.payload.passage,
      lineage: item.payload.factory_lineage, items: [item],
      explanations: [{ item_id: item.id, text, item_digest: itemDigest, factory_lineage: item.payload.factory_lineage }],
      reviews: [{ item_id: item.id, decision: 'approved', item_digest: itemDigest,
        explanation_hash: rawSha(text), factory_lineage: item.payload.factory_lineage }],
      activities: [], analysis, unit }
  })
  const render = { colophon: { title: 'Synthetic live multi-grade', ladder: 'M1-M2', edition: 'fixture',
    issued: '2026-10-07', sourcePolicy: 'fixture', review: 'fixture' },
    step: null, schoolBand: null, vLevel: 5, totalSteps: 7, totalMinutes: 20,
    autoPassed: 0, autoTotal: 0, passageChip: 'fixture', answerBias: null,
    proof: { passages: 2, defective: 0 } }
  const liveRender = await runLiveMultiGradeFactoryDryRun(db, { group, evidence, stages, render,
    requestsByGrade: { middle_1: [first.request], middle_2: [second.request] },
    policy: first.request.policy, now })
  assert.match(liveRender.html, /LIVE REVALIDATED NON-ATOMIC DRY RUN/)
  assert.equal(liveRender.manifest.evidence_level, 'live_revalidated_non_atomic')
  assert.equal(liveRender.manifest.production_verified, false)
  assert.equal(liveRender.manifest.production_evidence_snapshot.sections.length, 2)
  assert.equal(liveRender.manifest.html_sha256, rawSha(liveRender.html))
  let authorityReads = 0
  const changingAuthorityDb = { from(table) {
    if (table === 'csat_dcp_items' && ++authorityReads === 3)
      authority.valid_until = '2026-10-09T00:00:00Z'
    return db.from(table)
  } }
  await assert.rejects(resolveProductionEvidence(changingAuthorityDb, options), /PRODUCTION_EVIDENCE_CHANGED_DURING_RESOLVE/)
  authority.valid_until = '2026-10-08T00:00:00Z'
  const originalSourceContent = first.source.content
  let readCount = 0
  const changingSourceDb = { from(table) {
    if (table === 'csat_dcp_items' && ++readCount === 3) tables.library_articles[0].content += ' Changed after first sweep.'
    return db.from(table)
  } }
  await assert.rejects(resolveProductionEvidence(changingSourceDb, options), /FACTORY_LINEAGE_MISSING/)
  tables.library_articles[0].content = originalSourceContent
  tables.csat_dcp_items[1].answer_key = { answer: 3 }
  await assert.rejects(resolveProductionEvidence(db, options), /RENDER_ITEM_OR_EXPLANATION_STALE/)
  tables.csat_dcp_items[1].answer_key = sections[1].printedItems[0].answer_key
  authority.revoked_certificate_hashes.push(prepared[1].rpc.certificate_hash)
  await assert.rejects(resolveProductionEvidence(db, options), /FACTORY_LINEAGE_MISSING/)
  authority.revoked_certificate_hashes.length = 0
  tables.library_articles[2].status = 'queued'
  await assert.rejects(resolveProductionEvidence(db, options), /FACTORY_LINEAGE_MISSING/)
  tables.library_articles[2].status = 'ready'
  tables.library_articles[2].display_only = true
  await assert.rejects(resolveProductionEvidence(db, options), /FACTORY_LINEAGE_MISSING/)
  tables.library_articles[2].display_only = false
  tables.library_articles[0].display_only = true
  await assert.rejects(resolveProductionEvidence(db, options), /FACTORY_LINEAGE_MISSING/)
  tables.library_articles[0].display_only = false
  tables.reading_product_order_revision[1].order_revision = 2
  await assert.rejects(resolveProductionEvidence(db, options), /FACTORY_LINEAGE_MISSING/)
  tables.reading_product_order_revision[1].order_revision = 1
  authority.valid_until = now
  await assert.rejects(resolveProductionEvidence(db, options), /FACTORY_LINEAGE_MISSING/)
  authority.valid_until = '2026-10-08T00:00:00Z'
  authority.valid_until = '2026-12-01T00:00:00Z'
  await assert.rejects(resolveProductionEvidence(db, { ...options, now: '2026-11-09T00:00:00Z' }),
    /RENDER_PROMOTION_PROOF_STALE/)
  authority.valid_until = '2026-10-08T00:00:00Z'
  const mixed = structuredClone(evidence)
  mixed.variants[1].order_hash = mixed.variants[0].order_hash
  await assert.rejects(resolveProductionEvidence(db, { ...options, evidence: mixed }), /MULTI_GRADE_CHILD_ORDER_STALE_OR_MIXED/)
})
