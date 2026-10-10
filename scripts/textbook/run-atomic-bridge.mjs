// scripts/textbook/run-atomic-bridge.mjs
// Synthetic bridge: a completed order-production run -> per-day promotion -> atomic production
// snapshot -> publication simulation -> one atomic multi-day volume. Trust roots are synthetic
// and the DB is in memory, so the output is never production evidence. It exercises the same
// promotion executor, lineage builder, atomic snapshot validator and volume composer that the
// fixed P03 rehearsal uses, but for any planned-path family and any registered brief.
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { bindFactoryEvidence, sealProductOrder } from '@vocaflow/library-pipeline/factory-order'
import { sealMultiGradeProductOrder } from '@vocaflow/library-pipeline/multi-grade-order'
import { reviewDigest, renderReadingFamilyUnit } from '@vocaflow/library-pipeline'
import { READING_ENGINE_VERSION } from '@vocaflow/library-pipeline/academic-reading'
import { hash } from './frym-benchmark/benchmark.mjs'
import { sourceRightsHash, validateGoldSImport } from './frym-benchmark/gold-s-import-gate.mjs'
import { adaptationKey, digest, targetKey } from './academic-reading-contract.mjs'
import { REVIEWERS, REVIEW_DIMENSIONS, reviewTemplate, validateAgentReviews } from './academic-reading-review.mjs'
import { currentReadingLineage } from './factory-lineage.mjs'
import { profile, signBody, promoteSyntheticFixture, now } from './reading-promotion/synthetic-master.mjs'
import { approveTrustedProductionOutput, registerTrustedProductionGroup, runAtomicMultiGradeFactoryDryRun,
  publishAtomicProductionArtifact } from './atomic-production-snapshot.mjs'
import { composeAtomicPlannedVolume, verifyAtomicPlannedVolume } from './atomic-volume.mjs'

const sha = value => createHash('sha256').update(value).digest('hex')
const h = c => c.repeat(64)
const uuid = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`

/** One synthetic trust root per volume; the order drafts must seal `policy_hash` as their trust policy. */
export function syntheticTrustRoot({ validUntil = '2026-11-01T00:00:00Z' } = {}) {
  const goldKey = generateKeyPairSync('ed25519'), seedKey = generateKeyPairSync('ed25519')
  const entry = (id, key) => ({ id, public_key: key.publicKey.export({ type: 'spki', format: 'pem' }),
    valid_from: '2026-10-01T00:00:00Z', valid_until: validUntil })
  const policy = { schema: 'frym-gold-s-operational-policy/1', revision: 'synthetic-run-r1',
    gold_issuers: [entry('gold-issuer', goldKey)], seed_issuers: [entry('seed-issuer', seedKey)],
    gold_max_age_days: 30, seed_max_age_days: 7, revoked: { certificate_hashes: [], eligibility_hashes: [], issuer_ids: [] } }
  return { goldKey, seedKey, policy, policy_hash: hash(policy) }
}

function promotionInput({ trust, order, grade, passage, quote, source, child, request }) {
  const target = order.target
  const rights = { canonical_source: 'frym', canonical_url: source.source_url, original_author: 'Synthetic Author',
    published_at: null, license: source.license, license_url: 'https://example.org/license', commercial_use: true,
    derivative_use: true, ai_processing: 'allowed', third_party_text: false, third_party_image: false,
    attribution_required: true, share_alike: false, original_work_id: null, discovered_via: null,
    checked_at: '2026-10-07T00:00:00Z', evidence: 'Synthetic license evidence' }
  const analysis = { source_profile: profile(), passage_profile: profile(),
    source_claims: [{ claim: 'Synthetic claim', quote }], discourse: [{ relation: 'Claim stated', quote }],
    preserved_claims: [{ source_quote: quote, passage_quote: quote }], added_background: [],
    item_plan: [{ skill: target.skills[0], kind: 'question', item_reasoning_level: 3, item_difficulty: 3,
      difficulty_evidence: 'Explicit claim in the passage', prompt: 'What does the passage state?',
      expected_response: 'The stated claim.', evidence: [quote], resource_evidence: [], time_limit_seconds: null }],
    parallel_pair: null }
  const title = `Synthetic ${grade} reading`
  const key = targetKey(target)
  const exported = { adapted_from_id: source.id, source_text: source.content,
    reading: { source_revision: source.updated_at, source_hash: digest(source.content), target_key: key, target } }
  const draft = { title, text: passage, source_text: source.content, reading: { source_rights: rights, reading_analysis: analysis } }
  const reviews = REVIEWERS.map(reviewer => ({ ...reviewTemplate(draft, exported, reviewer), verdict: 'pass',
    dimensions: Object.fromEntries(REVIEW_DIMENSIONS.map(d => [d, true])), distortions: [],
    source_quote: quote, passage_quote: quote, rationale: 'The synthetic claim is preserved without distortion.' }))
  const review = validateAgentReviews(draft, exported, reviews.map(row => [row]))
  assert.equal(review.ok, true, `content review failed for ${grade}`)
  const childRow = { id: child, source_id: adaptationKey(source.id, target), source: source.source,
    source_url: source.source_url, title, adapted_from_id: source.id, status: 'queued', content: passage,
    updated_at: '2026-10-07T01:00:00Z', license: source.license, license_class: source.license_class,
    display_only: false, copyright_safe_in_kr: true, article_v_level: target.passage_v_level,
    composed_spec: { academic_reading: { version: READING_ENGINE_VERSION, state: 'agent_reviewed', target,
      target_key: key, analysis, content_review: review.certificate,
      provenance: { rights, source_id: source.id, source_revision: source.updated_at, source_hash: digest(source.content) } } } }
  const passage_hash = hash(passage)
  const content_hash = hash({ source_id: source.id, target_key: key, passage_hash })
  const rights_hash = sourceRightsHash(source)
  const certificate = signBody({ schema: 'frym-gold-s-certificate/1', certificate_id: `run-cert-${child}`,
    issued_at: '2026-10-07T00:00:00Z', issuer_id: 'gold-issuer', curator_id: 'synthetic-curator',
    owner_id: 'synthetic-owner', source_id: source.id, target_key: key, passage_hash, content_hash, rights_hash,
    benchmark_version: 'synthetic-v1', review_evidence_hash: h('a'), decision_hash: h('b'), distribution_hash: h('c'),
    admission_receipt_hash: h('d'), benchmark_snapshot_hash: h('e'), review_hash: h('f') }, trust.goldKey.privateKey)
  const eligibility = signBody({ schema: 'frym-seed-eligibility/1', eligibility_id: `run-elig-${child}`,
    issued_at: '2026-10-07T00:00:00Z', issuer_id: 'seed-issuer', operations_id: 'synthetic-operations',
    approver_id: 'synthetic-approver', certificate_hash: hash(certificate), content_hash, rights_hash,
    seed_evidence_hash: h('1'), operations_hash: h('2'), approval_hash: h('3') }, trust.seedKey.privateKey)
  const bundle = { certificate, eligibility }
  const gold = validateGoldSImport({ draft: { adapted_from_id: source.id, text: passage, reading: { target } },
    targetKey: key, source, bundle, policy: trust.policy, now })
  assert.equal(gold.ok, true, `Gold-S failed for ${grade}: ${gold.reason}`)
  childRow.composed_spec.academic_reading.provenance.gold_s = gold.certificate
  const evidence = bindFactoryEvidence(order, { source_id: source.id, source_route: 'ADAPT_REQUIRED',
    source_hash: hash(source.content), rights_hash, trust_policy_hash: trust.policy_hash,
    evidence_policy_hash: order.evidence_policy_hash, adaptation_hash: hash(passage),
    benchmark_version: certificate.benchmark_version, benchmark_snapshot_hash: certificate.benchmark_snapshot_hash,
    certificate_hash: hash(certificate) })
  const promotionRequest = { request_id: request, article_id: child, order,
    order_hash: sealProductOrder(order).order_hash, target_key: key, evidence: evidence.evidence,
    evidence_hash: evidence.evidence_hash, bundle, policy: trust.policy }
  return { request: promotionRequest, child: childRow, source }
}

/**
 * Produces and publishes one atomic snapshot for `day` of an assembled order run.
 * `run` is the `assembled` result of importOrderProductionDrain.
 */
// deliveryMode: 'auto' picks shared_passage_grade_specific_items when every grade got the same
// passage that day, otherwise grade_specific_adaptations; 'grade_specific_units' can be forced.
export async function produceRunDayAtomic({ run, day, trust, revision = 1, deliveryMode = 'auto' }) {
  if (!Number.isInteger(revision) || revision < 1 || revision > 99) throw Error('RUN_DAY_REVISION_INVALID')
  const units = run.volumeInput.units.filter(unit => unit.day === day)
    .sort((a, b) => run.volumeInput.brief.grade_scope.grades.indexOf(a.grade) - run.volumeInput.brief.grade_scope.grades.indexOf(b.grade))
  if (!units.length) throw Error('RUN_DAY_MISSING')
  // Specialized resource/time layouts are rejected by registration JS and by the DB triggers
  // (20261009095727) until their resources are revalidated at the DB boundary.
  if (['P13', 'P14', 'P18', 'P20'].includes(run.volumeInput.orders[0].order.product_family))
    throw Error('ATOMIC_SPECIALIZED_PRODUCTION_REVALIDATION_PENDING')
  const orderByGrade = new Map(run.volumeInput.orders.map(entry => [entry.grade, entry]))
  if (orderByGrade.size !== units.length) throw Error('RUN_DAY_GRADE_MISSING')
  for (const unit of units) if (orderByGrade.get(unit.grade).order.trust_policy_hash !== trust.policy_hash)
    throw Error('RUN_TRUST_POLICY_MISMATCH')
  const source = { id: uuid('a1111111', day), source_id: `frym-full:run-day-${day}`, source: 'frym',
    source_url: `https://example.org/run/${day}`, content: units.map(unit => unit.passage).join('\n\n'),
    license: 'CC BY 4.0', license_class: 'cc_by', display_only: false, copyright_safe_in_kr: true,
    status: 'ready', csat_fit: null, updated_at: '2026-10-07T00:00:00Z' }
  const inputs = units.map((unit, index) => promotionInput({ trust, order: orderByGrade.get(unit.grade).order,
    grade: unit.grade, passage: unit.passage, quote: unit.items[0].evidence_quote, source,
    child: uuid('b2222222', day * 10 + index), request: uuid('c3333333', day * 10 + index) }))
  const promoted = []
  for (const input of inputs) promoted.push(await promoteSyntheticFixture(input))
  const authority = promoted[0].authority
  const family = orderByGrade.get(units[0].grade).order.product_family
  const sections = units.map((unit, index) => {
    const { child, order, audit } = promoted[index]
    const lineage = currentReadingLineage({ article: child, parent: source, audit, order, authority, now })
    const sealedOrder = orderByGrade.get(unit.grade).order
    const gated = run.gatedItems.find(entry => entry.unit_id === unit.unit_id)?.items
    if (!gated || gated.length !== unit.items.length ||
        gated.some((item, position) => item.item_id !== unit.items[position].item_id)) throw Error('RUN_GATED_ITEMS_MISMATCH')
    const items = gated.map((runItem, position) => {
      const item = { id: uuid('d4444444', day * 100 + index * 10 + position), ref_id: child.id,
        payload: { passage: child.content, item_type: runItem.item_type, question: runItem.question,
          choices: runItem.choices, evidence_primary: runItem.evidence_primary,
          ...(runItem.evidence_secondary ? { evidence_secondary: runItem.evidence_secondary } : {}),
          ...(runItem.focus_text ? { focus_text: runItem.focus_text } : {}), factory_lineage: lineage },
        answer_key: { answer: runItem.answer, explanation_ko: runItem.explanation } }
      return { ...item, source_item_digest: reviewDigest(item.payload, item.answer_key) }
    })
    return { grade: unit.grade, orderId: sealedOrder.product_order_id, order: sealedOrder, unit, items, rpc: promoted[index].rpc }
  })
  const grades = sections.map(section => section.grade)
  const group = { schema: 'textbook-product-order-group/1', group_id: `run-${sections[0].orderId}-d${day}`, group_revision: revision,
    grade_scope: grades.length === 1 ? { mode: 'single_grade', grades } : run.volumeInput.brief.grade_scope,
    delivery_mode: grades.length === 1 ? 'single_grade' : deliveryMode !== 'auto' ? deliveryMode
      : new Set(sections.map(section => section.unit.passage)).size === 1
        ? 'shared_passage_grade_specific_items' : 'grade_specific_adaptations',
    orders: sections.map(section => ({ grade: section.grade, order: section.order })) }
  const evidence = { schema: 'textbook-multi-grade-evidence/1', group_id: group.group_id, group_revision: revision,
    group_hash: sealMultiGradeProductOrder(group).group_hash, source_id: source.id,
    source_hash: sha(source.content), rights_hash: sourceRightsHash(source),
    variants: sections.map((section, index) => ({ grade: section.grade, product_order_id: section.orderId,
      order_revision: section.order.order_revision, order_hash: section.rpc.order_hash,
      passage_hash: section.items[0].payload.factory_lineage.adaptation_hash,
      adaptation_hash: inputs[index].request.evidence.adaptation_hash,
      item_set_hash: hash(section.items.map(item => [item.id, item.source_item_digest])),
      activity_hash: null, benchmark_version: section.rpc.benchmark_version,
      benchmark_snapshot_hash: section.rpc.benchmark_snapshot_hash, gold_s_candidate_hash: null,
      unit_set_hash: h('0'), analysis_hash: h('0') })) }
  const stages = sections.map((section, index) => {
    const items = section.items.map(({ source_item_digest: _digest, ...item }) => item)
    const html = family === 'P03'
      ? `<section class="unit"><p>${section.unit.passage}</p></section>`
      : renderReadingFamilyUnit({ order: section.order, passage: section.unit.passage, grade: section.grade, items })
    const unit = { unit_id: section.unit.unit_id, html }
    const analysis = { grade: section.grade, day }
    evidence.variants[index].unit_set_hash = hash([[unit.unit_id, sha(unit.html)]])
    evidence.variants[index].analysis_hash = hash(analysis)
    return { grade: section.grade, article_id: items[0].ref_id, passage: section.unit.passage,
      lineage: items[0].payload.factory_lineage, items,
      explanations: section.items.map(item => ({ item_id: item.id, text: item.answer_key.explanation_ko,
        item_digest: item.source_item_digest, factory_lineage: item.payload.factory_lineage })),
      reviews: section.items.map(item => ({ item_id: item.id, decision: 'approved', item_digest: item.source_item_digest,
        explanation_hash: sha(item.answer_key.explanation_ko), factory_lineage: item.payload.factory_lineage })),
      activities: [], analysis, unit }
  })
  const render = { colophon: { title: `Synthetic run day ${day}`, ladder: grades.join('/'), edition: 'synthetic',
    issued: '2026-10-07', sourcePolicy: 'synthetic', review: 'synthetic' }, step: null, schoolBand: null, vLevel: 5,
    totalSteps: 7, totalMinutes: 20, autoPassed: 0, autoTotal: 0, passageChip: 'synthetic', answerBias: null,
    proof: { passages: sections.length, defective: 0 } }
  // A rebuilt day is a new group revision with a new snapshot; earlier snapshots stay as history.
  const snapshot = { snapshot_id: uuid('e5555555', revision * 1000 + day), snapshot_hash: sha(`run-snapshot-${group.group_id}-r${revision}`),
    captured_at: now, expires_at: '2026-10-08T00:00:00Z',
    evidence: { schema: 'reading-production-evidence/1', group_id: group.group_id, group_revision: revision,
      group_document: group, evidence_document: evidence, approved_output_hash: null,
      sections: sections.map(section => ({ grade: section.grade, order_id: section.orderId,
        order_revision: section.order.order_revision, order_hash: section.rpc.order_hash,
        article_id: section.items[0].ref_id, article_content: section.unit.passage, source_id: source.id,
        source_content_hash: sha(source.content), source_evidence: source,
        gold_s: inputs.find(input => input.child.id === section.items[0].ref_id).child.composed_spec.academic_reading.provenance.gold_s,
        audit_id: section.rpc.request_id, certificate_hash: section.rpc.certificate_hash,
        eligibility_hash: section.rpc.eligibility_hash, benchmark_snapshot_hash: section.rpc.benchmark_snapshot_hash,
        items: section.items.map(item => ({ id: item.id, ref_id: item.ref_id, payload: item.payload,
          answer_key: item.answer_key, state: null, reviews: ['setter', 'analyst', 'tutor'].map(persona => ({
            persona, verdict: 'pass', reviewed_digest: item.source_item_digest })) })) })) } }
  // In-memory DB: register, capture, finalize, approve, publish and serve for this one group.
  let published = null
  const db = { rpc: async (name, params) => {
    if (name === 'register_reading_production_group') return { data: { group_id: group.group_id, group_revision: revision } }
    if (name === 'capture_reading_production_snapshot') return { data: structuredClone(snapshot), error: null }
    if (name === 'finalize_reading_production_snapshot') return { data: { status: 'rendered_unpublished',
      snapshot_id: snapshot.snapshot_id, snapshot_hash: snapshot.snapshot_hash, output_hash: params.p_output_hash }, error: null }
    if (name === 'approve_reading_production_output') {
      snapshot.evidence.approved_output_hash = params.p_output_hash
      return { data: { approved_output_hash: params.p_output_hash, approved_evidence_hash: h('8') }, error: null }
    }
    if (name === 'publish_reading_production_artifact') {
      published = { snapshot_id: snapshot.snapshot_id, snapshot_hash: snapshot.snapshot_hash,
        output_hash: sha(params.p_html), html: params.p_html }
      return { data: { status: 'published_current', ...published }, error: null }
    }
    throw Error(`UNEXPECTED_RPC:${name}`)
  } }
  await registerTrustedProductionGroup(db, { group, evidence, sections: sections.map(section => ({
    grade: section.grade, order_id: section.orderId, article_id: section.items[0].ref_id,
    audit_id: section.rpc.request_id, item_ids: section.items.map(item => item.id) })) })
  const preview = await runAtomicMultiGradeFactoryDryRun(db, { groupId: group.group_id, stages, render })
  await approveTrustedProductionOutput(db, { snapshotId: snapshot.snapshot_id, snapshotHash: snapshot.snapshot_hash, html: preview.html })
  const output = await runAtomicMultiGradeFactoryDryRun(db, { groupId: group.group_id, stages, render })
  await publishAtomicProductionArtifact(db, output)
  return { day, output, published, delivery_mode: group.delivery_mode }
}

/** Every planned day -> published atomic snapshot -> one volume, verified against the served artifacts. */
export async function produceRunAtomicVolume({ run, trust, deliveryMode = 'auto' }) {
  const days = [...new Set(run.volumeInput.units.map(unit => unit.day))].sort((a, b) => a - b)
  const results = []
  for (const day of days) results.push({ ...(await produceRunDayAtomic({ run, day, trust, deliveryMode })), revision: 1 })
  return composeRunDayResults(run, results)
}

/** Composes and verifies a volume from per-day results ({ day, revision, output, published }). */
export async function composeRunDayResults(run, results) {
  const artifacts = new Map(results.map(result => [result.published.snapshot_id, result.published]))
  const revoked = new Set()
  const serveDb = { rpc: async (_name, { p_snapshot_id: id }) => revoked.has(id) || !artifacts.has(id)
    ? { data: null, error: { message: 'published evidence no longer current' } }
    : { data: artifacts.get(id), error: null } }
  const orders = run.volumeInput.orders.map(entry => ({ grade: entry.grade,
    product_order_id: entry.order.product_order_id, order_revision: entry.order.order_revision, order_hash: entry.order_hash }))
  const input = { orders, sections: results.map(result => ({ day: result.day, manifest: result.output.manifest })) }
  const volume = await composeAtomicPlannedVolume(serveDb, input)
  await verifyAtomicPlannedVolume(serveDb, input, volume)
  return { volume, input, serveDb, revoke: id => revoked.add(id), snapshots: results.map(result => result.published.snapshot_id), days: results }
}
