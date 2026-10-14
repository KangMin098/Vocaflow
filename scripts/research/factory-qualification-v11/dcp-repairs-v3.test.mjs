// scripts/research/factory-qualification-v11/dcp-repairs-v3.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, serialize } from './dcp-repairs.mjs';
import { validateCandidate3 } from './dcp-repairs-v3.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const local = path.join(root, 'scripts/research/factory-qualification-v11/local');
const load = name => JSON.parse(fs.readFileSync(path.join(local, name), 'utf8'));
const packet = load('dcp-v3-candidate-first.json');
const prior = load('dcp-repairs-v2-candidates-first.json').items.find(row => row.original_item_id === packet.original.id).candidate;
const blueprint = load('dcp-v3-author-blueprint.json');
const validate = candidate => validateCandidate3(candidate, packet.original, prior, blueprint.prohibited_absolute_claims);

test('source-present revision3 is bound to exact current body and prior revision without uniqueness repair', () => {
  assert.deepEqual(validate(packet.candidate), []);
  assert.equal(packet.candidate.legacy_variant.intended_source_restoration_matches, true);
  assert.equal(packet.candidate.legacy_variant.requested_unique_error_role, 'HOLD');
  assert.equal(packet.candidate.legacy_variant.original_key_wrong_confirmed, false);
  assert.equal(packet.candidate.original_unique_error_role_retired, true);
  assert.equal(packet.candidate.task_id, prior.task_id);
  assert.equal(packet.candidate.source.historical_generation_revision, null);
});

test('universal grammatical-impossibility flag or exact unsupported assertion is rejected', () => {
  const candidate = structuredClone(packet.candidate);
  candidate.legacy_variant.unconditionally_ungrammatical = true;
  assert.ok(validate(candidate).includes('universal_variant_agrammaticality'));
  const wording = structuredClone(packet.candidate);
  wording.teacher_notes += blueprint.prohibited_absolute_claims[0];
  assert.ok(validate(wording).includes('universal_wrong_assertion'));
});

test('local source match does not establish legacy unique wrong choice or wrong key', () => {
  const candidate = structuredClone(packet.candidate);
  candidate.legacy_variant.unique_wrong_choice_established = true;
  candidate.legacy_variant.original_key_wrong_confirmed = true;
  assert.ok(validate(candidate).includes('legacy_uniqueness_promotion'));
  assert.ok(validate(candidate).includes('unjustified_key_error'));
});

test('optional alternative discussion cannot become required output or automatic word-match defect', () => {
  assert.equal(packet.candidate.rubric.require_legacy_invalidity_response, false);
  assert.equal(packet.candidate.rubric.grade_optional_alternative_comment_by_word_match, false);
  assert.equal(packet.candidate.legacy_variant.learner_task_input, false);
  const candidate = structuredClone(packet.candidate);
  candidate.rubric.grade_optional_alternative_comment_by_word_match = true;
  assert.ok(validate(candidate).includes('word_match_or_hidden_output'));
  candidate.rubric.require_legacy_invalidity_response = true;
  assert.ok(validate(candidate).includes('word_match_or_hidden_output'));
});

test('source text or output revision drift fails rather than inventing source facts', () => {
  const candidate = structuredClone(packet.candidate);
  candidate.source_target_sentence += ' New asserted condition.';
  assert.ok(validate(candidate).includes('source_target_sentence'));
  candidate.prior_revision_sha256 = '0'.repeat(64);
  assert.ok(validate(candidate).includes('prior_revision_hash'));
  candidate.required_outputs[0].command += ' Hidden task.';
  assert.ok(validate(candidate).includes('output_rubric_binding'));
});

test('eight cases preserve correct subsets, contradictions and a qualified alternative without author verdict leak', () => {
  const blind = load('dcp-v3-blind-first.json');
  const cases = blind.items[0].verification_cases;
  assert.equal(cases.length, 8);
  for (const row of cases) {
    assert.equal(row.author_expected_whole_state, undefined);
    assert.equal(row.genuine_unseen_student_attempt, false);
    assert.equal(row.population, 'development_synthetic_same_source_not_student_not_confirmatory');
  }
  const author = load('dcp-v3-author-cases-first.json');
  assert.deepEqual(author.cases.map(row => row.author_expected_whole_state), ['meets', 'meets', 'partial', 'defect', 'defect', 'defer', 'meets', 'defect']);
  assert.equal(sha256(serialize(packet.candidate)), packet.candidate_sha256);
});

test('fresh AI content input is not sourcewide, human, learner or release approval', () => {
  assert.equal(packet.candidate.public_qualified, false);
  assert.equal(packet.candidate.assessment_qualified, false);
  assert.equal(packet.candidate.rubric.human_validated, false);
  assert.equal(packet.candidate.rubric.student_validated, false);
  assert.equal(packet.candidate.sourcewide_AI_validation, 'HOLD_no_independent_whole_source_or_external_science_approval');
  const candidate = structuredClone(packet.candidate);
  candidate.rubric.human_validated = true;
  assert.ok(validate(candidate).includes('unauthorized_promotion'));
});
