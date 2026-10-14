// scripts/research/factory-qualification-v11/dcp-repairs-v4.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, serialize } from './dcp-repairs.mjs';
import { validateCandidate3 } from './dcp-repairs-v3.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const local = path.join(root, 'scripts/research/factory-qualification-v11/local');
const data = path.join(root, 'docs/research/factory-qualification-v11/data');
const thirdSeal = '61732f0c9d615ab05d0c3c12dc027840543eb9e8e9269259b7f6a8577af94947';
const load = name => JSON.parse(fs.readFileSync(path.join(local, name), 'utf8'));

export function buildFeedback(priorCandidate, blueprint) {
  const words = priorCandidate.source_target_sentence.split(' ');
  const { content_clause_start_token: start, predicate_start_token: predicate } = blueprint.clauses;
  const clause = words.slice(start).join(' ').replace(/[.]$/u, '');
  const subject = words.slice(start, predicate).join(' ');
  const verbal = words.slice(predicate).join(' ').replace(/[.]$/u, '');
  if (!clause || !subject || !verbal || `${subject} ${verbal}` !== clause) throw new Error('Invalid observed source clause spans');
  const outputs = blueprint.outputs.map((output, index) => ({ id: output.id,
    text: index === 1 ? `${output.text_prefix}[${clause}]` : index === 2 ? `주어: [${subject}]. 서술부: [${verbal}]. ${output.text_suffix}` : output.text }));
  return { revision: 'FQ11-DCP-served-feedback-4', outputs,
    source_spans: { source_target_sentence_sha256: sha256(priorCandidate.source_target_sentence),
      content_clause_start_token: start, predicate_start_token: predicate,
      clause_text: clause, subject_text: subject, predicate_text: verbal },
    semantic_contract: blueprint.semantic_contract,
    author_assembled_reference_not_human_validated: true };
}

export function validateCandidate4(candidate, original, priorCandidate, blueprint) {
  const temporary = structuredClone(candidate);
  temporary.revision = 'FQ11-DCP-candidate-3';
  const errors = validateCandidate3(temporary, original, priorCandidate, load('dcp-v3-author-blueprint.json').prohibited_absolute_claims);
  if (candidate.revision !== 'FQ11-DCP-candidate-4') errors.push('revision4');
  if (sha256(serialize(candidate.rubric)) !== sha256(serialize(priorCandidate.rubric))) errors.push('unrequested_rubric_change');
  const expectedFeedback = buildFeedback(priorCandidate, blueprint);
  if (sha256(serialize(candidate.served_feedback)) !== sha256(serialize(expectedFeedback))) errors.push('feedback_source_or_semantic_contract');
  if (candidate.served_feedback.outputs.map(output => output.id).join('/') !== 'c1/c2/c3/c4') errors.push('feedback_component_completeness');
  if (candidate.explanation !== candidate.served_feedback.outputs.map((output, index) => `${index + 1}. ${output.text}`).join('\n')) errors.push('served_feedback_not_actual_explanation');
  if (candidate.instruction !== priorCandidate.instruction || candidate.task_id !== priorCandidate.task_id) errors.push('instruction_TASK_change');
  return errors;
}

function frozen(file, value) {
  const bytes = serialize(value);
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error(`Frozen output changed ${path.basename(file)}`);
  } else fs.writeFileSync(file, bytes, { flag: 'wx' });
  return sha256(bytes);
}

export function build() {
  const thirdBytes = fs.readFileSync(path.join(local, 'revision3-review-combined-first.json'));
  if (sha256(thirdBytes) !== thirdSeal) throw new Error('Third independent seal changed');
  const packet3 = load('dcp-v3-candidate-first.json');
  const prior = packet3.candidate;
  const blueprint = load('dcp-v4-feedback-blueprint.json');
  const candidate = structuredClone(prior);
  candidate.revision = 'FQ11-DCP-candidate-4';
  candidate.prior_revision_sha256 = sha256(serialize(prior));
  candidate.repair_evidence_sha256 = thirdSeal;
  candidate.served_feedback = buildFeedback(prior, blueprint);
  candidate.explanation = candidate.served_feedback.outputs.map((output, index) => `${index + 1}. ${output.text}`).join('\n');
  candidate.teacher_notes = `${prior.teacher_notes} Optional legacy alternative analysis remains in legacy_variant.alternative_analysis; it is not a required learner answer or universal incorrectness claim.`;
  candidate.review_status = 'revision4_complete_feedback_pending_fresh_AI_review';
  const errors = validateCandidate4(candidate, packet3.original, prior, blueprint);
  if (errors.length) throw new Error(errors.join(','));
  const caseIndices = [0, 2, 4, 5, 6];
  const oldCases = load('dcp-v3-blind-first.json').items[0].verification_cases;
  const cases = caseIndices.map((oldIndex, index) => ({
    case_id: `${packet3.original.id}-v4-case-${index + 1}`, response: oldCases[oldIndex].response,
    development_parent_case_id: oldCases[oldIndex].case_id,
    population: 'unchanged_development_synthetic_response_not_student_not_confirmatory',
    exact_prior_response_reused: true, genuine_unseen_student_attempt: false,
  }));
  const candidateHash = sha256(serialize(candidate));
  const hashes = {
    candidates_sha256: frozen(path.join(local, 'dcp-v4-candidate-first.json'), { version: 'FQ11-DCP-repair-candidate-4', original: packet3.original,
      candidate, candidate_sha256: candidateHash, prior_third_independent_seal: thirdSeal }),
    blind_sha256: frozen(path.join(local, 'dcp-v4-blind-first.json'), { version: 'FQ11-DCP-blind-4',
      scope: 'Fresh AI rereview of one complete four-output feedback revision with unchanged instruction/rubric and five unchanged development synthetic cases. No author expected verdicts or prior reviewer response verdicts supplied. Preserve sourcewide, human, rights, student, provenance, runtime and original unique-error role holds.',
      items: [{ candidate, candidate_sha256: candidateHash, source: packet3.original.source, verification_cases: cases }] }),
  };
  const result = {
    version: 'FQ11-DCP-repairs-4', old_item_id: packet3.original.id, content_id: candidate.content_id,
    prior_revision: prior.revision, prior_revision_sha256: candidate.prior_revision_sha256,
    new_revision: candidate.revision, new_content_sha256: candidateHash, hashes,
    new_content_revisions: 1, new_unique_content_items: 0,
    repair_scope: 'complete_served_four_output_explanation_only',
    instruction_unchanged: true, task_unchanged: true, rubric_unchanged: true,
    feedback_components: 4, development_cases: 5, exact_prior_response_reused: 5,
    new_confirmatory_cases: 0, prior_third_independent_seal: thirdSeal,
    original_key_wrong_confirmed: false, original_unique_error_role: 'HOLD',
    sourcewide_validation: 'HOLD', independent_AI_revalidated: 0,
    human_validated: 0, actual_students: 0, public_qualified: 0, assessment_qualified: 0,
  };
  frozen(path.join(data, 'dcp-repairs-v4.json'), result);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = build();
  console.log(JSON.stringify({ hashes: result.hashes, revisions: 1, new_content: 0,
    feedback_components: 4, development_cases: 5, independent_review: 'pending', original_unique_role: 'HOLD' }));
}
