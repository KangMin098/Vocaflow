// scripts/textbook/frym-benchmark/promotion-preview.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AXES, GRADES, hash, judgeBenchmark } from './benchmark.mjs'
import { identifyLocalFile } from './local-admission.mjs'
import { prepareSealedAdmission } from './local-admission-ledger.mjs'
import { sealAdmittedSnapshot } from './admitted-snapshot.mjs'
import { inspectPipeline } from './pipeline-state.mjs'
import { previewPromotion } from './promotion-preview.mjs'
import { assessGoldSContract, inspectGoldSCertificate, issueGoldSCertificate } from './gold-s-contract.mjs'
import { previewSeedEligibility, issueSeedEligibility, inspectSeedEligibility } from './seed-preview.mjs'
import { sourceRightsHash, validateGoldSImport } from './gold-s-import-gate.mjs'
import { generateKeyPairSync, sign } from 'node:crypto'

const current = { schema: 'frym-benchmark-pipeline-state/1', state: 'gold_s_candidate', benchmark_version: 'fixture-v1', admission_receipt_hash: hash('receipt'), benchmark_snapshot_hash: hash('snapshot') }
const decisionBody = { gold_s_candidate: true, gold_s: false, db_seed: false, benchmark_version: current.benchmark_version, admission_receipt_hash: current.admission_receipt_hash, benchmark_snapshot_hash: current.benchmark_snapshot_hash }
const decision = { ...decisionBody, decision_hash: hash(decisionBody) }

test('a serialized or fabricated candidate cannot open owner review readiness', () => {
  const preview = previewPromotion(current, decision)
  assert.equal(preview.gold_s_review, 'blocked')
  assert.equal(preview.review_evidence_hash, null)
  assert.equal(preview.gold_s, false)
  assert.equal(preview.seed_eligible, false)
  assert.equal(preview.db_seed, false)
  assert.ok(preview.blockers.includes('GOLD_S_CERTIFICATION_NOT_ISSUED'))
  const absentHashes = { schema: current.schema, state: current.state }
  const unsigned = { gold_s_candidate: true, gold_s: false, db_seed: false }
  assert.equal(previewPromotion(absentHashes, { ...unsigned, decision_hash: hash(unsigned) }).gold_s_review, 'blocked')
})

test('missing, stale, or mixed decision evidence cannot open review or seed', () => {
  for (const [status, evidence] of [
    [{ ...current, state: 'stale' }, decision],
    [current, null],
    [current, { ...decision, admission_receipt_hash: hash('other-receipt') }],
    [current, { ...decision, benchmark_version: 'fixture-v2' }],
    [current, { ...decision, gold_s_candidate: false }],
    [current, { ...decision, gold_s: true }],
    [current, { ...decision, db_seed: true }],
  ]) {
    const preview = previewPromotion(status, evidence)
    assert.equal(preview.gold_s_review, 'blocked')
    assert.equal(preview.review_evidence_hash, null)
    assert.equal(preview.seed_eligible, false)
  }
})

test('an inspected full synthetic benchmark opens review but resists serialization and mutation', t => {
  const directory = mkdtempSync(join(tmpdir(), 'frym-promotion-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const source = join(directory, 'fixture.txt')
  writeFileSync(source, 'Synthetic original for metadata-only promotion regression.\n')
  const fileHash = identifyLocalFile(source).file_hash
  const axes = Object.fromEntries(AXES.map(axis => [axis, { metric: `${axis}_score`, scale: 'ratio', unit: 'fixture', measurement_method: 'fixture', missing_rule: 'inconclusive', rater_policy: 'independent', direction: 1, resolution: .1, minimum_meaningful_delta: .5, valid_min: 0, valid_max: 100, auxiliary_metrics: [], auxiliary_override_rule: 'none', rater_agreement_floor: .8, missing_priority: 'inconclusive' }]))
  const ids = GRADES.flatMap(grade => Array.from({ length: 30 }, (_, index) => `${grade}-${index}`))
  const selection = { schema: 'frym-benchmark-selection/1', status: 'sealed', selected_sample_ids: ids, representative_editions: Object.fromEntries(ids.map(id => [JSON.stringify([`publisher-${Math.floor(Number(id.split('-').at(-1)) / 10)}`, `title-${id}`]), 'fixture-1'])) }
  const protocol = { schema: 'frym-benchmark/1', status: 'sealed', version: 'promotion-fixture-v1', codebook_hash: hash(axes), selection_manifest: selection, selection_manifest_hash: hash(selection), grades: [...GRADES], minimum: { per_grade: 30, publishers: 3, series_per_publisher: 2, max_publisher_share: .4, max_series_share: .2, comparison_n: 12, item_type_comparison_n: 12 }, item_types: ['literal', 'inference'], item_type_difficulty: { scale: 'ratio', valid_min: 0, valid_max: 100 }, axes, fit: { lower_quantile: .1, upper_quantile: .9, minimum_axes: 7, length_ratio_min: .75, length_ratio_max: 1.25 }, separation: { minimum_stable_axes: 5, minimum_matching_axes: 3, minimum_reference_ratio: .5, maximum_opposite_axes: 1 } }
  const candidates = GRADES.flatMap(grade => Array.from({ length: 30 }, (_, index) => {
    const id = `${grade}-${index}`, slot = index % 10
    const genre = slot < 4 ? 'expository' : slot < 8 ? 'argumentative' : 'narrative'
    const words = genre === 'expository' ? 100 : genre === 'argumentative' ? 200 : 300
    const base = (grade === 'middle_1' ? 5 : grade === 'high_1' ? 7 : 4) + (index % 5 - 2) * .1
    const questions = [{ id: 'Q1', stem: 'What happens?', type: 'literal', answer: 'word' }, { id: 'Q2', stem: 'Why?', type: 'inference', answer: 'word' }]
    const passage = [`id-${id}`, ...Array(words - 1).fill('word')].join(' ')
    return { source_path: source, expected_file_hash: fileHash, metadata: { sample_id: id, publisher: `publisher-${Math.floor(index / 10)}`, series: `series-${Math.floor(index / 5)}`, title: `title-${id}`, grade, edition: 'fixture-1', publication_year: 2026, difficulty_step: 'fixture-level', ISBN: `fixture-isbn-${id}`, passage_id: `passage-${id}`, page: '1', genre, rights_basis: 'authorized_local_analysis', access_date: '2026-10-06' }, extraction: { method: 'fixture', ocr_used: false, source_file_hash: fileHash, page_range: '1', passage_id: `passage-${id}`, boundary_confirmed: true, question_boundary_confirmed: true, passage_text: passage, questions }, analysis: { codebook_hash: protocol.codebook_hash, analyzer_version: 'fixture-1', evidence_locator: `fixture:${id}`, passage_hash: createHash('sha256').update(passage).digest('hex'), item_set_hash: hash(questions.map(({ answer, ...item }) => item)), scoring_key_hash: hash(questions.map(({ id: questionId, answer }) => ({ id: questionId, answer }))), metrics: Object.fromEntries(AXES.map(axis => [axis, base])), axis_agreement: Object.fromEntries(AXES.map(axis => [axis, 1])), item_type_difficulty: { literal: base, inference: base } } }
  }))
  const admission = prepareSealedAdmission(protocol, candidates)
  assert.equal(admission.samples.length, 240)
  const envelope = sealAdmittedSnapshot(protocol, admission.samples, admission.receipt.receipt_hash)
  assert.ok(Object.values(envelope.benchmark_snapshot.grades).every(grade => grade.status === 'calibrated'))
  const variants = Object.fromEntries(['middle_1', 'high_1'].map((grade, index) => [grade, { passage_hash: hash(`f02-${grade}`), genre: 'expository', word_count: 100, item_count: 2, item_ids: [`${grade}-1`, `${grade}-2`], item_type_counts: { literal: 1, inference: 1 }, item_type_difficulty: { literal: index ? 7 : 5, inference: index ? 7 : 5 }, axis_agreement: Object.fromEntries(AXES.map(axis => [axis, 1])), metrics: Object.fromEntries(AXES.map(axis => [axis, index ? 7 : 5])) }]))
  const f02Body = { codebook_hash: protocol.codebook_hash, source_freeze_sha256: hash('freeze'), item_set_hash: hash('items'), scoring_key_hash: hash('key'), variants }
  const f02 = { ...f02Body, analysis_hash: hash(f02Body) }
  const e3 = { status: 'verified', valid_n: 28, run_id: 'fixture-run', evidence_hash: hash('e3'), seal: { source_freeze_sha256: f02.source_freeze_sha256, item_set_hash: f02.item_set_hash, scoring_key_hash: f02.scoring_key_hash, passage_hash: Object.fromEntries(Object.entries(variants).map(([grade, variant]) => [grade, variant.passage_hash])), item_ids: Object.fromEntries(Object.entries(variants).map(([grade, variant]) => [grade, variant.item_ids])) } }
  const judged = judgeBenchmark({ protocol, snapshot: envelope.benchmark_snapshot, samples: admission.samples, f02, e3 })
  assert.equal(judged.gold_s_candidate, true)
  const { decision_hash, ...decisionBody } = judged
  decisionBody.admission_receipt_hash = admission.receipt.receipt_hash
  const certifiedDecision = { ...decisionBody, decision_hash: hash(decisionBody) }
  const currentDecision = { benchmark_version: protocol.version, benchmark_snapshot_hash: envelope.benchmark_snapshot.snapshot_hash, f02_input_hash: hash(f02), e3_run_id: e3.run_id, e3_evidence_hash: e3.evidence_hash }
  const status = inspectPipeline({ protocol, candidates, ...admission, envelope, decision: certifiedDecision, currentDecision, f02, e3 })
  assert.equal(status.state, 'gold_s_candidate')
  assert.equal(previewPromotion(status, certifiedDecision).gold_s_review, 'ready_for_owner_review')
  assert.equal(previewPromotion(status, certifiedDecision).seed_eligible, false)
  const pending = assessGoldSContract({ status, decision: certifiedDecision })
  assert.equal(pending.status, 'hold')
  assert.ok(pending.reasons.includes('REAL_BENCHMARK_DISTRIBUTION_REQUIRED'))
  const corpus = { kind: 'real_commercial_textbooks', fixture: false, curator_id: 'fixture-curator', admitted_n: 240, distribution_hash: hash('distribution'), benchmark_version: status.benchmark_version, snapshot_hash: status.benchmark_snapshot_hash, admission_receipt_hash: status.admission_receipt_hash }
  const reviewBody = { decision: 'approve', owner_id: 'fixture-owner', decided_at: '2026-10-07T00:00:00Z', rationale: 'Synthetic contract fixture', revision: 'r1', review_evidence_hash: pending.review_evidence_hash, benchmark_version: status.benchmark_version, decision_hash: certifiedDecision.decision_hash, distribution_hash: corpus.distribution_hash }
  const review = { ...reviewBody, review_hash: hash(reviewBody) }
  const assess = (currentCorpus = corpus, currentReview = review) => assessGoldSContract({ status, decision: certifiedDecision, corpus: currentCorpus, review: currentReview })
  assert.equal(assess().status, 'reviewable')
  assert.equal(assess().gold_s, false)
  assert.equal(assess().seed_eligible, false)
  assert.equal(assess({ ...corpus, fixture: true }).status, 'hold')
  assert.equal(assess({ ...corpus, admitted_n: 0 }).status, 'hold')
  assert.equal(assess(corpus, { ...review, review_evidence_hash: hash('other') }).status, 'stale')
  assert.equal(assess(corpus, { ...review, decision: 'reject' }).status, 'reject')
  assert.equal(assess(corpus, { ...review, rationale: '' }).status, 'hold')
  const liveSource = { id: 'fixture-source', source_id: 'frym-full:fixture', content: 'Current source text', license: 'CC BY 4.0', license_class: 'cc_by', display_only: false, copyright_safe_in_kr: true, status: 'ready', updated_at: '2026-10-07T00:00:00Z' }
  const draft = { adapted_from_id: liveSource.id, text: 'A reviewed student adaptation.', reading: { target: { share_alike: false } } }
  const passageHash = hash(draft.text)
  const binding = { review_evidence_hash: pending.review_evidence_hash, decision_hash: certifiedDecision.decision_hash, distribution_hash: corpus.distribution_hash, review_hash: review.review_hash, benchmark_version: status.benchmark_version, admission_receipt_hash: status.admission_receipt_hash, benchmark_snapshot_hash: status.benchmark_snapshot_hash, source_id: liveSource.id, target_key: 'middle_1', passage_hash: passageHash, content_hash: hash({ source_id: liveSource.id, target_key: 'middle_1', passage_hash: passageHash }), rights_hash: sourceRightsHash(liveSource) }
  const currentCertificate = { ...binding, rights_status: 'permitted' }
  const curator = generateKeyPairSync('ed25519'), owner = generateKeyPairSync('ed25519'), issuer = generateKeyPairSync('ed25519')
  const attest = (value, key) => sign(null, Buffer.from(hash(value)), key).toString('base64')
  const issuance = { status, decision: certifiedDecision, corpus, review, corpusSignature: attest(corpus, curator.privateKey), ownerSignature: attest(review, owner.privateKey), current: currentCertificate, keys: { curator_id: corpus.curator_id, owner_id: review.owner_id, issuer_id: 'fixture-issuer', curator: curator.publicKey, owner: owner.publicKey }, issuerPrivateKey: issuer.privateKey, issuedAt: '2026-10-07T00:00:00Z' }
  assert.throws(() => issueGoldSCertificate({ ...issuance, corpusSignature: null }), /ATTESTATION/)
  assert.throws(() => issueGoldSCertificate({ ...issuance, keys: { ...issuance.keys, owner_id: 'other' } }), /ATTESTATION/)
  assert.throws(() => issueGoldSCertificate({ ...issuance, keys: { ...issuance.keys, owner: curator.publicKey } }), /ATTESTATION/)
  assert.throws(() => issueGoldSCertificate({ ...issuance, keys: { ...issuance.keys, owner_id: corpus.curator_id } }), /ATTESTATION/)
  assert.throws(() => issueGoldSCertificate({ ...issuance, keys: { ...issuance.keys, issuer_id: '' } }), /ATTESTATION/)
  assert.throws(() => issueGoldSCertificate({ ...issuance, keys: { ...issuance.keys, issuer_id: undefined } }), /ATTESTATION/)
  assert.throws(() => issueGoldSCertificate({ ...issuance, corpus: { ...corpus, admitted_n: 0 } }), /PREFLIGHT_HOLD/)
  const certificate = issueGoldSCertificate(issuance)
  const authority = { issuer_id: 'fixture-issuer', issuerPublicKey: issuer.publicKey }
  assert.equal(inspectGoldSCertificate({ certificate, current: currentCertificate }).status, 'unverified')
  assert.equal(inspectGoldSCertificate({ certificate, current: currentCertificate, authority }).status, 'current')
  assert.equal(inspectGoldSCertificate({ certificate, current: currentCertificate, authority: { issuerPublicKey: owner.publicKey } }).status, 'unverified')
  assert.equal(inspectGoldSCertificate({ certificate: { ...certificate, issued_at: 'changed' }, current: currentCertificate, authority }).status, 'unverified')
  assert.equal(inspectGoldSCertificate({ certificate, current: { ...currentCertificate, content_hash: hash('new') }, authority }).status, 'stale')
  assert.equal(inspectGoldSCertificate({ certificate, current: { ...currentCertificate, target_key: 'high_1' }, authority }).status, 'stale')
  assert.equal(inspectGoldSCertificate({ certificate, current: { ...currentCertificate, rights_status: 'denied' }, authority }).status, 'invalidated')
  assert.equal(inspectGoldSCertificate({ certificate: { ...certificate, revoked: true }, current: currentCertificate, authority }).status, 'invalidated')
  const operationsBody = { reviewer_id: 'fixture-operations', certificate_hash: hash(certificate), review_evidence_hash: pending.review_evidence_hash, decision_hash: certifiedDecision.decision_hash, source_id: currentCertificate.source_id, target_key: currentCertificate.target_key, passage_hash: currentCertificate.passage_hash, content_hash: currentCertificate.content_hash, rights_hash: currentCertificate.rights_hash, rights_status: 'permitted', review_status: 'approved', provenance_hash: hash('provenance'), item_set_hash: hash('items'), revision: 'fixture-r1' }
  const operations = { ...operationsBody, operations_hash: hash(operationsBody) }
  const seedInput = { status, decision: certifiedDecision, certificate, current: currentCertificate, authority, operations }
  assert.equal(previewSeedEligibility(seedInput).status, 'ready_for_seed_review')
  assert.equal(previewSeedEligibility(seedInput).seed_eligible, false)
  assert.equal(previewSeedEligibility(seedInput).db_seed, false)
  assert.equal(previewSeedEligibility({ ...seedInput, operations: { ...operations, rights_hash: hash('changed') } }).status, 'blocked')
  const { reviewer_id, ...anonymousOperationsBody } = operationsBody
  assert.equal(previewSeedEligibility({ ...seedInput, operations: { ...anonymousOperationsBody, operations_hash: hash(anonymousOperationsBody) } }).status, 'blocked')
  assert.equal(previewSeedEligibility({ ...seedInput, certificate: { ...certificate, signature: 'invalid' } }).status, 'blocked')
  assert.equal(previewSeedEligibility({ ...seedInput, status: JSON.parse(JSON.stringify(status)) }).status, 'blocked')
  const operationsKey = generateKeyPairSync('ed25519'), approverKey = generateKeyPairSync('ed25519'), seedIssuer = generateKeyPairSync('ed25519')
  const approval = { decision: 'approve', seed_evidence_hash: previewSeedEligibility(seedInput).seed_evidence_hash, approver_id: 'fixture-seed-approver', rationale: 'Synthetic fixture authorization' }
  const seedArgs = { packet: seedInput, operationsSignature: attest(operations, operationsKey.privateKey), approval, approvalSignature: attest(approval, approverKey.privateKey), keys: { operations_id: operations.reviewer_id, approver_id: approval.approver_id, issuer_id: 'fixture-seed-issuer', operationsPublicKey: operationsKey.publicKey, approverPublicKey: approverKey.publicKey }, issuerPrivateKey: seedIssuer.privateKey, issuedAt: '2026-10-07T00:00:00Z' }
  assert.throws(() => issueSeedEligibility({ ...seedArgs, approvalSignature: null }), /APPROVAL_SIGNATURE/)
  assert.throws(() => issueSeedEligibility({ ...seedArgs, keys: { ...seedArgs.keys, approverPublicKey: operationsKey.publicKey } }), /INDEPENDENT_AUTHORITY/)
  assert.throws(() => issueSeedEligibility({ ...seedArgs, keys: { ...seedArgs.keys, approver_id: operations.reviewer_id } }), /INDEPENDENT_AUTHORITY/)
  assert.throws(() => issueSeedEligibility({ ...seedArgs, keys: { ...seedArgs.keys, approver_id: '' } }), /INDEPENDENT_AUTHORITY/)
  assert.throws(() => issueSeedEligibility({ ...seedArgs, packet: { ...seedInput, operations: { ...operations, rights_hash: hash('changed') } } }), /PREVIEW_BLOCKED/)
  const eligibility = issueSeedEligibility(seedArgs)
  const seedAuthority = { issuer_id: 'fixture-seed-issuer', issuerPublicKey: seedIssuer.publicKey }
  assert.equal(inspectSeedEligibility({ eligibility, packet: seedInput, authority: seedAuthority }).status, 'current')
  const policy = { schema: 'frym-gold-s-operational-policy/1', revision: 'fixture-r1', gold_issuers: [{ id: authority.issuer_id, public_key: issuer.publicKey.export({ type: 'spki', format: 'pem' }), valid_from: '2026-10-01T00:00:00Z', valid_until: '2026-11-01T00:00:00Z' }], seed_issuers: [{ id: seedAuthority.issuer_id, public_key: seedIssuer.publicKey.export({ type: 'spki', format: 'pem' }), valid_from: '2026-10-01T00:00:00Z', valid_until: '2026-11-01T00:00:00Z' }], gold_max_age_days: 30, seed_max_age_days: 7, revoked: { certificate_hashes: [], eligibility_hashes: [], issuer_ids: [] } }
  assert.equal(validateGoldSImport({ draft, targetKey: binding.target_key, source: liveSource, bundle: { certificate, eligibility }, policy, now: '2026-10-07T12:00:00Z' }).ok, true)
  assert.equal(inspectSeedEligibility({ eligibility, packet: seedInput, authority: seedAuthority }).db_seed, false)
  assert.equal(inspectSeedEligibility({ eligibility, packet: { ...seedInput, current: { ...currentCertificate, rights_status: 'denied' } }, authority: seedAuthority }).status, 'stale')
  assert.equal(inspectSeedEligibility({ eligibility: { ...eligibility, issued_at: 'changed' }, packet: seedInput, authority: seedAuthority }).status, 'unverified')
  assert.equal(previewPromotion(JSON.parse(JSON.stringify(status)), certifiedDecision).gold_s_review, 'blocked')
  assert.equal(assessGoldSContract({ status: JSON.parse(JSON.stringify(status)), decision: certifiedDecision, corpus, review }).status, 'hold')
  const truncated = { ...decisionBody }
  delete truncated.e3_evidence_hash
  assert.equal(previewPromotion(status, { ...truncated, decision_hash: hash(truncated) }).gold_s_review, 'blocked')
  const originalVersion = status.benchmark_version
  status.benchmark_version = 'changed'
  assert.equal(previewPromotion(status, certifiedDecision).gold_s_review, 'blocked')
  status.benchmark_version = originalVersion
  assert.equal(previewPromotion(status, certifiedDecision).gold_s_review, 'ready_for_owner_review')
})
