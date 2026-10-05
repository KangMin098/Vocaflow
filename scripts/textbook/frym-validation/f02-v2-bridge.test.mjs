// scripts/textbook/frym-validation/f02-v2-bridge.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { judgeF02PilotWithV2 } from './f02-v2-bridge.mjs'
import { fixture, freeze, proposed, now } from './f02-pilot-fixture.mjs'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { SEMANTIC_CRITERIA } from '@vocaflow/library-pipeline/educational-validation'
import { bundleV2Schema, deliveryPacketV2, digestV2, manifestIdentityV2, refreshV2Hashes } from '@vocaflow/library-pipeline/educational-validation-v2'
import { researchBodyHash } from '@vocaflow/library-pipeline/research-origin'
import { pilotManifestHash, sha256 } from './f02-pilot-judge.mjs'

const approved = '2026-11-01T00:00:00Z'
function reseal(bundle) {
  refreshV2Hashes(bundle)
  bundle.protocol_approval.manifest_hash = digestV2(manifestIdentityV2(bundle))
  for (const r of bundle.records) {
    for (const review of r.expert_reviews) review.packet_hash = deliveryPacketV2(bundle, r, 'expert').packet_hash
    for (const session of r.student_sessions) session.packet_hash = deliveryPacketV2(bundle, r, 'student').packet_hash
  }
}
function v2Fixture(study) {
  const packet = JSON.parse(readFileSync('.agent-logs/academic-reading-f02-r2/F02-review-packet.json'))
  const experts = ['expert-one', 'expert-two', 'expert-third'].map(id => ({ id, kind: 'human_domain_expert', independent_of_author: true, credential_verified_by: 'lead-synthetic', qualification_evidence: 'Synthetic expert qualification for testing only.', screened_at: '2026-10-31T00:00:00Z', screened_by: 'lead-synthetic', prior_exposure: [], blind_eligible: true, screening_evidence: 'Synthetic blind screening for testing only.' }))
  const records = ['middle_1', 'high_1'].map(grade => {
    const variant = freeze.variants.find(v => v.grade === grade), passage = packet.adaptations.find(a => a.target.age_band === grade).text
    const quote = passage.slice(0, 30), originalQuote = packet.source_text.slice(0, 30), arm = grade === 'middle_1' ? 'middle_target' : 'high_target'
    const instrument = ['comprehension', 'lexical', 'syntax', 'reasoning'].flatMap(axis => [1, 2, 3].map(n => ({ id: `${grade}-${axis}-${n}`, axis, prompt: 'Explain the stated relationship in this passage.', source_quote: quote, scoring_rubric: 'Preserve the relationship and stated limits.' })))
    const record = { id: `F02-${grade}`, pair_id: 'F02', blind_item_id: `B-${grade}`, source_id: freeze.source_id, source_hash: freeze.source_hash, source_revision: freeze.source_revision, research_hash: 'a'.repeat(64), target_key: variant.target_key, grade, passage_hash: researchBodyHash(passage), link_confidence: 'high', provenance_verified: true, research_doi: '10.3389/frym.2021.548120', research_contexts: [packet.source_text], adapted_passage: passage, topic: 'synthetic-senses', source_family: 'synthetic-frym', expert_assignment: { initial_expert_ids: ['expert-one', 'expert-two'], adjudicator_id: 'expert-third' }, adjudication: null, instrument, expert_reviews: [], student_sessions: [] }
    record.expert_reviews = ['expert-one', 'expert-two'].map(expert_id => ({ expert_id, blind_item_id: record.blind_item_id, passage_hash: record.passage_hash, packet_hash: 'a'.repeat(64), rated_at: '2026-11-01T00:00:10Z', ratings: Object.fromEntries(SEMANTIC_CRITERIA.map(k => [k, { score: 4, critical: false, passage_quote: quote, research_quote: originalQuote, reason: 'Synthetic faithful evidence comparison for testing.' }])), distortions: [], reason: 'Synthetic independent passing review for testing.' }))
    record.student_sessions = study.sessions.filter(s => s.arm === arm).map(s => ({ student_id: s.student_id, grade, packet_hash: 'a'.repeat(64), grade_verified_by: 'lead-synthetic', reading_started_at: s.reading_started_at, reading_finished_at: s.reading_finished_at, unknown_word_count: 0, lexical_burden: s.lexical_burden, sentence_burden: s.sentence_burden, reasoning_burden: s.reasoning_burden, perceived_difficulty: s.perceived_difficulty, answers: instrument.map(i => ({ item_id: i.id, response: 'Synthetic correct answer.', score: 1, scorer_id: 'expert-one' })) }))
    return record
  })
  const bundle = bundleV2Schema.parse({ version: 2, mode: 'local_educational_validation', taxonomy_version: 1, study_id: 'F02-synthetic-v2', pilot_hash: 'a'.repeat(64), review_hash: 'a'.repeat(64), rules_hash: 'a'.repeat(64), protocol_hash: 'a'.repeat(64), instrument_hash: 'a'.repeat(64), protocol: { version: 2, description: 'Synthetic F02 calibration protocol for adapter testing.', study_purpose: 'calibration', scale_points: 4, score_anchors: Array(4).fill('Synthetic scoring anchor for regression testing.'), minimum_item_score: 3, minimum_experts: 2, minimum_students_per_variant: 15, minimum_students_per_grade: 15, minimum_items_per_axis: 3, ranges: ['middle_1', 'high_1'].map(grade => ({ grade, ...proposed.target_fit[grade] })), band_rationale: { middle_1: 'Synthetic middle grade rationale for testing.', high_1: 'Synthetic high grade rationale for testing.' }, operations: 'Synthetic session and missingness operations only.', expert_reuse_allowed: false, failed_passage_policy: 'skip_only_after_completed_failure' }, experts, participants: records.flatMap(r => r.student_sessions.map(s => ({ student_id: s.student_id, grade: r.grade, grade_verified_by: 'lead-synthetic', record_order: [r.id] }))), calibration_exclusions: [], protocol_approval: null, records })
  refreshV2Hashes(bundle)
  bundle.protocol_approval = { human_lead_id: 'lead-synthetic', approved_at: approved, manifest_hash: digestV2(manifestIdentityV2(bundle)), registration_evidence: 'Synthetic preregistration receipt for testing.' }
  for (const r of bundle.records) {
    for (const review of r.expert_reviews) review.packet_hash = deliveryPacketV2(bundle, r, 'expert').packet_hash
    for (const session of r.student_sessions) session.packet_hash = deliveryPacketV2(bundle, r, 'student').packet_hash
  }
  return { bundle, instruments: Object.fromEntries(records.map(r => [r.grade, r.instrument])) }
}

test('an otherwise passing synthetic pilot cannot bypass the v2 registered bundle', () => {
  const result = judgeF02PilotWithV2(fixture(), freeze, proposed, {}, { middle_1: [], high_1: [] }, now)
  assert.deepEqual(result.target_fit, { middle_1: 'INSUFFICIENT_EVIDENCE', high_1: 'INSUFFICIENT_EVIDENCE' })
  assert.equal(result.level_separation, 'INSUFFICIENT_EVIDENCE')
  assert.deepEqual(result.reasons, ['v2_bundle_invalid'])
  assert.equal(result.gold, false)
  assert.equal(result.db_seed, false)
})

test('matching sealed v2 target records reconcile with the common-grade anchor', () => {
  const study = fixture()
  for (const session of study.sessions.filter(s => s.arm !== 'middle_anchor')) { session.comprehension_accuracy = 1; session.lexical_accuracy = 1; session.syntax_accuracy = 1; session.reasoning_accuracy = 1; session.unknown_word_fraction = 0 }
  const { bundle, instruments } = v2Fixture(study)
  const result = judgeF02PilotWithV2(study, freeze, proposed, bundle, instruments, now)
  assert.equal(result.v2_reconciled, true, JSON.stringify(result))
  assert.deepEqual(result.target_fit, { middle_1: 'PASS', high_1: 'PASS' })
  assert.equal(result.level_separation, 'PASS')
  assert.equal(result.gold, false)
})

test('a changed v2 scored answer cannot inherit the pilot target-fit result', () => {
  const study = fixture()
  for (const session of study.sessions.filter(s => s.arm !== 'middle_anchor')) { session.comprehension_accuracy = 1; session.lexical_accuracy = 1; session.syntax_accuracy = 1; session.reasoning_accuracy = 1; session.unknown_word_fraction = 0 }
  const { bundle, instruments } = v2Fixture(study)
  bundle.records[0].student_sessions[0].answers[0].score = 0
  const result = judgeF02PilotWithV2(study, freeze, proposed, bundle, instruments, now)
  assert.equal(result.level_separation, 'INSUFFICIENT_EVIDENCE')
  assert.deepEqual(result.reasons, ['v2_F02_middle_1_student_record_changed'])
})

test('a target-arm time changed only in the pilot cannot inherit v2 meaning validity', () => {
  const study = fixture()
  for (const session of study.sessions.filter(s => s.arm !== 'middle_anchor')) { session.comprehension_accuracy = 1; session.lexical_accuracy = 1; session.syntax_accuracy = 1; session.reasoning_accuracy = 1; session.unknown_word_fraction = 0 }
  const { bundle, instruments } = v2Fixture(study)
  study.sessions.find(s => s.arm === 'middle_target').reading_started_at = '2026-11-01T00:00:05Z'
  study.sessions.find(s => s.arm === 'middle_target').reading_finished_at = '2026-11-01T00:03:05Z'
  const result = judgeF02PilotWithV2(study, freeze, proposed, bundle, instruments, now)
  assert.deepEqual(result.reasons, ['v2_F02_middle_1_student_record_changed'])
})

test('the comparison arm cannot read before the middle passage meaning review', () => {
  const study = fixture()
  for (const session of study.sessions.filter(s => s.arm !== 'middle_anchor')) { session.comprehension_accuracy = 1; session.lexical_accuracy = 1; session.syntax_accuracy = 1; session.reasoning_accuracy = 1; session.unknown_word_fraction = 0 }
  const anchor = study.sessions.find(s => s.arm === 'middle_anchor')
  anchor.reading_started_at = '2026-11-01T00:00:05Z'
  anchor.reading_finished_at = '2026-11-01T00:03:05Z'
  const { bundle, instruments } = v2Fixture(study)
  const result = judgeF02PilotWithV2(study, freeze, proposed, bundle, instruments, now)
  assert.deepEqual(result.reasons, ['anchor_started_before_meaning_review'])
})

test('a wrong pair or source revision in v2 cannot reuse the F02 freeze', () => {
  const study = fixture()
  for (const session of study.sessions.filter(s => s.arm !== 'middle_anchor')) { session.comprehension_accuracy = 1; session.lexical_accuracy = 1; session.syntax_accuracy = 1; session.reasoning_accuracy = 1; session.unknown_word_fraction = 0 }
  const { bundle, instruments } = v2Fixture(study)
  bundle.records[0].pair_id = 'F06'
  reseal(bundle)
  assert.deepEqual(judgeF02PilotWithV2(study, freeze, proposed, bundle, instruments, now).reasons, ['v2_F02_middle_1_identity_or_sessions_changed'])
  bundle.records[0].pair_id = 'F02'
  bundle.records[0].source_revision = 'changed-revision'
  reseal(bundle)
  assert.deepEqual(judgeF02PilotWithV2(study, freeze, proposed, bundle, instruments, now).reasons, ['v2_F02_middle_1_identity_or_sessions_changed'])
})

test('an extra incomplete anchor observation is excluded without erasing a complete comparison', () => {
  const study = fixture()
  for (const session of study.sessions.filter(s => s.arm !== 'middle_anchor')) { session.comprehension_accuracy = 1; session.lexical_accuracy = 1; session.syntax_accuracy = 1; session.reasoning_accuracy = 1; session.unknown_word_fraction = 0 }
  const extra = { ...study.assignments.find(a => a.arm === 'middle_anchor'), student_id: 'middle_anchor-incomplete' }
  study.assignments.push(extra)
  study.sessions.push({ ...study.sessions.find(s => s.arm === 'middle_anchor'), student_id: extra.student_id, reading_started_at: null, reading_finished_at: null, reading_seconds: null })
  study.registration.manifest_sha256 = pilotManifestHash(study)
  const { bundle, instruments } = v2Fixture(study)
  const result = judgeF02PilotWithV2(study, freeze, proposed, bundle, instruments, now)
  assert.equal(result.v2_reconciled, true, JSON.stringify(result))
  assert.equal(result.excluded.middle_anchor, 1)
})

test('the real CLI runs the sealed v2 bridge without a module cycle', async () => {
  const study = fixture()
  for (const session of study.sessions.filter(s => s.arm !== 'middle_anchor')) { session.comprehension_accuracy = 1; session.lexical_accuracy = 1; session.syntax_accuracy = 1; session.reasoning_accuracy = 1; session.unknown_word_fraction = 0 }
  const { bundle, instruments } = v2Fixture(study)
  const dir = mkdtempSync(join(tmpdir(), 'vocaflow-f02-cli-'))
  const previousArgs = process.argv, previousLog = console.log
  try {
    study.instrument_paths = {}
    for (const grade of ['middle_1', 'high_1']) {
      const file = join(dir, `${grade}.json`), bytes = JSON.stringify(instruments[grade])
      writeFileSync(file, bytes)
      study.instrument_paths[grade] = file
      study.instrument_sha256[grade] = sha256(bytes)
      for (const s of study.sessions.filter(s => s.arm === (grade === 'middle_1' ? 'middle_target' : 'high_target') || grade === 'middle_1' && s.arm === 'middle_anchor')) s.instrument_sha256 = study.instrument_sha256[grade]
    }
    study.registration.manifest_sha256 = pilotManifestHash(study)
    const studyPath = join(dir, 'study.json'), v2Path = join(dir, 'v2.json')
    writeFileSync(studyPath, JSON.stringify(study)); writeFileSync(v2Path, JSON.stringify(bundle))
    process.argv = [previousArgs[0], resolve('scripts/textbook/frym-validation/f02-pilot-evaluate.mjs'), studyPath, v2Path]
    let output = ''
    console.log = value => { output += value }
    await import('./f02-pilot-evaluate.mjs?synthetic-cli-check')
    assert.deepEqual(JSON.parse(output).reasons, ['approval_time_invalid'])
  } finally {
    process.argv = previousArgs
    console.log = previousLog
    if (resolve(dir).startsWith(resolve(tmpdir()))) rmSync(dir, { recursive: true, force: true })
  }
})
