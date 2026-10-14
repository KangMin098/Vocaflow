// scripts/research/factory-qualification-v11/dcp-repairs-v4.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, serialize } from './dcp-repairs.mjs';
import { buildFeedback, validateCandidate4 } from './dcp-repairs-v4.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const local = path.join(root, 'scripts/research/factory-qualification-v11/local');
const load = name => JSON.parse(fs.readFileSync(path.join(local, name), 'utf8'));
const prior = load('dcp-v3-candidate-first.json');
const packet = load('dcp-v4-candidate-first.json');
const blueprint = load('dcp-v4-feedback-blueprint.json');
const validate = candidate => validateCandidate4(candidate, prior.original, prior.candidate, blueprint);

test('four served outputs are source-bound and instruction, TASK and rubric remain unchanged', () => {
  assert.deepEqual(validate(packet.candidate), []);
  assert.deepEqual(packet.candidate.rubric, prior.candidate.rubric);
  assert.equal(packet.candidate.instruction, prior.candidate.instruction);
  assert.equal(packet.candidate.task_id, prior.candidate.task_id);
  assert.deepEqual(packet.candidate.served_feedback.outputs.map(one => one.id), ['c1', 'c2', 'c3', 'c4']);
  assert.equal(packet.candidate.explanation, packet.candidate.served_feedback.outputs.map((one, index) => `${index + 1}. ${one.text}`).join('\n'));
});

test('whole content clause equals exact subject plus predicate spans of actual source sentence', () => {
  const spans = packet.candidate.served_feedback.source_spans;
  assert.equal(spans.clause_text, `${spans.subject_text} ${spans.predicate_text}`);
  assert.equal(spans.source_target_sentence_sha256, sha256(prior.candidate.source_target_sentence));
  const actual = prior.candidate.source_target_sentence.split(' ');
  assert.equal(spans.subject_text, actual.slice(spans.content_clause_start_token, spans.predicate_start_token).join(' '));
  assert.equal(spans.predicate_text, actual.slice(spans.predicate_start_token).join(' ').replace(/[.]$/u, ''));
});

test('omitted modal output or incomplete bracket invalidates the actual served feedback', () => {
  const missing = structuredClone(packet.candidate);
  missing.served_feedback.outputs.pop();
  assert.ok(validate(missing).includes('feedback_component_completeness'));
  assert.ok(validate(missing).includes('feedback_source_or_semantic_contract'));
  const altered = structuredClone(packet.candidate);
  altered.served_feedback.source_spans.clause_text = altered.served_feedback.source_spans.subject_text;
  assert.ok(validate(altered).includes('feedback_source_or_semantic_contract'));
});

test('structured connector, action subject and qualified evidence cannot be promoted or reinterpreted', () => {
  const contract = packet.candidate.served_feedback.semantic_contract;
  assert.equal(contract.c1.function, 'content_clause_connector');
  assert.equal(contract.c3.subject_denotation, 'intervention_combination_action');
  assert.equal(contract.c4.evidence_strength, 'preliminary');
  assert.equal(contract.c4.modal_force, 'possibility');
  assert.equal(contract.c4.confirmed_clinical_effect_proven, false);
  assert.equal(contract.c4.permanent_cure_proven, false);
  const promoted = structuredClone(packet.candidate);
  promoted.served_feedback.semantic_contract.c4.confirmed_clinical_effect_proven = true;
  assert.ok(validate(promoted).includes('feedback_source_or_semantic_contract'));
  const badBlueprint = structuredClone(blueprint);
  badBlueprint.clauses.predicate_start_token = badBlueprint.clauses.content_clause_start_token;
  assert.throws(() => buildFeedback(prior.candidate, badBlueprint), /Invalid observed source clause spans/u);
});

test('possible alternate subject parse and original unique-role HOLD survive the feedback repair', () => {
  assert.equal(packet.candidate.legacy_variant.unconditionally_ungrammatical, false);
  assert.equal(packet.candidate.legacy_variant.unique_wrong_choice_established, false);
  assert.equal(packet.candidate.legacy_variant.original_key_wrong_confirmed, false);
  assert.equal(packet.candidate.legacy_variant.requested_unique_error_role, 'HOLD');
  assert.equal(packet.candidate.rubric.require_legacy_invalidity_response, false);
  assert.equal(packet.candidate.rubric.grade_optional_alternative_comment_by_word_match, false);
});

test('five unchanged development responses do not acquire author verdicts or human/student authorization', () => {
  const blind = load('dcp-v4-blind-first.json');
  const cases = blind.items[0].verification_cases;
  const priorCases = load('dcp-v3-blind-first.json').items[0].verification_cases;
  assert.equal(cases.length, 5);
  for (const row of cases) {
    assert.equal(row.response, priorCases.find(previous => previous.case_id === row.development_parent_case_id).response);
    assert.equal(row.author_expected_whole_state, undefined);
    assert.equal(row.genuine_unseen_student_attempt, false);
  }
  assert.equal(packet.candidate.public_qualified, false);
  assert.equal(packet.candidate.assessment_qualified, false);
  assert.equal(packet.candidate.rubric.human_validated, false);
  assert.equal(packet.candidate.rubric.student_validated, false);
  assert.equal(sha256(serialize(packet.candidate)), packet.candidate_sha256);
});
