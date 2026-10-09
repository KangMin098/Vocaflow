// scripts/textbook/reading-promotion/preflight.test.mjs
import test from 'node:test'
import { globalTarget, sourceId, childId, requestId, now, h, signBody, profile, syntheticBrief, fixture, promoteSyntheticFixture, exerciseMultiGrade, exerciseSingleGrade } from './synthetic-master.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('shared promotion runner preserves read-only preflight on an uninstalled DB gate', async () => {
  const input = fixture()
  const db = { from: table => ({ select: () => ({ eq: (_column, value) => ({
    single: async () => ({ data: value === input.child.id ? input.child : input.source, error: null }),
    maybeSingle: async () => ({ data: null, error: table === 'reading_promotion_audit'
      ? { code: '42P01' } : null }),
  }) }) }) }
  const args = { db, request: input.request, currentPolicy: () => input.request.policy,
    now, requestedBy: 'fixture-operator' }
  assert.equal((await executeReadingPromotion(args)).status, 'preflight_pass')
  await assert.rejects(executeReadingPromotion({ ...args, commit: true }), /PROMOTION_DB_GATE_NOT_INSTALLED/)
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

test('one live resolver revalidates both grade sections and blocks stale members', exerciseMultiGrade)

for (const grade of ['middle_1', 'high_1'])
  test(`${grade} synthetic order keeps one lineage through promotion, atomic render, publish simulation and catalog impact`,
    () => exerciseSingleGrade(grade))

test('master verification runs independent M1, H1 and M1–M2 brief-bound synthetic production', async () => {
  const receipts = [await exerciseSingleGrade('middle_1'), await exerciseSingleGrade('high_1'),
    await exerciseMultiGrade()]
  assert.deepEqual(receipts.map(value => value.grade_scope.grades),
    [['middle_1'], ['high_1'], ['middle_1', 'middle_2']])
  assert(receipts.every(value => value.synthetic_fixture && value.non_production &&
    value.published_status === 'published_current' && /^[a-f0-9]{64}$/.test(value.output_hash)))
  assert.equal(new Set(receipts.map(value => value.output_hash)).size, 3)
  for (const field of ['child_ids', 'request_ids', 'item_ids', 'order_hashes', 'snapshot_ids', 'snapshot_hashes']) {
    const values = receipts.flatMap(receipt => receipt[field])
    assert.equal(new Set(values).size, values.length, `${field} mixed across master runs`)
  }
})

test('master failure matrix rejects changed source, order, evidence and output at every production boundary', async () => {
  const { fixture: base } = await exerciseSingleGrade('middle_1', true)
  const dbFor = captured => ({ rpc: async (name, params) => name === 'capture_reading_production_snapshot'
    ? { data: captured } : { data: { status: 'rendered_unpublished', snapshot_id: captured.snapshot_id,
      snapshot_hash: captured.snapshot_hash, output_hash: params.p_output_hash } } })
  const cases = [
    ['source mutation', ({ captured }) => { captured.evidence.sections[0].source_evidence.content += ' changed' }],
    ['rights revocation', ({ captured }) => { captured.evidence.sections[0].source_evidence.display_only = true }],
    ['order mutation', ({ captured }) => { captured.evidence.group_document.orders[0].order.order_revision += 1 }],
    ['grade mutation', ({ stage }) => { stage.grade = 'high_1' }],
    ['adaptation mutation', ({ stage }) => { stage.passage += ' changed' }],
    ['benchmark revision', ({ captured }) => { captured.evidence.evidence_document.variants[0].benchmark_version = 'other' }],
    ['Gold-S expiration', ({ captured }) => { captured.captured_at = '2027-01-01T00:00:00Z'; captured.expires_at = '2027-01-02T00:00:00Z' }],
    ['Gold-S revocation', ({ captured }) => { captured.evidence.sections[0].gold_s.operational_policy.revoked.certificate_hashes.push(base.audit.certificate_hash) }],
    ['seed approval change', ({ captured }) => { captured.evidence.sections[0].eligibility_hash = h('f') }],
    ['item mutation', ({ stage }) => { stage.items[0].answer_key.answer = 1 }],
    ['explanation mutation', ({ stage }) => { stage.explanations[0].text += ' changed' }],
    ['editorial mutation', ({ stage }) => { stage.reviews[0].decision = 'rejected' }],
    ['unit mixing', ({ stage }) => { stage.unit.unit_id = 'other-unit' }],
    ['volume mixing', ({ captured }) => { captured.evidence.evidence_document.group_id = 'other-group' }],
  ]
  for (const [name, mutate] of cases) {
    const current = { captured: structuredClone(base.captured), stage: structuredClone(base.stage) }
    mutate(current)
    await assert.rejects(runAtomicMultiGradeFactoryDryRun(dbFor(current.captured), {
      groupId: base.group.group_id, stages: [current.stage], render: base.render,
    }), undefined, name)
  }
  await assert.rejects(publishAtomicProductionArtifact({ rpc: async () => ({ data: {} }) },
    { ...base.atomic, html: `${base.atomic.html} changed` }), /ATOMIC_PUBLICATION_INPUT_STALE/)
  assert.deepEqual(planFactoryImpact(base.artifacts, ['source'], 'rights_revoked').map(row => row.artifact_id),
    base.artifacts.map(row => row.artifact_id), 'catalog stale propagation')
  let finalized = false
  const replayDb = { rpc: async (name, params) => name === 'capture_reading_production_snapshot'
    ? { data: base.captured } : finalized ? { error: Error('snapshot already consumed') }
      : (finalized = true, { data: { status: 'rendered_unpublished', snapshot_id: base.captured.snapshot_id,
        snapshot_hash: base.captured.snapshot_hash, output_hash: params.p_output_hash } }) }
  await runAtomicMultiGradeFactoryDryRun(replayDb, { groupId: base.group.group_id,
    stages: [base.stage], render: base.render })
  await assert.rejects(runAtomicMultiGradeFactoryDryRun(replayDb, { groupId: base.group.group_id,
    stages: [base.stage], render: base.render }), /ATOMIC_PRODUCTION_FINALIZATION_FAILED/, 'snapshot replay')
  const failedCapture = structuredClone(base.captured)
  let approvalConsumed = false
  const failedDb = { rpc: async name => name === 'capture_reading_production_snapshot'
    ? approvalConsumed ? { error: Error('output approval already consumed') }
      : (approvalConsumed = true, { data: failedCapture })
    : { error: Error('finalize interrupted') } }
  await assert.rejects(runAtomicMultiGradeFactoryDryRun(failedDb, { groupId: base.group.group_id,
    stages: [base.stage], render: base.render }), /ATOMIC_PRODUCTION_FINALIZATION_FAILED/)
  await assert.rejects(runAtomicMultiGradeFactoryDryRun(failedDb, {
    groupId: base.group.group_id, stages: [base.stage], render: base.render }),
  /ATOMIC_SNAPSHOT_CAPTURE_FAILED/, 'consumed approval cannot be retried after finalize failure')
  let published = false
  const publishDb = { rpc: async (_name, params) => published ? { error: Error('already published') }
    : (published = true, { data: { status: 'published_current', snapshot_id: params.p_snapshot_id,
      snapshot_hash: params.p_snapshot_hash, output_hash: base.atomic.manifest.html_sha256 } }) }
  await publishAtomicProductionArtifact(publishDb, base.atomic)
  await assert.rejects(publishAtomicProductionArtifact(publishDb, base.atomic),
    /ATOMIC_PUBLICATION_REJECTED/, 'publication replay')
})

test('consumed approval recovers only through a new group revision, unapproved render and independent reapproval', async () => {
  const { fixture: base } = await exerciseSingleGrade('middle_1', true)
  const group = { ...base.group, group_revision: base.group.group_revision + 1 }
  const evidence = { ...base.evidence, group_revision: group.group_revision,
    group_hash: sealMultiGradeProductOrder(group).group_hash }
  const captured = structuredClone(base.captured)
  captured.snapshot_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  captured.snapshot_hash = h('e')
  captured.evidence.group_revision = group.group_revision
  captured.evidence.group_document = group
  captured.evidence.evidence_document = evidence
  captured.evidence.approved_output_hash = null
  let registered = false
  let finalized = false
  let approvedHash = null
  let captureCount = 0
  const db = { rpc: async (name, params) => {
    if (name === 'register_reading_production_group') {
      registered = params.p_group_revision === group.group_revision
      return { data: { group_id: group.group_id, group_revision: group.group_revision } }
    }
    if (name === 'capture_reading_production_snapshot') {
      if (!registered || captureCount > 1 || (captureCount === 1 && !approvedHash))
        return { error: Error('approval sequence invalid') }
      captureCount += 1
      const current = structuredClone(captured)
      if (captureCount === 2) {
        current.snapshot_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
        current.snapshot_hash = h('f')
        current.evidence.approved_output_hash = approvedHash
      }
      return { data: current }
    }
    if (name === 'finalize_reading_production_snapshot') {
      finalized = true
      return { data: { status: 'rendered_unpublished', snapshot_id: params.p_snapshot_id,
        snapshot_hash: params.p_snapshot_hash, output_hash: params.p_output_hash } }
    }
    if (name === 'approve_reading_production_output') {
      if (!finalized || captureCount !== 1 || params.p_snapshot_id !== captured.snapshot_id)
        return { error: Error('current rendered snapshot required') }
      approvedHash = params.p_output_hash
      return { data: { approved_output_hash: approvedHash, approved_evidence_hash: h('a') } }
    }
    return { error: Error(`unexpected RPC: ${name}`) }
  } }
  await registerTrustedProductionGroup(db, { group, evidence, sections: [{ grade: base.stage.grade,
    order_id: base.order.order_id, article_id: base.child.id, audit_id: base.audit.request_id,
    item_ids: [base.stage.items[0].id] }] })
  const unapproved = await runAtomicMultiGradeFactoryDryRun(db, { groupId: group.group_id,
    stages: [base.stage], render: base.render })
  assert.equal(unapproved.manifest.approved_output_hash, null)
  await approveTrustedProductionOutput(db, { snapshotId: unapproved.manifest.snapshot_id,
    snapshotHash: unapproved.manifest.snapshot_hash, html: unapproved.html })
  const reissued = await runAtomicMultiGradeFactoryDryRun(db, { groupId: group.group_id,
    stages: [base.stage], render: base.render })
  assert.equal(reissued.manifest.approved_output_hash, reissued.manifest.html_sha256)
  assert.notEqual(reissued.manifest.snapshot_id, base.atomic.manifest.snapshot_id)
  assert.equal(captureCount, 2)
})
