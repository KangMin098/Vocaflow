// scripts/research/factory-qualification-v11/dcp-repairs-v2.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, serialize, normalize } from './dcp-repairs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const local = path.join(root, 'scripts/research/factory-qualification-v11/local');
const data = path.join(root, 'docs/research/factory-qualification-v11/data');
const judgeSeal = 'bd428eea8f54698f1653c36f18bb36f86e0dd241b0d1b939a2b0d14e64d2b803';
const load = name => JSON.parse(fs.readFileSync(path.join(local, name), 'utf8'));

export function sourceDisplay(original, priorCandidate) {
  const source = normalize(original.source.content);
  const sentences = priorCandidate.stimulus.sentences;
  const first = normalize(sentences[0]);
  const last = normalize(sentences.at(-1));
  const start = source.indexOf(first);
  const lastStart = source.indexOf(last, start);
  if (start < 0 || lastStart < 0) throw new Error('Source excerpt endpoints not found');
  let end = lastStart + last.length;
  const preliminary = source.slice(start, end);
  if ((preliminary.match(/“/gu) ?? []).length > (preliminary.match(/”/gu) ?? []).length) {
    const close = source.indexOf('”', end);
    if (close < 0) throw new Error('Closing quotation absent from current source');
    end = close + 1;
  }
  return { text: source.slice(start, end), normalized_start: start, normalized_end: end,
    source_normalization: 'whitespace_only', paragraph_not_automatic_sentence_units: true,
    missing_formula_placeholders_preserved: source.slice(start, end).includes('[수식]') };
}

export function validateRevision2(candidate, original, priorCandidate) {
  const errors = [];
  if (candidate.revision !== 'FQ11-DCP-candidate-2') errors.push('revision');
  if (candidate.prior_revision_sha256 !== sha256(serialize(priorCandidate))) errors.push('prior_revision_hash');
  if (candidate.source.body_sha256 !== sha256(original.source.content)) errors.push('current_source_hash');
  if (candidate.source.historical_generation_revision !== null) errors.push('historical_provenance');
  const display = candidate.learner_display;
  if (normalize(original.source.content).slice(display.normalized_start, display.normalized_end) !== display.text) errors.push('learner_display_source_match');
  if (!candidate.required_outputs || candidate.required_outputs.length !== candidate.rubric.components.length) errors.push('output_rubric_count');
  if (candidate.required_outputs?.some((output, index) => output.component_id !== `c${index + 1}` || !output.command)) errors.push('output_rubric_order');
  if (candidate.rubric.required_outputs_hash !== sha256(serialize(candidate.required_outputs))) errors.push('output_rubric_hash');
  if (candidate.task_id !== priorCandidate.task_id || candidate.original_unique_error_role_retired !== priorCandidate.original_unique_error_role_retired) errors.push('TASK_role_drift');
  if (candidate.public_qualified || candidate.assessment_qualified || candidate.rubric.human_validated || candidate.rubric.student_validated) errors.push('unauthorized_promotion');
  return errors;
}

function writeFrozen(file, value) {
  const bytes = serialize(value);
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error(`Frozen output changed: ${path.basename(file)}`);
  } else fs.writeFileSync(file, bytes, { flag: 'wx' });
  return sha256(bytes);
}

export function build() {
  const judgeBytes = fs.readFileSync(path.join(local, 'independent-review-first.json'));
  if (sha256(judgeBytes) !== judgeSeal) throw new Error('Independent first seal drift');
  const judge = JSON.parse(judgeBytes);
  const prior = load('dcp-repairs-candidates-first.json');
  const priorBlind = load('dcp-repairs-blind-first.json');
  const overrides = load('dcp-repairs-v2-overrides.json');
  const authorBlueprints = load('dcp-repairs-blueprints.json');
  const items = [], blindItems = [], rows = [], authorCases = [];
  for (let index = 0; index < prior.items.length; index++) {
    const row = prior.items[index], old = row.candidate;
    const patch = overrides.changes.find(change => change.index === index);
    const blueprint = authorBlueprints.items[index];
    if (!patch) throw new Error('Every candidate requires explicit output specification');
    const candidate = structuredClone(old);
    candidate.revision = 'FQ11-DCP-candidate-2';
    candidate.prior_revision_sha256 = sha256(serialize(old));
    candidate.repair_evidence_sha256 = judgeSeal;
    candidate.instruction = patch.instruction;
    const commands = patch.instruction.split(/\([1-4]\)/u).slice(1);
    if (commands.length !== 4) throw new Error('Exactly four concrete output commands required');
    candidate.required_outputs = commands.map((command, outputIndex) => ({ component_id: `c${outputIndex + 1}`, command: command.trim() }));
    candidate.rubric.revision = 'FQ11-DCP-rubric-2';
    candidate.rubric.components = patch.components ?? candidate.rubric.components;
    candidate.rubric.required_outputs_hash = sha256(serialize(candidate.required_outputs));
    candidate.rubric.qualifications_not_student_score_requirements = ['research_TASK_certification', 'human_Gold_validation', 'legal_release', 'whole_source_scientific_certification'];
    candidate.rubric.unrequested_metadata_omission_penalty = false;
    candidate.rubric.observation_rule = 'A required meaning must be interpretable in the actual response. Merely naming its wording or saying it is preserved does not demonstrate its meaning. Correct subset is preserved as partial; absent component is defer; explicit contradiction remains defect on that component.';
    candidate.learner_display = sourceDisplay(row.original, old);
    candidate.stimulus.array_entries_not_displayed_as_complete_sentences = true;
    candidate.contrast_stimuli = {
      source_sentence: old.stimulus.target_sentence,
      constructed_alternative_sentence: row.original.item.payload.sentences[row.original.item.payload.underlines[row.original.item.answer_key.position - 1].sentenceIdx],
      alternative_status: 'explicit_constructed_counterstatement_not_original_source_fact',
    };
    candidate.sourcewide_AI_validation = judge.dcp.items[index].source_reading.coverage === 'full' ? 'prior_AI_full_local_body_read_not_external_scientific_certification' : 'HOLD_prior_only_bounded_context_read';
    candidate.review_status = 'revision2_author_repair_pending_new_AI_rereview';
    const errors = validateRevision2(candidate, row.original, old);
    if (errors.length) throw new Error(`${index}: ${errors.join(',')}`);
    const oldCases = priorBlind.items[index].verification_cases;
    const fullResponse = patch.full_response ?? blueprint.equivalent_response;
    const responses = [fullResponse, oldCases[1].response, oldCases[2].response, oldCases[3].response, `${fullResponse} ${oldCases[2].response}`];
    const cases = responses.map((response, caseIndex) => ({
      case_id: `${row.original.id}-v2-case-${caseIndex + 1}`, response,
      development_parent_case_id: oldCases[caseIndex].case_id,
      exact_response_reused: response === oldCases[caseIndex].response,
      population: 'reused_or_revised_development_synthetic_case_not_new_confirmatory_student_data',
      independent_first_real_student_response: false,
    }));
    const expected = ['meets', 'partial', 'defect', 'defer', 'defect'];
    authorCases.push(...cases.map((one, caseIndex) => ({ ...one, author_expected_whole_state: expected[caseIndex],
      author_scope: 'development expectation for revised requirements; not overwrite of original author or independent first' })));
    const hash = sha256(serialize(candidate));
    items.push({ original_item_id: row.original.id, original_source: row.original.source, candidate, candidate_sha256: hash });
    blindItems.push({ candidate, candidate_sha256: hash, source: row.original.source, verification_cases: cases });
    rows.push({ item_id: row.original.id, content_id: candidate.content_id,
      prior_revision: old.revision, prior_revision_sha256: candidate.prior_revision_sha256,
      new_revision: candidate.revision, new_sha256: hash, new_task: candidate.task_id,
      new_role: candidate.requested_role, original_unique_error_role_retired: candidate.original_unique_error_role_retired,
      source_body_sha256: candidate.source.body_sha256,
      prior_source_reading_coverage: judge.dcp.items[index].source_reading.coverage,
      sourcewide_validation: candidate.sourcewide_AI_validation,
      current_source_display_bound: true, sentence_segmentation_display_fixed: [2, 3, 7].includes(index),
      required_output_components: candidate.required_outputs.length,
      source_operational_hold: candidate.source_operational_hold,
      independent_AI_rereview: 'pending', human_review: false,
      student_validation: false, public_qualified: false, assessment_qualified: false });
  }
  const hashes = {
    candidates_sha256: writeFrozen(path.join(local, 'dcp-repairs-v2-candidates-first.json'), { version: 'FQ11-DCP-repair-candidates-2', prior_independent_seal: judgeSeal, items }),
    blind_sha256: writeFrozen(path.join(local, 'dcp-repairs-v2-blind-first.json'), { version: 'FQ11-DCP-blind-2',
      scope: 'New independent AI rereview of revised same-source development materials. Reused/revised synthetic cases are NOT new confirmatory cases. No author expected verdicts or prior independent verdicts supplied. Original sourcewide, human, rights, student, provenance and runtime holds remain.', items: blindItems }),
    authored_cases_sha256: writeFrozen(path.join(local, 'dcp-repairs-v2-author-cases-first.json'), { version: 'FQ11-DCP-development-expectations-2', cases: authorCases }),
  };
  const publicResult = {
    version: 'FQ11-DCP-repairs-2', prior_independent_seal: judgeSeal, hashes,
    new_content_revisions: items.length, prior_candidates_preserved: true,
    revised_or_reused_development_cases: authorCases.length,
    exact_response_reused: authorCases.filter(one => one.exact_response_reused).length,
    response_revised: authorCases.filter(one => !one.exact_response_reused).length,
    new_confirmatory_cases: 0, prior_full_bodies_read: 5, prior_bounded_contexts_only: 7,
    independent_rereview_completed: 0, sourcewide_holds_unchanged: 7,
    human_validated: 0, actual_students: 0, public_qualified: 0, assessment_qualified: 0,
    items: rows,
  };
  writeFrozen(path.join(data, 'dcp-repairs-v2.json'), publicResult);
  return publicResult;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = build();
  console.log(JSON.stringify({ revisions: output.new_content_revisions,
    hashes: output.hashes, development_cases: output.revised_or_reused_development_cases,
    exact_reused: output.exact_response_reused, revised: output.response_revised,
    confirmatory: 0, sourcewide_holds: output.sourcewide_holds_unchanged, independent_review: 'pending' }));
}
