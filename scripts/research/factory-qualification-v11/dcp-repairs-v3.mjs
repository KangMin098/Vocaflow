// scripts/research/factory-qualification-v11/dcp-repairs-v3.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, serialize, normalize } from './dcp-repairs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const local = path.join(root, 'scripts/research/factory-qualification-v11/local');
const data = path.join(root, 'docs/research/factory-qualification-v11/data');
const secondSeal = 'f3e10c7c7a24af78ae2fe778caa52da6adf7ba303412f42bcb4557d1d1970033';
const load = name => JSON.parse(fs.readFileSync(path.join(local, name), 'utf8'));

export function validateCandidate3(candidate, original, priorCandidate, prohibitedAbsoluteClaims = []) {
  const errors = [];
  if (candidate.revision !== 'FQ11-DCP-candidate-3') errors.push('revision');
  if (candidate.prior_revision_sha256 !== sha256(serialize(priorCandidate))) errors.push('prior_revision_hash');
  if (candidate.source.body_sha256 !== sha256(original.source.content)) errors.push('source_body_hash');
  if (normalize(original.source.content).slice(candidate.learner_display.normalized_start, candidate.learner_display.normalized_end) !== candidate.learner_display.text) errors.push('source_display');
  if (!normalize(original.source.content).includes(normalize(candidate.source_target_sentence))) errors.push('source_target_sentence');
  if (candidate.legacy_variant.unconditionally_ungrammatical !== false) errors.push('universal_variant_agrammaticality');
  if (candidate.legacy_variant.unique_wrong_choice_established !== false) errors.push('legacy_uniqueness_promotion');
  if (candidate.legacy_variant.original_key_wrong_confirmed !== false) errors.push('unjustified_key_error');
  if (candidate.legacy_variant.source_equivalence !== 'not_established_changed_subject_reference') errors.push('source_equivalence');
  if (!candidate.original_unique_error_role_retired || candidate.requested_role !== 'guided_practice') errors.push('role_reinstatement');
  if (candidate.rubric.grade_optional_alternative_comment_by_word_match || candidate.rubric.require_legacy_invalidity_response) errors.push('word_match_or_hidden_output');
  if (candidate.source.historical_generation_revision !== null) errors.push('historical_provenance');
  if (candidate.required_outputs.length !== 4 || candidate.rubric.required_outputs_hash !== sha256(serialize(candidate.required_outputs))) errors.push('output_rubric_binding');
  const assertions = `${candidate.explanation} ${candidate.teacher_notes}`;
  if (prohibitedAbsoluteClaims.some(claim => assertions.includes(claim))) errors.push('universal_wrong_assertion');
  if (candidate.public_qualified || candidate.assessment_qualified || candidate.rubric.human_validated || candidate.rubric.student_validated) errors.push('unauthorized_promotion');
  return errors;
}

function frozen(file, value) {
  const bytes = serialize(value);
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error(`Refuse overwrite: ${path.basename(file)}`);
  } else fs.writeFileSync(file, bytes, { flag: 'wx' });
  return sha256(bytes);
}

export function build() {
  const secondBytes = fs.readFileSync(path.join(local, 'revision2-combined-review-first.json'));
  if (sha256(secondBytes) !== secondSeal) throw new Error('Second independent first changed');
  const original = JSON.parse(fs.readFileSync(path.join(root, 'scripts/research/factory-qualification/local/dcp-main-input.json'), 'utf8')).items[1];
  const priorPacket = load('dcp-repairs-v2-candidates-first.json');
  const prior = priorPacket.items.find(row => row.original_item_id === original.id).candidate;
  const blueprint = load('dcp-v3-author-blueprint.json');
  const candidate = structuredClone(prior);
  candidate.revision = 'FQ11-DCP-candidate-3';
  candidate.prior_revision_sha256 = sha256(serialize(prior));
  candidate.repair_evidence_sha256 = secondSeal;
  candidate.instruction = blueprint.instruction;
  const commands = blueprint.instruction.split(/\([1-4]\)/u).slice(1);
  if (commands.length !== 4) throw new Error('Four commands required');
  candidate.required_outputs = commands.map((command, index) => ({ component_id: `c${index + 1}`, command: command.trim() }));
  candidate.rubric.revision = 'FQ11-DCP-rubric-3';
  candidate.rubric.components = blueprint.components;
  candidate.rubric.required_outputs_hash = sha256(serialize(candidate.required_outputs));
  candidate.rubric.require_legacy_invalidity_response = false;
  candidate.rubric.grade_optional_alternative_comment_by_word_match = false;
  candidate.rubric.optional_alternative_comment_policy = 'A contextually qualified alternative interpretation is not wrong because it contains the formerly mutated word. Optional comments are not required outputs. Explicit contradictions of the source-clause function, boundaries, subject or modal force remain component defects; unresolved optional contextual reference is a separate HOLD, not a fabricated student error.';
  candidate.explanation = blueprint.explanation;
  candidate.teacher_notes = 'Judge the four requested original-source outputs. Do not require or manufacture syntactic impossibility of the legacy constructed variant. Correct original reading does not validate original single-error uniqueness.';
  candidate.source_target_sentence = prior.contrast_stimuli.source_sentence;
  delete candidate.contrast_stimuli;
  candidate.legacy_variant = {
    constructed_sentence: original.item.payload.sentences[original.item.payload.underlines[original.item.answer_key.position - 1].sentenceIdx],
    intended_source_restoration_matches: true,
    alternative_analysis: blueprint.alternative_analysis,
    unconditionally_ungrammatical: false, unique_wrong_choice_established: false,
    original_key_wrong_confirmed: false,
    source_equivalence: 'not_established_changed_subject_reference',
    requested_unique_error_role: 'HOLD',
    learner_task_input: false,
  };
  candidate.original_unique_error_role_retired = true;
  candidate.retired_role_reason = 'Original source restoration matches, but contextual and grammatical uniqueness of the old single-error role is not established; preserve HOLD without declaring wrong position/key.';
  candidate.review_status = 'revision3_pending_fresh_AI_review';
  candidate.author_source_reading = { coverage: 'full_supplied_local_body', characters: original.source.content.length,
    external_original: 'not_verified', figures_and_scientific_validity: 'not_certified',
    meaning_validation_claim_scope: 'bound_source_sentence_and_clause_not_whole_scientific_document_approval' };
  candidate.sourcewide_AI_validation = 'HOLD_no_independent_whole_source_or_external_science_approval';
  const errors = validateCandidate3(candidate, original, prior, blueprint.prohibited_absolute_claims);
  if (errors.length) throw new Error(errors.join(','));
  const previousCases = load('dcp-repairs-v2-blind-first.json').items.find(row => row.candidate.original_item_id === original.id).verification_cases;
  const cases = blueprint.cases.map((one, index) => ({
    case_id: `${original.id}-v3-case-${index + 1}`, response: one.response,
    population: 'development_synthetic_same_source_not_student_not_confirmatory',
    exact_prior_response_reused: previousCases.some(previous => previous.response === one.response),
    genuine_unseen_student_attempt: false,
  }));
  const hash = sha256(serialize(candidate));
  const privatePacket = { version: 'FQ11-DCP-repair-candidate-3', original, candidate, candidate_sha256: hash,
    source_reading_receipt: candidate.author_source_reading, prior_second_independent_seal: secondSeal };
  const blind = { version: 'FQ11-DCP-blind-3',
    scope: 'Fresh independent AI same-source development review of one source-provided clause-scope guided candidate and eight synthetic cases; not new confirmatory items. No author case verdicts or prior reviewer case verdicts supplied. Preserve alternative reference uncertainty instead of forced incorrect-choice claims.',
    items: [{ candidate, candidate_sha256: hash, source: original.source, verification_cases: cases }] };
  const hashes = {
    candidates_sha256: frozen(path.join(local, 'dcp-v3-candidate-first.json'), privatePacket),
    blind_sha256: frozen(path.join(local, 'dcp-v3-blind-first.json'), blind),
    authored_cases_sha256: frozen(path.join(local, 'dcp-v3-author-cases-first.json'), { version: 'FQ11-DCP-development-expectations-3',
      cases: cases.map((one, index) => ({ ...one, author_expected_whole_state: blueprint.cases[index].expected })) }),
  };
  const publicResult = {
    version: 'FQ11-DCP-repairs-3', old_item_id: original.id,
    content_id: candidate.content_id, prior_revision: prior.revision,
    prior_revision_sha256: candidate.prior_revision_sha256,
    new_revision: candidate.revision, new_content_sha256: hash,
    task_id: candidate.task_id, role: candidate.requested_role,
    original_source_body_sha256: candidate.source.body_sha256,
    original_generation_provenance: 'unknown',
    prior_second_independent_seal: secondSeal, hashes,
    new_content_revisions: 1, new_development_synthetic_cases: cases.length,
    exact_prior_response_reused: cases.filter(one => one.exact_prior_response_reused).length,
    new_confirmatory_cases: 0,
    original_key_restoration_match: true, original_key_wrong_confirmed: false,
    original_unique_error_role: 'HOLD', changed_subject_alternative: 'possible_parse_not_universal_wrong',
    sourcewide_validation: 'HOLD', independent_AI_revalidated: 0,
    human_validated: 0, actual_students: 0, public_qualified: 0, assessment_qualified: 0,
  };
  frozen(path.join(data, 'dcp-repairs-v3.json'), publicResult);
  return publicResult;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = build();
  console.log(JSON.stringify({ revisions: 1, development_cases: 8, hashes: output.hashes,
    unique_error_role: 'HOLD', sourcewide: 'HOLD', independent_review: 'pending' }));
}
