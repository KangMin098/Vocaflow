// scripts/research/factory-qualification-v11/dcp-repairs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { restoreStimulus, summarizeFirsts, makeCandidate, validateCandidate, sha256, serialize } from './dcp-repairs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const load = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const old = 'scripts/research/factory-qualification/local';
const current = 'scripts/research/factory-qualification-v11/local';
const blueprints = load(`${current}/dcp-repairs-blueprints.json`).items;
const inputs = Object.fromEntries(['main', 'counter'].map(split => [split, load(`${old}/dcp-${split}-input.json`)]));
const firsts = ['main', 'counter'].flatMap(split => load(`${old}/dcp-${split}-review-first.json`).items);
const packet = load(`${current}/dcp-repairs-candidates-first.json`);
const publicMetadata = load('docs/research/factory-qualification-v11/data/dcp-repairs.json');

test('B/E overlap is counted as four unique original defective contents, not six', () => {
  assert.deepEqual(summarizeFirsts(firsts), {
    unique_items: 12, B_fail: 2, E_fail: 4, B_E_overlap: 2, B_or_E_unique: 4,
    C: { pass: 2, fail: 8, unknown: 2, not_applicable: 0 },
    first_independent_response_rubric_unknown: 12,
  });
});

test('all 12 marked restorations bind the exact original source sentence and only that mutation', () => {
  for (const input of Object.values(inputs)) for (const item of input.items) {
    const result = restoreStimulus(item);
    assert.ok(item.source.content.replace(/\s+/gu, ' ').includes(result.target_sentence.replace(/\s+/gu, ' ')));
    assert.equal(result.sentences.filter((sentence, index) => sentence !== item.item.payload.sentences[index]).length, 1);
  }
});

test('wrong positional token is rejected instead of repairing an arbitrary occurrence', () => {
  const mutated = structuredClone(inputs.main.items[0]);
  mutated.item.payload.underlines[2].tokenIdx = 0;
  assert.throws(() => restoreStimulus(mutated), /Marked token mismatch/u);
});

test('candidate freezes preserve current source and do not invent historical generation provenance', () => {
  for (const row of packet.items) {
    assert.deepEqual(validateCandidate(row.candidate, row.original), []);
    assert.equal(sha256(serialize(row.candidate)), row.candidate_sha256);
    assert.equal(row.candidate.source.historical_generation_revision, null);
    assert.equal(row.candidate.source.bound_at_repair, true);
    assert.equal(row.candidate.original_generation_timestamp_is_revision, false);
  }
});

test('content/body mutation and revision drift invalidate candidate binding', () => {
  const row = packet.items[0];
  const candidate = structuredClone(row.candidate);
  candidate.stimulus.target_sentence += ' Always.';
  assert.ok(validateCandidate(candidate, row.original).includes('target_source_mutation'));
  candidate.revision = 'silently-edited';
  assert.ok(validateCandidate(candidate, row.original).includes('candidate_revision'));
  const original = structuredClone(row.original);
  original.source.content += ' Changed source.';
  assert.ok(validateCandidate(row.candidate, original).includes('source_body_hash'));
  assert.ok(validateCandidate(row.candidate, original).includes('source_object_hash'));
});

test('new rubric is not promoted by a valid key, author candidate, or synthetic responses', () => {
  const row = packet.items[0];
  const candidate = structuredClone(row.candidate);
  candidate.rubric.human_validated = true;
  candidate.public_qualified = true;
  candidate.assessment_qualified = true;
  assert.ok(validateCandidate(candidate, row.original).includes('validation_invented'));
  assert.ok(validateCandidate(candidate, row.original).includes('unauthorized_promotion'));
  assert.equal(publicMetadata.independent_AI_revalidated, 0);
  assert.equal(publicMetadata.public_qualified, 0);
  assert.equal(publicMetadata.assessment_qualified, 0);
});

test('four grammar articles/determiners move to S3; only two explicit clause-scope candidates retain S5', () => {
  assert.equal(packet.items.filter(row => row.candidate.task_id === 's.chunk_boundary').length, 4);
  assert.equal(packet.items.filter(row => row.candidate.task_id === 's.form_scope').length, 2);
  assert.equal(packet.items.filter(row => row.candidate.task_id === 'v.contextual_sense').length, 6);
  for (const blueprint of blueprints) {
    const item = inputs[blueprint.split].items[blueprint.index];
    assert.deepEqual(makeCandidate(item, blueprint), packet.items.find(row => row.original.id === item.id).candidate);
  }
});

test('nonunique original lexical role is retired rather than repaired by invented evidence', () => {
  const retired = packet.items.filter(row => row.candidate.original_unique_error_role_retired);
  assert.equal(retired.length, 2);
  for (const row of retired) {
    assert.equal(row.candidate.requested_role, 'guided_practice');
    assert.equal(row.candidate.stimulus.target_sentence, restoreStimulus(row.original).target_sentence);
    assert.equal(row.candidate.assessment_qualified, false);
  }
});

test('formula omission remains explicit rather than padded with fabricated p values', () => {
  const omitted = packet.items.filter(row => row.candidate.stimulus.inherited_missing_formula_or_layout_not_reconstructed);
  assert.equal(omitted.length, 1);
  assert.equal(omitted[0].original.split, 'counter');
  assert.ok(omitted[0].original.source.content.includes('[수식]'));
  assert.ok(omitted[0].candidate.stimulus.sentences.some(sentence => sentence.includes('binomial test, )')));
});

test('blind verification has 60 synthetic responses and no authored verdicts or original firsts', () => {
  const blind = load(`${current}/dcp-repairs-blind-first.json`);
  assert.equal(blind.items.length, 12);
  assert.equal(blind.items.flatMap(row => row.verification_cases).length, 60);
  for (const row of blind.items) {
    assert.equal(row.original_first, undefined);
    for (const response of row.verification_cases) {
      assert.equal(response.author_expected_whole_response, undefined);
      assert.equal(response.first_real_student_response, false);
    }
  }
  assert.equal(sha256(fs.readFileSync(path.join(root, `${current}/dcp-repairs-blind-first.json`))), publicMetadata.hashes.blind_sha256);
});
