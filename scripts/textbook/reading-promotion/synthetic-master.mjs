// scripts/textbook/reading-promotion/synthetic-master.mjs
// Synthetic trust roots and in-memory database only; no real provider or DB calls.
import assert from 'node:assert/strict'
import globalTarget from '../targets/knowledge-middle1.json' with { type: 'json' }
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { bindFactoryEvidence, planFactoryImpact, routeFactorySource, sealProductOrder } from '@vocaflow/library-pipeline/factory-order'
import { buildProductOrderFromBrief, planProductBrief } from '@vocaflow/library-pipeline/product-planning'
import { PRODUCT_FAMILIES } from '@vocaflow/library-pipeline/academic-reading'
import { reviewDigest } from '@vocaflow/library-pipeline'
import { sealMultiGradeProductOrder } from '@vocaflow/library-pipeline/multi-grade-order'
import { hash } from '../frym-benchmark/benchmark.mjs'
import { sourceRightsHash, validateGoldSImport } from '../frym-benchmark/gold-s-import-gate.mjs'
import { adaptationKey, canonical, digest, targetKey } from '../academic-reading-contract.mjs'
import { READING_ENGINE_VERSION } from '@vocaflow/library-pipeline/academic-reading'
import { REVIEWERS, REVIEW_DIMENSIONS, reviewTemplate, validateAgentReviews } from '../academic-reading-review.mjs'
import { prepareReadingPromotion } from './preflight.mjs'
import { executeReadingPromotion } from './run-core.mjs'
import { assessPromotionAuthorization } from './authorization.mjs'
import { currentReadingLineage, verifyOrderRenderItems, verifyRenderPromotionProofs } from '../factory-lineage.mjs'
import { resolveProductionEvidence, runLiveMultiGradeFactoryDryRun } from '../production-evidence-resolver.mjs'
import { approveTrustedProductionOutput, captureTrustedProductionSnapshot, registerTrustedProductionGroup,
  runAtomicMultiGradeFactoryDryRun, publishAtomicProductionArtifact,
  serveAtomicProductionArtifact } from '../atomic-production-snapshot.mjs'

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

const syntheticBrief = grades => ({ schema: 'textbook-product-brief/1',
  grade_scope: { mode: grades.length === 1 ? 'single_grade' : 'grade_range', grades },
  purpose: 'knowledge_reading', domain_weights: { science: 1 }, genre_weights: { explanation: 1 },
  duration_days: 3, units_per_chapter: 2, difficulty: { start: 3, end: 4 },
  passage_words: { start: 180, end: 220 }, source_strategy: 'adaptation_first' })

function fixture({ grade = 'middle_1', child = childId, request = requestId, orderId = 'fixture-order', keys = null,
  brief = null } = {}) {
  const baseTarget = grade === 'middle_1' ? globalTarget : { ...globalTarget, age_band: grade, reasoning_band: grade }
  const target = brief ? { ...baseTarget, skills: PRODUCT_FAMILIES.P03.skills } : baseTarget
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
  let order = { schema: 'textbook-product-order/1', product_order_id: orderId, order_revision: 1, series_id: 'bridge-reading', edition_id: 'first', product_family: 'P03', product_variant: 'knowledge', target, grade_target: grade, reading_skill_targets: ['R2','R3','R4'], purposes: ['knowledge'], exam_alignment: [], domain_mix: { science: 100 }, genre_mix: { explanation: 100 }, source_policy_version: 'source-v1', source_policy_hash: h('3'), rights_policy_version: 'rights-v1', rights_policy_hash: h('4'), adaptation_policy_version: 'adapt-v1', adaptation_policy_hash: h('5'), item_types: ['main_point'], activity_types: [], passage_difficulty_profile: difficulty, item_difficulty_profile: { reasoning: 3 }, unit_spec_version: 'unit-v1', chapter_spec_version: 'chapter-v1', volume_spec_version: 'volume-v1', layout_profile: 'reading-v1', benchmark_contract_version: 'benchmark-v1', benchmark_contract_hash: h('6'), evidence_policy_version: 'evidence-v1', evidence_policy_hash: h('2'), trust_policy_version: 'trust-v1', trust_policy_hash: hash(policy), created_at: '2026-10-07T00:00:00Z', sealed_at: '2026-10-07T00:01:00Z' }
  if (brief) order = buildProductOrderFromBrief(brief, grade, order).order
  const evidence = bindFactoryEvidence(order, { source_id: sourceId, source_route: 'ADAPT_REQUIRED', source_hash: hash(source.content), rights_hash, trust_policy_hash: hash(policy), evidence_policy_hash: order.evidence_policy_hash, adaptation_hash: hash(passage), benchmark_version: certificate.benchmark_version, benchmark_snapshot_hash: certificate.benchmark_snapshot_hash, certificate_hash: hash(certificate) })
  const promotionRequest = { request_id: request, article_id: child, order, order_hash: sealProductOrder(order).order_hash, target_key: key, evidence: evidence.evidence, evidence_hash: evidence.evidence_hash, bundle, policy }
  return { request: promotionRequest, child: childRow, source, goldKey, seedKey }
}

async function promoteSyntheticFixture(input) {
  const prepared = prepareReadingPromotion({ ...input, now, requestedBy: 'fixture-operator' })
  assert.equal(prepared.ok, true, prepared.reason)
  const rpc = prepared.rpc
  const child = { ...input.child }
  const authority = { singleton: true, trust_policy_hash: rpc.trust_policy_hash,
    benchmark_version: rpc.benchmark_version, benchmark_snapshot_hash: rpc.benchmark_snapshot_hash,
    revoked_certificate_hashes: [], revoked_eligibility_hashes: [], valid_until: '2026-10-08T00:00:00Z' }
  const order = { order_id: rpc.product_order_id, order_revision: rpc.order_revision,
    order_hash: rpc.order_hash }
  const audit = { request_id: rpc.request_id, article_id: child.id, source_id: input.source.id,
    requested_by: 'fixture-operator', request_hash: rpc.request_hash, order_id: rpc.product_order_id,
    order_revision: rpc.order_revision, order_hash: rpc.order_hash, evidence_hash: rpc.evidence_hash,
    certificate_hash: rpc.certificate_hash, eligibility_hash: rpc.eligibility_hash,
    trust_policy_hash: rpc.trust_policy_hash, benchmark_version: rpc.benchmark_version,
    benchmark_snapshot_hash: rpc.benchmark_snapshot_hash, request_payload: rpc,
    result_status: 'ready', promoted_at: now }
  const approval = { request_payload: rpc, approved_by: '44444444-4444-4444-8444-444444444444',
    expires_at: '2026-10-07T12:15:00Z', consumed_at: null }
  let promotionAudit = null
  const db = {
    from: table => ({ select: () => ({ eq: (_column, value) => {
      const row = table === 'library_articles' ? [child, input.source].find(item => item.id === value)
        : table === 'reading_promotion_audit' ? promotionAudit
          : table === 'reading_promotion_approval' ? approval
            : table === 'reading_promotion_authority' ? authority
              : table === 'reading_product_order_revision' ? order : null
      return { single: async () => ({ data: row, error: null }),
        maybeSingle: async () => ({ data: row, error: null }) }
    } }) }),
    rpc: async (name, params) => {
      assert.equal(name, 'promote_reading_adaptation')
      assert.equal(params.p_request.evidence_hash, rpc.evidence_hash)
      if (child.status === 'ready') return { data: { status: 'ready', replayed: true,
        evidence_current: true, article_id: child.id, request_id: rpc.request_id } }
      child.status = 'ready'
      promotionAudit = audit
      return { data: { status: 'ready', replayed: false, evidence_current: true,
        article_id: child.id, request_id: rpc.request_id } }
    },
  }
  const events = []
  const promoted = await executeReadingPromotion({ db, request: input.request,
    currentPolicy: () => input.request.policy, now, requestedBy: 'fixture-operator', commit: true,
    onEvent: event => events.push(event) })
  assert.equal(promoted.status, 'ready')
  assert.equal(child.status, 'ready')
  assert.equal(promotionAudit, audit)
  assert.deepEqual(events, ['rpc_start', 'rpc_ready'])
  const replay = await executeReadingPromotion({ db, request: input.request,
    currentPolicy: () => input.request.policy, now, requestedBy: 'fixture-operator', commit: true })
  assert.equal(replay.replayed, true)
  return { rpc, child, authority, order, audit }
}

async function exerciseMultiGrade(withOutput = false) {
  const brief = syntheticBrief(['middle_1', 'middle_2'])
  const planned = planProductBrief(brief)
  assert.equal(planned.plan.units.length, 3)
  const first = fixture({ brief })
  const second = fixture({ grade: 'middle_2', child: '44444444-4444-4444-8444-444444444444',
    request: '55555555-5555-4555-8555-555555555555', orderId: 'fixture-order-2',
    keys: { goldKey: first.goldKey, seedKey: first.seedKey }, brief })
  assert.equal(first.request.order.planning_hash, planned.plan_hash)
  assert.equal(second.request.order.planning_hash, planned.plan_hash)
  const inputs = [first, second]
  const promoted = await Promise.all(inputs.map(promoteSyntheticFixture))
  const prepared = promoted.map(value => ({ rpc: value.rpc }))
  const authority = promoted[0].authority
  const tables = { csat_dcp_items: [], library_articles: [first.source], reading_promotion_audit: [],
    reading_product_order_revision: [] }
  const sections = inputs.map((input, index) => {
    const rpc = prepared[index].rpc
    const { child, order, audit } = promoted[index]
    const lineage = currentReadingLineage({ article: child, parent: first.source, audit, order, authority, now })
    const item = { id: `66666666-6666-4666-8666-66666666666${index}`, ref_id: child.id,
      payload: { passage: child.content, factory_lineage: lineage },
      answer_key: { answer: index + 1, explanation_ko: `Synthetic explanation for ${input.request.order.grade_target}.` } }
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
  const approvedHtml = '<!-- ATOMIC SNAPSHOT DRY RUN; UNPUBLISHED -->' +
    liveRender.html.slice('<!-- LIVE REVALIDATED NON-ATOMIC DRY RUN; NOT APPROVED FOR PUBLICATION -->'.length)
  const atomicEvidence = { schema: 'reading-production-evidence/1', group_id: group.group_id,
    group_revision: group.group_revision, group_document: group, evidence_document: evidence,
    approved_output_hash: rawSha(approvedHtml),
    sections: sections.map(section => {
      const sourceItem = section.printedItems[0]
      const rpc = prepared.find(row => row.rpc.product_order_id === section.orderId).rpc
      return { grade: section.grade, order_id: section.orderId, order_revision: 1,
        order_hash: rpc.order_hash, article_id: sourceItem.ref_id,
        article_content: sourceItem.payload.passage, source_id: first.source.id,
        source_content_hash: rawSha(first.source.content), source_evidence: first.source,
        gold_s: inputs.find(input => input.child.id === sourceItem.ref_id)
          .child.composed_spec.academic_reading.provenance.gold_s,
        audit_id: rpc.request_id,
        certificate_hash: rpc.certificate_hash, eligibility_hash: rpc.eligibility_hash,
        benchmark_snapshot_hash: rpc.benchmark_snapshot_hash,
        items: [{ id: sourceItem.id, ref_id: sourceItem.ref_id,
          payload: sourceItem.payload, answer_key: sourceItem.answer_key, state: null,
          reviews: ['setter', 'analyst', 'tutor'].map(persona => ({ persona,
            verdict: 'pass', reviewed_digest: sourceItem.source_item_digest })) }] }
    }) }
  const captured = { snapshot_id: '77777777-7777-4777-8777-777777777777',
    snapshot_hash: h('9'), captured_at: now, expires_at: '2026-10-08T00:00:00Z', evidence: atomicEvidence }
  const atomicDb = { rpc: async (name, params) => name === 'capture_reading_production_snapshot'
    ? { data: captured, error: null }
    : { data: { status: 'rendered_unpublished', snapshot_id: captured.snapshot_id,
      snapshot_hash: captured.snapshot_hash, output_hash: params.p_output_hash }, error: null } }
  const registration = await registerTrustedProductionGroup({ rpc: async (name, params) => {
    assert.equal(name, 'register_reading_production_group')
    assert.equal(params.p_group_document.group_id, group.group_id)
    return { data: { group_id: group.group_id, group_revision: group.group_revision } }
  } }, { group, evidence, sections: sections.map(section => ({ grade: section.grade,
    order_id: section.orderId, article_id: section.printedItems[0].ref_id,
    audit_id: section.printedItems[0].payload.factory_lineage.promotion_request_id,
    item_ids: section.printedItems.map(item => item.id) })) })
  assert.equal(registration.group_id, group.group_id)
  const unsupportedGroup = structuredClone(group)
  unsupportedGroup.orders[0].order.product_family = 'P13'
  await assert.rejects(registerTrustedProductionGroup({ rpc: async () => {
    throw Error('specialized group must not reach registration RPC')
  } }, { group: unsupportedGroup, evidence, sections: [] }),
  /ATOMIC_SPECIALIZED_PRODUCTION_REVALIDATION_PENDING/)
  const unsupportedCapture = structuredClone(captured)
  unsupportedCapture.evidence.group_document.orders[0].order.product_family = 'P14'
  await assert.rejects(captureTrustedProductionSnapshot({ rpc: async () => ({ data: unsupportedCapture }) },
    group.group_id), /ATOMIC_SPECIALIZED_PRODUCTION_REVALIDATION_PENDING/)
  const approval = await approveTrustedProductionOutput({ rpc: async (name, params) => {
    assert.equal(name, 'approve_reading_production_output')
    assert.equal(params.p_snapshot_id, captured.snapshot_id)
    assert.equal(params.p_snapshot_hash, captured.snapshot_hash)
    return { data: { approved_output_hash: params.p_output_hash, approved_evidence_hash: h('8') } }
  } }, { snapshotId: captured.snapshot_id, snapshotHash: captured.snapshot_hash, html: approvedHtml })
  assert.equal(approval.approved_output_hash, atomicEvidence.approved_output_hash)
  const atomic = await runAtomicMultiGradeFactoryDryRun(atomicDb, { groupId: group.group_id, stages, render })
  assert.match(atomic.html, /ATOMIC SNAPSHOT DRY RUN; UNPUBLISHED/)
  assert.equal(atomic.manifest.evidence_level, 'atomic_snapshot_unpublished')
  assert.equal(atomic.manifest.production_verified, false)
  assert.equal(atomic.manifest.group_contract_source, 'db_registered')
  const singleGroup = { ...group, group_id: 'fixture-m1-only',
    grade_scope: { mode: 'single_grade', grades: ['middle_1'] },
    delivery_mode: 'single_grade', orders: [group.orders[0]] }
  const singleEvidence = { ...evidence, group_id: singleGroup.group_id,
    group_hash: sealMultiGradeProductOrder(singleGroup).group_hash, variants: [evidence.variants[0]] }
  const singleSnapshot = { ...captured,
    snapshot_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', snapshot_hash: h('e'),
    evidence: { ...atomicEvidence,
    group_id: singleGroup.group_id, group_document: singleGroup,
    evidence_document: singleEvidence, approved_output_hash: null,
    sections: [atomicEvidence.sections[0]] } }
  const singleDb = { rpc: async (name, params) => name === 'capture_reading_production_snapshot'
    ? { data: singleSnapshot } : { data: { status: 'rendered_unpublished',
      snapshot_id: singleSnapshot.snapshot_id, snapshot_hash: singleSnapshot.snapshot_hash,
      output_hash: params.p_output_hash } } }
  const singlePreview = await runAtomicMultiGradeFactoryDryRun(singleDb, { groupId: singleGroup.group_id,
    stages: [stages[0]], render: { ...render, proof: { passages: 1, defective: 0 } } })
  singleSnapshot.evidence.approved_output_hash = rawSha(singlePreview.html)
  const single = await runAtomicMultiGradeFactoryDryRun(singleDb, { groupId: singleGroup.group_id,
    stages: [stages[0]], render: { ...render, proof: { passages: 1, defective: 0 } } })
  assert.equal(single.manifest.evidence_level, 'atomic_snapshot_unpublished')
  const publishedSingle = await publishAtomicProductionArtifact({ rpc: async (name, params) => {
    assert.equal(name, 'publish_reading_production_artifact')
    assert.equal(params.p_snapshot_id, singleSnapshot.snapshot_id)
    return { data: { status: 'published_current', snapshot_id: params.p_snapshot_id,
      snapshot_hash: params.p_snapshot_hash, output_hash: rawSha(params.p_html) } }
  } }, single)
  assert.equal(publishedSingle.snapshot_id, singleSnapshot.snapshot_id)
  const servedSingle = await serveAtomicProductionArtifact({ rpc: async (name, params) => {
    assert.equal(name, 'serve_reading_production_artifact')
    assert.equal(params.p_snapshot_id, singleSnapshot.snapshot_id)
    return { data: { snapshot_id: singleSnapshot.snapshot_id,
      snapshot_hash: singleSnapshot.snapshot_hash,
      output_hash: rawSha(single.html), html: single.html } }
  } }, singleSnapshot.snapshot_id)
  assert.equal(servedSingle.html, single.html)
  const published = await publishAtomicProductionArtifact({ rpc: async (name, params) => {
    assert.equal(name, 'publish_reading_production_artifact')
    return { data: { status: 'published_current', snapshot_id: params.p_snapshot_id,
      snapshot_hash: params.p_snapshot_hash, output_hash: rawSha(params.p_html) } }
  } }, atomic)
  assert.equal(published.production_verified, false)
  const served = await serveAtomicProductionArtifact({ rpc: async () => ({ data: {
    snapshot_id: captured.snapshot_id, snapshot_hash: captured.snapshot_hash,
    output_hash: rawSha(atomic.html), html: atomic.html } }) }, captured.snapshot_id)
  assert.equal(served.html, atomic.html)
  await assert.rejects(publishAtomicProductionArtifact(atomicDb,
    { ...atomic, html: atomic.html + ' changed' }), /PUBLICATION_INPUT_STALE/)
  await assert.rejects(serveAtomicProductionArtifact({ rpc: async () => ({ error: Error('rights revoked') }) },
    captured.snapshot_id), /SERVE_REJECTED/)
  await assert.rejects(runAtomicMultiGradeFactoryDryRun(atomicDb,
    { groupId: group.group_id, group, stages, render }), /CALLER_EVIDENCE_FORBIDDEN/)
  const mixedStage = structuredClone(stages)
  mixedStage[1].items[0].answer_key.answer = 99
  await assert.rejects(runAtomicMultiGradeFactoryDryRun(atomicDb,
    { groupId: group.group_id, stages: mixedStage, render }), /STAGE_STALE_OR_MIXED/)
  const inventedExplanation = structuredClone(stages)
  inventedExplanation[1].explanations[0].text = 'Invented after DB capture.'
  inventedExplanation[1].reviews[0].explanation_hash = rawSha('Invented after DB capture.')
  await assert.rejects(runAtomicMultiGradeFactoryDryRun(atomicDb,
    { groupId: group.group_id, stages: inventedExplanation, render }), /STAGE_STALE_OR_MIXED/)
  const alteredUnit = structuredClone(stages)
  alteredUnit[0].unit.html = '<section class="unit">A different visible passage.</section>'
  await assert.rejects(runAtomicMultiGradeFactoryDryRun(atomicDb,
    { groupId: group.group_id, stages: alteredUnit, render }), /UNIT_SET_STALE/)
  const changedSnapshot = structuredClone(captured)
  changedSnapshot.evidence.sections[1].items[0].answer_key.answer = 99
  await assert.rejects(captureTrustedProductionSnapshot({ rpc: async () => ({ data: changedSnapshot }) },
    group.group_id), /GRADE_EVIDENCE_MIXED/)
  const blockedItem = structuredClone(captured)
  blockedItem.evidence.sections[0].items[0].state = { status: 'blocked' }
  await assert.rejects(captureTrustedProductionSnapshot({ rpc: async () => ({ data: blockedItem }) },
    group.group_id), /GRADE_EVIDENCE_MIXED/)
  const staleReview = structuredClone(captured)
  staleReview.evidence.sections[0].items[0].reviews[0].reviewed_digest = h('1')
  await assert.rejects(captureTrustedProductionSnapshot({ rpc: async () => ({ data: staleReview }) },
    group.group_id), /GRADE_EVIDENCE_MIXED/)
  await assert.rejects(runAtomicMultiGradeFactoryDryRun({ rpc: async (name) => name ===
    'capture_reading_production_snapshot' ? { data: captured } : { error: Error('rights revoked') } },
    { groupId: group.group_id, stages, render }), /FINALIZATION_FAILED/)
  await assert.rejects(runAtomicMultiGradeFactoryDryRun({ rpc: async (name) => name ===
    'capture_reading_production_snapshot' ? { data: captured } : { data: { status: 'rendered_unpublished',
      snapshot_id: captured.snapshot_id, snapshot_hash: captured.snapshot_hash, output_hash: h('0') } } },
    { groupId: group.group_id, stages, render }), /FINALIZATION_FAILED/)
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
  const receipt = { synthetic_fixture: true, non_production: true, grade_scope: group.grade_scope,
    child_ids: promoted.map(value => value.child.id), request_ids: promoted.map(value => value.rpc.request_id),
    item_ids: sections.flatMap(section => section.printedItems.map(item => item.id)),
    order_hashes: prepared.map(value => value.rpc.order_hash), snapshot_ids: [captured.snapshot_id],
    snapshot_hashes: [captured.snapshot_hash], output_hash: rawSha(atomic.html),
    published_status: published.status }
  return withOutput ? { receipt, output: atomic } : receipt
}

async function exerciseSingleGrade(grade, withFixture = false) {
  const brief = syntheticBrief([grade])
  const identities = grade === 'middle_1'
    ? { child: '66666666-6666-4666-8666-666666666666', request: '77777777-7777-4777-8777-777777777777' }
    : { child: '88888888-8888-4888-8888-888888888889', request: '99999999-9999-4999-8999-999999999998' }
  const input = fixture({ grade, orderId: `fixture-${grade}`, brief, ...identities })
  assert.equal(input.request.order.planning_hash, planProductBrief(brief).plan_hash)
  const route = routeFactorySource({
    rights: input.child.composed_spec.academic_reading.provenance.rights,
    original_fit: 'requires_adaptation', age_suitable: false,
    source_quality: 'pass', target: input.request.order.target,
  })
  assert.equal(route.route, 'ADAPT_REQUIRED')
  const { rpc, child, authority, order, audit } = await promoteSyntheticFixture(input)
  const lineage = currentReadingLineage({ article: child, parent: input.source, audit, order, authority, now })
  const item = { id: grade === 'middle_1'
    ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', ref_id: child.id,
    payload: { passage: child.content, factory_lineage: lineage },
    answer_key: { answer: 2, explanation_ko: `Synthetic ${grade} explanation.` } }
  const itemDigest = reviewDigest(item.payload, item.answer_key)
  const explanation = `Synthetic ${grade} explanation.`
  const rawSha = value => createHash('sha256').update(value).digest('hex')
  const unit = { unit_id: `${grade}-unit`, html: `<section class="unit"><p>${child.content}</p></section>` }
  const analysis = { grade }
  const group = { schema: 'textbook-product-order-group/1', group_id: `fixture-${grade}-group`, group_revision: 1,
    grade_scope: { mode: 'single_grade', grades: [grade] }, delivery_mode: 'single_grade',
    orders: [{ grade, order: input.request.order }] }
  const evidence = { schema: 'textbook-multi-grade-evidence/1', group_id: group.group_id,
    group_revision: group.group_revision, group_hash: sealMultiGradeProductOrder(group).group_hash,
    source_id: input.source.id, source_hash: rawSha(input.source.content),
    rights_hash: sourceRightsHash(input.source), variants: [{ grade, product_order_id: order.order_id,
      order_revision: order.order_revision, order_hash: order.order_hash,
      passage_hash: lineage.adaptation_hash, adaptation_hash: input.request.evidence.adaptation_hash,
      item_set_hash: hash([[item.id, itemDigest]]), activity_hash: null,
      benchmark_version: rpc.benchmark_version, benchmark_snapshot_hash: rpc.benchmark_snapshot_hash,
      gold_s_candidate_hash: null, unit_set_hash: hash([[unit.unit_id, rawSha(unit.html)]]),
      analysis_hash: hash(analysis) }] }
  const stage = { grade, article_id: child.id, passage: child.content, lineage, items: [item],
    explanations: [{ item_id: item.id, text: explanation, item_digest: itemDigest, factory_lineage: lineage }],
    reviews: [{ item_id: item.id, decision: 'approved', item_digest: itemDigest,
      explanation_hash: rawSha(explanation), factory_lineage: lineage }], activities: [], analysis, unit }
  const render = { colophon: { title: `Synthetic ${grade}`, ladder: grade, edition: 'fixture', issued: '2026-10-07',
    sourcePolicy: 'fixture', review: 'fixture' }, step: null, schoolBand: null, vLevel: 6,
    totalSteps: 7, totalMinutes: 20, autoPassed: 0, autoTotal: 0, passageChip: 'fixture',
    answerBias: null, proof: { passages: 1, defective: 0 } }
  const captured = { snapshot_id: grade === 'middle_1'
    ? 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' : 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    snapshot_hash: grade === 'middle_1' ? h('a') : h('b'),
    captured_at: now, expires_at: '2026-10-08T00:00:00Z', evidence: {
      schema: 'reading-production-evidence/1', group_id: group.group_id, group_revision: 1,
      group_document: group, evidence_document: evidence, approved_output_hash: null,
      sections: [{ grade, order_id: order.order_id, order_revision: 1, order_hash: order.order_hash,
        article_id: child.id, article_content: child.content, source_id: input.source.id,
        source_content_hash: rawSha(input.source.content), source_evidence: input.source,
        gold_s: child.composed_spec.academic_reading.provenance.gold_s, audit_id: rpc.request_id,
        certificate_hash: rpc.certificate_hash, eligibility_hash: rpc.eligibility_hash,
        benchmark_snapshot_hash: rpc.benchmark_snapshot_hash,
        items: [{ ...item, state: null, reviews: ['setter', 'analyst', 'tutor'].map(persona => ({ persona,
          verdict: 'pass', reviewed_digest: itemDigest })) }] }],
    } }
  const db = { rpc: async (name, params) => name === 'capture_reading_production_snapshot'
    ? { data: captured } : { data: { status: 'rendered_unpublished', snapshot_id: captured.snapshot_id,
      snapshot_hash: captured.snapshot_hash, output_hash: params.p_output_hash } } }
  const preview = await runAtomicMultiGradeFactoryDryRun(db, { groupId: group.group_id, stages: [stage], render })
  captured.evidence.approved_output_hash = rawSha(preview.html)
  const atomic = await runAtomicMultiGradeFactoryDryRun(db, { groupId: group.group_id, stages: [stage], render })
  assert.equal(atomic.manifest.evidence_level, 'atomic_snapshot_unpublished')
  const published = await publishAtomicProductionArtifact({ rpc: async (_name, params) => ({ data: {
    status: 'published_current', snapshot_id: params.p_snapshot_id, snapshot_hash: params.p_snapshot_hash,
    output_hash: rawSha(params.p_html) } }) }, atomic)
  assert.equal(published.status, 'published_current')
  assert.equal(published.production_verified, false)
  const served = await serveAtomicProductionArtifact({ rpc: async () => ({ data: {
    snapshot_id: captured.snapshot_id, snapshot_hash: captured.snapshot_hash,
    output_hash: rawSha(atomic.html), html: atomic.html } }) }, captured.snapshot_id)
  assert.equal(served.html, atomic.html)
  const artifacts = [
    ['source', 'source', null, null, []],
    ['passage', 'passage', order.order_id, 1, ['source']],
    ['item', 'item', order.order_id, 1, ['passage']],
    ['explanation', 'explanation', order.order_id, 1, ['item']],
    ['unit', 'unit', order.order_id, 1, ['explanation']],
    ['volume', 'volume', order.order_id, 1, ['unit']],
    ['render', 'render', order.order_id, 1, ['volume']],
    ['publication', 'publication', order.order_id, 1, ['render']],
  ].map(([artifact_id, kind, product_order_id, order_revision, depends_on]) => ({
    artifact_id, kind, product_order_id, order_revision, evidence_hash: h('b'), depends_on,
  }))
  assert.deepEqual(planFactoryImpact(artifacts, ['source'], 'rights_revoked').map(row => row.artifact_id),
    artifacts.map(row => row.artifact_id))
  assert.equal(planFactoryImpact(artifacts, ['item'], 'changed').at(-1).artifact_id, 'publication')
  await assert.rejects(runAtomicMultiGradeFactoryDryRun(db,
    { groupId: group.group_id, stages: [{ ...stage, passage: `${stage.passage} altered` }], render }),
  /STAGE_STALE_OR_MIXED|GRADE_EVIDENCE_MIXED/)
  const masterRecord = { synthetic_fixture: true, non_production: true, grade_scope: group.grade_scope,
    child_ids: [child.id], request_ids: [rpc.request_id], item_ids: [item.id],
    order_hashes: [order.order_hash], snapshot_ids: [captured.snapshot_id],
    snapshot_hashes: [captured.snapshot_hash],
    output_hash: rawSha(atomic.html), published_status: published.status }
  assert.equal(masterRecord.synthetic_fixture && masterRecord.non_production, true)
  return withFixture ? { ...masterRecord, fixture: { input, child, authority, order, audit,
    lineage, stage, group, evidence, render, captured, db, atomic, published, artifacts } } : masterRecord
}

export { globalTarget, sourceId, childId, requestId, now, h, signBody, profile, syntheticBrief, fixture, promoteSyntheticFixture, exerciseMultiGrade, exerciseSingleGrade }
