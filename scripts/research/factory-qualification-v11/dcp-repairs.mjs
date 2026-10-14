// scripts/research/factory-qualification-v11/dcp-repairs.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export const serialize = value => `${JSON.stringify(value, null, 2)}\n`;
export const normalize = value => value.replace(/\s+/gu, ' ').trim();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const oldLocal = path.join(root, 'scripts/research/factory-qualification/local');
const local = path.join(root, 'scripts/research/factory-qualification-v11/local');
const publicFile = path.join(root, 'docs/research/factory-qualification-v11/data/dcp-repairs.json');
const axisState = (row, axis) => row.axes[axis].state ?? row.axes[axis].status;

export function restoreStimulus(item) {
  const { sentences, underlines } = item.item.payload;
  const key = item.item.answer_key;
  const target = underlines[key.position - 1];
  if (!target || !sentences[target.sentenceIdx]) throw new Error('Invalid target position');
  const output = [...sentences];
  const sentence = output[target.sentenceIdx];
  if (Number.isInteger(target.tokenIdx)) {
    const parts = sentence.split(' ');
    if (parts[target.tokenIdx] !== target.word) throw new Error('Marked token mismatch');
    parts[target.tokenIdx] = key.original;
    output[target.sentenceIdx] = parts.join(' ');
  } else {
    const occurrences = [...sentence.matchAll(new RegExp(`\\b${target.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gu'))];
    if (occurrences.length !== 1) throw new Error('Nonunique marked word location');
    const start = occurrences[0].index;
    output[target.sentenceIdx] = sentence.slice(0, start) + key.original + sentence.slice(start + target.word.length);
  }
  return { sentences: output, target, target_sentence: output[target.sentenceIdx] };
}

export function summarizeFirsts(rows) {
  const bFail = rows.filter(row => axisState(row, 'B') === 'fail');
  const eFail = rows.filter(row => axisState(row, 'E') === 'fail');
  return {
    unique_items: rows.length,
    B_fail: bFail.length,
    E_fail: eFail.length,
    B_E_overlap: bFail.filter(row => eFail.some(other => other.id === row.id)).length,
    B_or_E_unique: new Set([...bFail, ...eFail].map(row => row.id)).size,
    C: Object.fromEntries(['pass', 'fail', 'unknown', 'not_applicable'].map(state => [state, rows.filter(row => axisState(row, 'C') === state).length])),
    first_independent_response_rubric_unknown: rows.length,
  };
}

export function classifyOriginal(item, first) {
  const categories = ['intentional_marked_stimulus', 'missing_independent_response_rubric', 'historical_generation_provenance_unknown'];
  if (axisState(first, 'B') === 'fail') categories.push('inaccurate_explanation');
  if ((first.issue_kinds ?? []).some(x => /nonuniqueness/u.test(x))) categories.push('contextual_gold_nonunique', 'insufficient_disambiguating_evidence');
  if (axisState(first, 'C') === 'fail') categories.push('requested_TASK_mismatch');
  if (axisState(first, 'C') === 'unknown') categories.push('requested_TASK_unknown');
  if (!item.item.answer_key.explanation_ko) categories.push('explanation_absent');
  if (item.source.content.includes('[수식]') || item.source.content.includes('a different of ways')) categories.push('inherited_source_incompleteness_or_awkwardness');
  return categories;
}

export function validateCandidate(candidate, item) {
  const errors = [];
  if (candidate.revision !== 'FQ11-DCP-candidate-1') errors.push('candidate_revision');
  if (candidate.original_item_id !== item.id || candidate.source.id !== item.source.id) errors.push('source_identity');
  if (candidate.source.object_sha256 !== sha256(JSON.stringify(item.source))) errors.push('source_object_hash');
  if (candidate.source.body_sha256 !== sha256(item.source.content)) errors.push('source_body_hash');
  if (candidate.source.historical_generation_revision !== null) errors.push('historical_provenance_invented');
  if (candidate.source.bound_at_repair !== true) errors.push('new_generation_binding_absent');
  const restored = restoreStimulus(item);
  if (normalize(candidate.stimulus.target_sentence) !== normalize(restored.target_sentence)) errors.push('target_source_mutation');
  if (candidate.stimulus.sentences.join(' ') !== restored.sentences.join(' ')) errors.push('unmarked_stimulus_mutation');
  if (!candidate.instruction || candidate.rubric.components.length !== 4 || candidate.rubric.task_id !== candidate.task_id) errors.push('instruction_rubric_contract');
  if (!['s.chunk_boundary', 's.form_scope', 'v.contextual_sense'].includes(candidate.task_id)) errors.push('TASK');
  if (candidate.rubric.response_states.join('/') !== 'meets/partial/defect/defer') errors.push('rubric_states');
  if (candidate.public_qualified || candidate.assessment_qualified || candidate.rights_approval) errors.push('unauthorized_promotion');
  if (candidate.rubric.human_validated || candidate.rubric.student_validated) errors.push('validation_invented');
  return errors;
}

export function makeCandidate(item, blueprint) {
  const restored = restoreStimulus(item);
  const sourceContent = normalize(item.source.content);
  const restoredBody = normalize(restored.sentences.join(' '));
  return {
    content_id: `FQ11-DCP-${item.id}`, revision: 'FQ11-DCP-candidate-1',
    original_item_id: item.id, original_item_sha256: item.item_sha256,
    original_generation_revision: null, original_generation_timestamp_is_revision: false,
    task_id: blueprint.task, original_requested_task: item.task,
    requested_role: 'guided_practice', repair_kind: blueprint.kind,
    source: {
      id: item.source.id, object_sha256: sha256(JSON.stringify(item.source)),
      body_sha256: sha256(item.source.content), revision: item.source_revision,
      policy_version_observed: item.eligibility?.policy_version ?? null,
      historical_generation_revision: null, bound_at_repair: true,
      external_original_verified: false,
    },
    stimulus: { sentences: restored.sentences, target_sentence: restored.target_sentence,
      current_local_source_target_matches: sourceContent.includes(normalize(restored.target_sentence)),
      restored_full_stimulus_contiguous_in_current_source: sourceContent.includes(restoredBody),
      inherited_missing_formula_or_layout_not_reconstructed: !sourceContent.includes(restoredBody),
      intentional_wrong_target_removed_for_new_explanation_task: true },
    instruction: blueprint.instruction, explanation: blueprint.explanation,
    rubric: {
      revision: 'FQ11-DCP-rubric-1', task_id: blueprint.task,
      components: blueprint.components,
      response_states: ['meets', 'partial', 'defect', 'defer'],
      rules: {
        equivalent: 'Source-consistent paraphrase is accepted; exact wording is not required.',
        partial: 'Preserve observed source-correct components without manufacturing omitted ones.',
        defect: 'An explicit interpretable contradiction is recorded on its affected component, including contradiction appended to an otherwise correct answer; unaffected components remain preserved.',
        defer: 'Missing/uninterpretable evidence is deferred component by component, never automatically a linguistic defect.',
        whole_response: 'All observed required components with no contradiction: meets; some correct observations and no explicit contradiction: partial; any explicit contradiction: defect with component-level record; no interpretable evidence: defer.',
        limit: 'No NLP grading engine, human scoring reliability, student measurement or educational-effect evidence is supplied.',
      },
      human_validated: false, student_validated: false,
    },
    original_unique_error_role_retired: blueprint.kind.startsWith('nonunique'),
    retired_role_reason: blueprint.kind.startsWith('nonunique') ? 'Current contextual unique-error claim was not established; this new guided source-present explanation role does not retroactively repair that claim.' : null,
    review_status: 'author_candidate_pending_independent_AI_review',
    remaining_holds: ['external_source_lineage', 'historical_generation_provenance', 'rights_and_release', 'human_gold_review', 'student_measurement', 'learner_exposure', 'actual_workspace_execution'],
    source_operational_hold: item.source.status === 'archived' || item.source.csat_fit?.gate?.verdict === 'reject',
    public_qualified: false, assessment_qualified: false, rights_approval: false,
  };
}

function immutableWrite(file, value) {
  const bytes = serialize(value);
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error(`Refuse to overwrite frozen file ${path.basename(file)}`);
  } else fs.writeFileSync(file, bytes, { flag: 'wx' });
  return sha256(bytes);
}

export function build() {
  const blueprints = JSON.parse(fs.readFileSync(path.join(local, 'dcp-repairs-blueprints.json'), 'utf8'));
  const inputs = {}, firsts = {}, seals = {};
  for (const split of ['main', 'counter']) {
    const inputBytes = fs.readFileSync(path.join(oldLocal, `dcp-${split}-input.json`));
    const firstBytes = fs.readFileSync(path.join(oldLocal, `dcp-${split}-review-first.json`));
    inputs[split] = JSON.parse(inputBytes); firsts[split] = JSON.parse(firstBytes);
    seals[split] = { input_sha256: sha256(inputBytes), first_sha256: sha256(firstBytes) };
  }
  const packets = [], metadata = [], authorCases = [], blindItems = [];
  for (const blueprint of blueprints.items) {
    const item = inputs[blueprint.split].items[blueprint.index];
    const first = firsts[blueprint.split].items.find(row => row.id === item.id);
    const candidate = makeCandidate(item, blueprint);
    const errors = validateCandidate(candidate, item);
    if (errors.length) throw new Error(`${item.id}: ${errors.join(',')}`);
    const responses = [blueprint.equivalent_response, blueprint.partial_response, blueprint.invalid_response, '???', `${blueprint.equivalent_response} ${blueprint.invalid_response}`];
    const expected = ['meets', 'partial', 'defect', 'defer', 'defect'];
    const verification = responses.map((response, index) => ({ case_id: `${item.id}-case-${index + 1}`, response,
      population: 'new_author_created_synthetic_boundary_case_not_student', first_real_student_response: false }));
    authorCases.push(...verification.map((row, index) => ({ ...row, author_expected_whole_response: expected[index] })));
    const candidateHash = sha256(serialize(candidate));
    packets.push({ split: blueprint.split, original: item, original_first: first, candidate, candidate_sha256: candidateHash });
    blindItems.push({ split: blueprint.split, candidate, candidate_sha256: candidateHash,
      source: item.source, verification_cases: verification });
    metadata.push({ item_id: item.id, split: blueprint.split, original_type: item.type,
      original_item_sha256: item.item_sha256, original_source_sha256: item.source_sha256,
      first_states: Object.fromEntries(Object.keys(first.axes).map(axis => [axis, axisState(first, axis)])),
      original_error_categories: classifyOriginal(item, first),
      original_source_error_confirmed: false, unmarked_generation_semantic_error_confirmed: false,
      key_position_or_restoration_wrong_confirmed: false,
      content_id: candidate.content_id, new_revision: candidate.revision, new_sha256: candidateHash,
      source_body_sha256: candidate.source.body_sha256, original_task: item.task,
      new_task: candidate.task_id, new_role: candidate.requested_role,
      repair_kind: blueprint.kind, unique_error_role_retired: candidate.original_unique_error_role_retired,
      current_target_source_match: candidate.stimulus.current_local_source_target_matches,
      full_stimulus_contiguous_source_match: candidate.stimulus.restored_full_stimulus_contiguous_in_current_source,
      source_operational_hold: candidate.source_operational_hold,
      author_status: 'repair_candidate_not_independent_validation', independent_AI_status: 'pending',
      source_historical_provenance: 'unknown', rights_release: 'unknown', human_validation: false,
      actual_students: 0, public_qualified: false, assessment_qualified: false });
  }
  const privatePacket = { version: 'FQ11-DCP-repair-candidates-1', old_seals: seals,
    scope: 'All 12 full source objects are loaded/hash-bound; author close-reading concerns supplied generated windows, exact current original target windows and preserved full-source first reviews; no new external scientific source certification.', items: packets };
  const blind = { version: 'FQ11-DCP-blind-1', instruction: 'Read source and proposed candidate; judge semantics, TASK/output, instruction/Gold/rubric and all synthetic response boundaries. No first verdict or author-expected response verdict is supplied. Preserve disagreements; this is AI content review, not human/student/rights validation.', items: blindItems };
  const hashes = {
    candidates_sha256: immutableWrite(path.join(local, 'dcp-repairs-candidates-first.json'), privatePacket),
    blind_sha256: immutableWrite(path.join(local, 'dcp-repairs-blind-first.json'), blind),
    authored_cases_sha256: immutableWrite(path.join(local, 'dcp-repairs-author-cases-first.json'), { version: 'FQ11-DCP-authored-boundaries-1', cases: authorCases }),
  };
  const allFirsts = [...firsts.main.items, ...firsts.counter.items];
  const categoryCounts = {};
  for (const row of metadata) for (const category of row.original_error_categories) categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
  const publicResult = { version: 'FQ11-DCP-repairs-1', old_seals: seals, hashes,
    original_counts: summarizeFirsts(allFirsts), category_counts: categoryCounts,
    new_content_revisions: metadata.length, new_synthetic_verification_cases: authorCases.length,
    independent_firsts_rewritten: false, old_DB_rows_changed: 0,
    author_repair_candidates: metadata.length, independent_AI_revalidated: 0,
    human_validated: 0, actual_students: 0, public_qualified: 0, assessment_qualified: 0,
    evidence_scope: privatePacket.scope, items: metadata };
  immutableWrite(publicFile, publicResult);
  return publicResult;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = build();
  console.log(JSON.stringify({ count: result.new_content_revisions, originals: result.original_counts,
    hashes: result.hashes, independent_review: 'pending', public_qualified: 0, assessment_qualified: 0 }));
}
