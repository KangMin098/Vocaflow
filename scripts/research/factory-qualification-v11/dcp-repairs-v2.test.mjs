// scripts/research/factory-qualification-v11/dcp-repairs-v2.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, serialize, normalize } from './dcp-repairs.mjs';
import { sourceDisplay, validateRevision2 } from './dcp-repairs-v2.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const base = 'scripts/research/factory-qualification-v11/local';
const load = name => JSON.parse(fs.readFileSync(path.join(root, base, name), 'utf8'));
const prior = load('dcp-repairs-candidates-first.json');
const packet = load('dcp-repairs-v2-candidates-first.json');
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'docs/research/factory-qualification-v11/data/dcp-repairs-v2.json'), 'utf8'));

test('revision2 is exact prior-bound and every instruction output is explicitly bound to the rubric', () => {
  assert.equal(packet.items.length, 12);
  for (let i = 0; i < packet.items.length; i++) {
    const candidate = packet.items[i].candidate;
    assert.deepEqual(validateRevision2(candidate, prior.items[i].original, prior.items[i].candidate), []);
    assert.equal(candidate.required_outputs.length, 4);
    assert.ok(candidate.required_outputs.every(output => output.command));
    assert.equal(candidate.rubric.unrequested_metadata_omission_penalty, false);
  }
});

test('deleting a required output or changing the output binding is rejected', () => {
  const candidate = structuredClone(packet.items[0].candidate);
  candidate.required_outputs.pop();
  assert.ok(validateRevision2(candidate, prior.items[0].original, prior.items[0].candidate).includes('output_rubric_count'));
  assert.ok(validateRevision2(candidate, prior.items[0].original, prior.items[0].candidate).includes('output_rubric_hash'));
});

test('learner display is an exact normalized original span and does not manufacture abbreviated sentence boundaries', () => {
  for (let i = 0; i < packet.items.length; i++) {
    const candidate = packet.items[i].candidate;
    const display = sourceDisplay(prior.items[i].original, prior.items[i].candidate);
    assert.deepEqual(candidate.learner_display, display);
    assert.equal(normalize(prior.items[i].original.source.content).slice(display.normalized_start, display.normalized_end), display.text);
    assert.equal(candidate.stimulus.array_entries_not_displayed_as_complete_sentences, true);
  }
  for (const index of [2, 3, 7]) {
    const display = packet.items[index].candidate.learner_display.text;
    assert.ok(display.includes(index === 2 ? 'C. elegans' : 'U.S.'));
  }
  const quoteDisplay = packet.items[7].candidate.learner_display.text;
  assert.equal((quoteDisplay.match(/“/gu) ?? []).length, (quoteDisplay.match(/”/gu) ?? []).length);
});

test('formula placeholders are copied from source rather than converted into invented statistics', () => {
  const row = packet.items[10].candidate;
  assert.equal(row.learner_display.missing_formula_placeholders_preserved, true);
  assert.ok(row.learner_display.text.includes('[수식]'));
  assert.equal(row.source.historical_generation_revision, null);
});

test('source display mutation, task reassignment, and restored-unique-role promotion fail binding', () => {
  const candidate = structuredClone(packet.items[4].candidate);
  candidate.learner_display.text += ' Invented finding.';
  assert.ok(validateRevision2(candidate, prior.items[4].original, prior.items[4].candidate).includes('learner_display_source_match'));
  candidate.task_id = 's.form_scope';
  candidate.original_unique_error_role_retired = false;
  assert.ok(validateRevision2(candidate, prior.items[4].original, prior.items[4].candidate).includes('TASK_role_drift'));
});

test('old and new firsts cannot be conflated with independent or human release approval', () => {
  assert.equal(metadata.independent_rereview_completed, 0);
  assert.equal(metadata.sourcewide_holds_unchanged, 7);
  assert.equal(metadata.human_validated, 0);
  assert.equal(metadata.actual_students, 0);
  assert.equal(metadata.public_qualified, 0);
  assert.equal(metadata.assessment_qualified, 0);
  const candidate = structuredClone(packet.items[0].candidate);
  candidate.rubric.human_validated = true;
  candidate.public_qualified = true;
  assert.ok(validateRevision2(candidate, prior.items[0].original, prior.items[0].candidate).includes('unauthorized_promotion'));
});

test('all 60 verification cases remain development cases, not newly unseen confirmation', () => {
  const blind = load('dcp-repairs-v2-blind-first.json');
  const cases = blind.items.flatMap(row => row.verification_cases);
  assert.equal(cases.length, 60);
  assert.equal(cases.filter(row => row.exact_response_reused).length, 42);
  assert.equal(cases.filter(row => !row.exact_response_reused).length, 18);
  assert.equal(metadata.new_confirmatory_cases, 0);
  for (const row of cases) {
    assert.equal(row.author_expected_whole_state, undefined);
    assert.equal(row.independent_first_real_student_response, false);
    assert.ok(row.development_parent_case_id);
  }
  assert.equal(sha256(fs.readFileSync(path.join(root, base, 'dcp-repairs-v2-blind-first.json'))), metadata.hashes.blind_sha256);
});

test('frozen candidate hashes and prior independent seal remain exact', () => {
  assert.equal(sha256(fs.readFileSync(path.join(root, base, 'independent-review-first.json'))), 'bd428eea8f54698f1653c36f18bb36f86e0dd241b0d1b939a2b0d14e64d2b803');
  for (const row of packet.items) assert.equal(sha256(serialize(row.candidate)), row.candidate_sha256);
  assert.equal(sha256(fs.readFileSync(path.join(root, base, 'dcp-repairs-v2-candidates-first.json'))), metadata.hashes.candidates_sha256);
});
