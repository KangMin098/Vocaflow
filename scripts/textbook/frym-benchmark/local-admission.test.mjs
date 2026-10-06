// scripts/textbook/frym-benchmark/local-admission.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { AXES, GRADES, hash, screenSample } from './benchmark.mjs'
import { createHash } from 'node:crypto'
import { identifyLocalFile, prepareAdmission } from './local-admission.mjs'
import { dryRunAdmission, prepareSealedAdmission, verifyAdmission } from './local-admission-ledger.mjs'

const axisDefs = Object.fromEntries(AXES.map(axis => [axis, { metric: `${axis}_score`, scale: 'ratio', unit: 'fixture', measurement_method: 'fixture', missing_rule: 'inconclusive', rater_policy: 'independent', direction: 1, resolution: .1, minimum_meaningful_delta: .5, valid_min: 0, valid_max: 100, auxiliary_metrics: [], auxiliary_override_rule: 'none', rater_agreement_floor: .8, missing_priority: 'inconclusive' }]))
const selection = { schema: 'frym-benchmark-selection/1', status: 'sealed', selected_sample_ids: ['sample-1'], representative_editions: { [JSON.stringify(['Fixture Press', 'Fixture Book'])]: '2026-1' } }
const protocol = { schema: 'frym-benchmark/1', status: 'sealed', version: 'fixture-v1', codebook_hash: hash(axisDefs), selection_manifest: selection, selection_manifest_hash: hash(selection), grades: [...GRADES], minimum: { per_grade: 30, publishers: 3, series_per_publisher: 2, max_publisher_share: .4, max_series_share: .2, comparison_n: 12, item_type_comparison_n: 12 }, item_types: ['literal', 'inference'], item_type_difficulty: { scale: 'ratio', valid_min: 0, valid_max: 100 }, axes: axisDefs, fit: { lower_quantile: .1, upper_quantile: .9, minimum_axes: 7, length_ratio_min: .75, length_ratio_max: 1.25 }, separation: { minimum_stable_axes: 5, minimum_matching_axes: 3, minimum_reference_ratio: .5, maximum_opposite_axes: 1 } }

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'frym-admission-'))
  const source = join(directory, 'fixture.txt')
  writeFileSync(source, 'Synthetic source file used only by the admission test.\n')
  const candidate = {
    source_path: source,
    expected_file_hash: identifyLocalFile(source).file_hash,
    metadata: { sample_id: 'sample-1', publisher: 'Fixture Press', series: 'Fixture Series', title: 'Fixture Book', grade: 'middle_1', edition: '2026-1', publication_year: 2026, difficulty_step: 'level-1', ISBN: 'fixture-isbn', passage_id: 'P1', page: '12', genre: 'expository', rights_basis: 'authorized_local_analysis', access_date: '2026-10-06' },
    extraction: { method: 'fixture', ocr_used: false, source_file_hash: identifyLocalFile(source).file_hash, page_range: '12', passage_id: 'P1', boundary_confirmed: true, question_boundary_confirmed: true, passage_text: 'A synthetic passage explains how plants use sunlight to make food.', questions: [{ id: 'Q1', stem: 'What do plants use?', type: 'literal', answer: 'sunlight' }, { id: 'Q2', stem: 'Why is this useful?', type: 'inference', answer: 'food' }] },
    analysis: { codebook_hash: protocol.codebook_hash, analyzer_version: 'fixture-1', evidence_locator: 'fixture:analysis:1', metrics: Object.fromEntries(AXES.map(axis => [axis, 5])), axis_agreement: Object.fromEntries(AXES.map(axis => [axis, 1])), item_type_difficulty: { literal: 5, inference: 6 } },
  }
  candidate.analysis.passage_hash = createHash('sha256').update(candidate.extraction.passage_text).digest('hex')
  candidate.analysis.item_set_hash = hash(candidate.extraction.questions.map(({ answer, ...item }) => item))
  candidate.analysis.scoring_key_hash = hash(candidate.extraction.questions.map(({ id, answer }) => ({ id, answer })))
  return { directory, source, candidate }
}

test('selected and reviewed synthetic file becomes metadata-only benchmark sample', t => {
  const { directory, source, candidate } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const before = readFileSync(source)
  candidate.metadata.passage_text = 'This must never appear in the output.'
  candidate.metadata.source_path = source
  candidate.metadata.publisher_id = { passage_text: 'A secret passage in a typed field.' }
  candidate.analysis.metrics.passage_text = 'Nested raw passage must never appear.'
  const { samples, audit } = prepareAdmission([candidate], protocol)
  assert.equal(samples.length, 1)
  assert.equal(audit.results[0].status, 'admission-pass')
  assert.deepEqual(screenSample(samples[0], protocol), [])
  assert.equal(samples[0].file_hash, candidate.expected_file_hash)
  assert.ok(!JSON.stringify({ samples, audit }).includes(candidate.extraction.passage_text))
  assert.ok(!JSON.stringify({ samples, audit }).includes(candidate.source_path))
  assert.ok(!JSON.stringify({ samples, audit }).includes(candidate.metadata.passage_text))
  assert.ok(!JSON.stringify({ samples, audit }).includes(candidate.analysis.metrics.passage_text))
  assert.ok(!JSON.stringify({ samples, audit }).includes(candidate.metadata.publisher_id.passage_text))
  assert.deepEqual(readFileSync(source), before)
})

test('source change and uncertain passage/question boundary fail closed', t => {
  const { directory, source, candidate } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  writeFileSync(source, 'Changed source')
  assert.deepEqual(prepareAdmission([candidate], protocol).audit.results[0].reasons, ['SOURCE_HASH_CHANGED'])
  candidate.expected_file_hash = identifyLocalFile(source).file_hash
  candidate.extraction.source_file_hash = candidate.expected_file_hash
  candidate.extraction.boundary_confirmed = false
  assert.equal(prepareAdmission([candidate], protocol).audit.results[0].status, 'admission-hold')
  candidate.extraction.boundary_confirmed = true
  candidate.extraction.question_boundary_confirmed = false
  assert.deepEqual(prepareAdmission([candidate], protocol).audit.results[0].reasons, ['QUESTION_EXTRACTION_INCOMPLETE'])
  candidate.extraction.question_boundary_confirmed = true
  candidate.extraction.questions = [null]
  assert.deepEqual(prepareAdmission([candidate], protocol).audit.results[0].reasons, ['QUESTION_EXTRACTION_INCOMPLETE'])
})

test('analysis tied to an earlier passage or scoring key stays on hold', t => {
  const { directory, candidate } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  candidate.extraction.questions[0].answer = 'changed'
  assert.deepEqual(prepareAdmission([candidate], protocol).audit.results[0].reasons, ['NINE_AXIS_ANALYSIS_MISSING'])
})

test('malformed sample ID cannot carry text into the audit', t => {
  const { directory, candidate } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  candidate.metadata.sample_id = { passage_text: 'Untrusted passage' }
  const result = prepareAdmission([candidate], protocol)
  assert.equal(result.samples.length, 0)
  assert.equal(result.audit.results[0].sample_id, null)
  assert.ok(!JSON.stringify(result.audit).includes('Untrusted passage'))
  candidate.metadata.sample_id = 'Untrusted passage with spaces'
  assert.equal(prepareAdmission([candidate], protocol).audit.results[0].sample_id, null)
  assert.equal(prepareAdmission([candidate], protocol).audit.results[0].sample_id_hash, createHash('sha256').update(candidate.metadata.sample_id).digest('hex'))
})

test('selected ID with a slash remains audit-linkable by hash', t => {
  const { directory, candidate } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const sealed = structuredClone(protocol)
  sealed.selection_manifest.selected_sample_ids = ['sample/1']
  sealed.selection_manifest_hash = hash(sealed.selection_manifest)
  candidate.metadata.sample_id = 'sample/1'
  const result = prepareAdmission([candidate], sealed)
  assert.equal(result.samples.length, 1)
  assert.equal(result.audit.results[0].sample_id, null)
  assert.equal(result.audit.results[0].sample_id_hash, createHash('sha256').update(result.samples[0].sample_id).digest('hex'))
})

test('contradictory ordinal adjudication and path locator stay on hold', t => {
  const { directory, candidate } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const sealed = structuredClone(protocol)
  sealed.axes.discourse = { ...sealed.axes.discourse, scale: 'ordinal', resolution: 1, minimum_meaningful_delta: 1, levels: ['low', 'mid', 'high', 'higher', 'very high', 'highest'] }
  sealed.codebook_hash = hash(sealed.axes)
  candidate.analysis.codebook_hash = sealed.codebook_hash
  candidate.analysis.ordinal_reviews = { discourse: { rater_a_id: 'A', rater_b_id: 'B', rater_a: 5, rater_b: 5, adjudicator_id: { passage_text: 'Leaked text' } } }
  const result = prepareAdmission([candidate], sealed)
  assert.equal(result.samples.length, 0)
  assert.deepEqual(result.audit.results[0].reasons, ['ORDINAL_REVIEW_INVALID'])
  assert.ok(!JSON.stringify(result).includes('Leaked text'))
  delete candidate.analysis.ordinal_reviews.discourse.adjudicator_id
  candidate.analysis.evidence_locator = 'D:\\private\\source.pdf'
  assert.deepEqual(prepareAdmission([candidate], sealed).audit.results[0].reasons, ['EVIDENCE_LOCATOR_NOT_OPAQUE'])
  candidate.analysis.evidence_locator = 'fixture:analysis:1'
  delete candidate.analysis.ordinal_reviews
  assert.deepEqual(prepareAdmission([candidate], sealed).audit.results[0].reasons, ['ORDINAL_REVIEW_INVALID:discourse'])
})

test('unused item difficulty cannot leak arbitrary nested content', t => {
  const { directory, candidate } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  candidate.analysis.item_type_difficulty.unused = { passage_text: 'Hidden original text' }
  const result = prepareAdmission([candidate], protocol)
  assert.equal(result.samples.length, 1)
  assert.ok(!JSON.stringify(result).includes('Hidden original text'))
  candidate.analysis.item_type_difficulty.literal = { passage_text: 'Invalid value' }
  assert.deepEqual(prepareAdmission([candidate], protocol).audit.results[0].reasons, ['ITEM_DIFFICULTY_INVALID'])
})

test('whitespace-only passage variants cannot count as independent samples', t => {
  const { directory, candidate } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const second = structuredClone(candidate)
  second.metadata.sample_id = 'sample-2'
  const sealed = structuredClone(protocol)
  sealed.selection_manifest.selected_sample_ids.push('sample-2')
  sealed.selection_manifest_hash = hash(sealed.selection_manifest)
  second.extraction.passage_text = second.extraction.passage_text.replace(' how ', '\n  how   ')
  second.analysis.passage_hash = createHash('sha256').update(second.extraction.passage_text).digest('hex')
  const result = prepareAdmission([candidate, second], sealed)
  assert.equal(result.samples.length, 0)
  assert.ok(result.audit.results.every(row => row.reasons.includes('DUPLICATE_SAMPLE_OR_PASSAGE')))
})

test('image source requires explicit OCR and verification regardless of tool name', t => {
  const { directory, candidate } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const source = join(directory, 'fixture.png')
  writeFileSync(source, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2]))
  candidate.source_path = source
  candidate.expected_file_hash = identifyLocalFile(source).file_hash
  candidate.extraction.source_file_hash = candidate.expected_file_hash
  assert.deepEqual(prepareAdmission([candidate], protocol).audit.results[0].reasons, ['NEEDS_MANUAL_ADMISSION'])
  candidate.extraction.ocr_used = true
  assert.deepEqual(prepareAdmission([candidate], protocol).audit.results[0].reasons, ['NEEDS_MANUAL_ADMISSION'])
  candidate.extraction.ocr_verified = true
  assert.equal(prepareAdmission([candidate], protocol).samples.length, 1)
})

test('OCR, missing axis, rights, selection and duplicates never enter samples', t => {
  const { directory, candidate } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  candidate.extraction.method = 'ocr'
  candidate.extraction.ocr_used = false
  assert.deepEqual(prepareAdmission([candidate], protocol).audit.results[0].reasons, ['NEEDS_MANUAL_ADMISSION'])
  candidate.extraction.ocr_used = true
  assert.deepEqual(prepareAdmission([candidate], protocol).audit.results[0].reasons, ['NEEDS_MANUAL_ADMISSION'])
  candidate.extraction.method = 'abbyy'
  assert.deepEqual(prepareAdmission([candidate], protocol).audit.results[0].reasons, ['NEEDS_MANUAL_ADMISSION'])
  candidate.extraction.ocr_verified = true
  delete candidate.analysis.metrics.inference
  assert.deepEqual(prepareAdmission([candidate], protocol).audit.results[0].reasons, ['NINE_AXIS_ANALYSIS_MISSING'])
  candidate.analysis.metrics.inference = 5
  candidate.metadata.rights_basis = 'unknown'
  assert.deepEqual(prepareAdmission([candidate], protocol).audit.results[0].reasons, ['RIGHTS_UNCONFIRMED'])
  candidate.metadata.rights_basis = 'authorized_local_analysis'
  candidate.metadata.sample_id = 'not-selected'
  assert.deepEqual(prepareAdmission([candidate], protocol).audit.results[0].reasons, ['NOT_SELECTED'])
  candidate.metadata.sample_id = 'sample-1'
  const result = prepareAdmission([candidate, structuredClone(candidate)], protocol)
  assert.equal(result.samples.length, 0)
  assert.deepEqual(result.audit.results[0].reasons, ['DUPLICATE_SAMPLE_OR_PASSAGE'])
  assert.deepEqual(result.audit.results[1].reasons, ['DUPLICATE_SAMPLE_OR_PASSAGE'])
})

test('CLI creates separate metadata and audit files and will not overwrite', t => {
  const { directory, candidate } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const protocolPath = join(directory, 'protocol.json'), candidatesPath = join(directory, 'candidates.json')
  const samplesPath = join(directory, 'metadata-samples.json'), auditPath = join(directory, 'audit.json'), receiptPath = join(directory, 'receipt.json'), snapshotPath = join(directory, 'snapshot.json')
  writeFileSync(protocolPath, JSON.stringify(protocol))
  writeFileSync(candidatesPath, JSON.stringify([candidate]))
  const args = ['scripts/textbook/frym-benchmark/local-admission-run.mjs', 'prepare', protocolPath, candidatesPath, samplesPath, auditPath, receiptPath]
  assert.equal(spawnSync(process.execPath, args).status, 0)
  assert.equal(JSON.parse(readFileSync(samplesPath, 'utf8')).length, 1)
  const verify = spawnSync(process.execPath, ['scripts/textbook/frym-benchmark/local-admission-run.mjs', 'verify', protocolPath, candidatesPath, samplesPath, auditPath, receiptPath], { encoding: 'utf8' })
  assert.equal(verify.status, 0, verify.stderr)
  assert.equal(JSON.parse(verify.stdout).ready_for_build, true)
  const dryRun = spawnSync(process.execPath, ['scripts/textbook/frym-benchmark/local-admission-run.mjs', 'dry-run', protocolPath, candidatesPath], { encoding: 'utf8' })
  assert.equal(dryRun.status, 0, dryRun.stderr)
  assert.equal(JSON.parse(dryRun.stdout).sample_count, 1)
  const directBuild = spawnSync(process.execPath, ['scripts/textbook/frym-benchmark/benchmark-run.mjs', 'build', protocolPath, samplesPath, snapshotPath], { encoding: 'utf8' })
  assert.equal(directBuild.status, 1)
  assert.match(directBuild.stderr, /ADMISSION_RECEIPT_REQUIRED/)
  const admittedBuild = spawnSync(process.execPath, ['scripts/textbook/frym-benchmark/benchmark-run.mjs', 'build-admitted', protocolPath, candidatesPath, samplesPath, auditPath, receiptPath, snapshotPath], { encoding: 'utf8' })
  assert.equal(admittedBuild.status, 0, admittedBuild.stderr)
  const verifySnapshot = spawnSync(process.execPath, ['scripts/textbook/frym-benchmark/benchmark-run.mjs', 'verify-admitted', protocolPath, snapshotPath, candidatesPath, samplesPath, auditPath, receiptPath], { encoding: 'utf8' })
  assert.equal(verifySnapshot.status, 0, verifySnapshot.stderr)
  assert.equal(spawnSync(process.execPath, args).status, 1)
})

test('receipt binds candidates, source, outputs and benchmark version', t => {
  const { directory, source, candidate } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const original = prepareSealedAdmission(protocol, [candidate])
  assert.equal(original.receipt.state, 'admission-pass')
  assert.equal(verifyAdmission(protocol, [candidate], original.samples, original.audit, original.receipt).ready_for_build, true)
  const changedAnswer = structuredClone(candidate)
  changedAnswer.extraction.questions[0].answer = 'different'
  assert.equal(verifyAdmission(protocol, [changedAnswer], original.samples, original.audit, original.receipt).status, 'stale')
  const changedProtocol = { ...protocol, version: 'fixture-v2' }
  assert.ok(verifyAdmission(changedProtocol, [candidate], original.samples, original.audit, original.receipt).reasons.includes('BENCHMARK_VERSION_STALE'))
  const changedSamples = structuredClone(original.samples)
  changedSamples[0].metrics.lexical = 99
  assert.ok(verifyAdmission(protocol, [candidate], changedSamples, original.audit, original.receipt).reasons.includes('METADATA_SAMPLES_STALE'))
  const changedAudit = structuredClone(original.audit)
  changedAudit.results[0].status = 'admission-hold'
  assert.ok(verifyAdmission(protocol, [candidate], original.samples, changedAudit, original.receipt).reasons.includes('ADMISSION_AUDIT_STALE'))
  const changedReceipt = { ...original.receipt, ready_for_build: false }
  assert.ok(verifyAdmission(protocol, [candidate], original.samples, original.audit, changedReceipt).reasons.includes('RECEIPT_INVALID'))
  writeFileSync(source, 'Changed synthetic original')
  assert.ok(verifyAdmission(protocol, [candidate], original.samples, original.audit, original.receipt).reasons.includes('SOURCE_STALE'))
})

test('dry-run and sealed receipt keep held candidates out of build', t => {
  const { directory, candidate } = fixture()
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  candidate.extraction.boundary_confirmed = false
  const dryRun = dryRunAdmission(protocol, [candidate])
  assert.equal(dryRun.state, 'admission-hold')
  assert.equal(dryRun.ready_for_build, false)
  const sealed = prepareSealedAdmission(protocol, [candidate])
  assert.equal(sealed.samples.length, 0)
  const checked = verifyAdmission(protocol, [candidate], sealed.samples, sealed.audit, sealed.receipt)
  assert.equal(checked.status, 'current')
  assert.equal(checked.ready_for_build, false)
})
