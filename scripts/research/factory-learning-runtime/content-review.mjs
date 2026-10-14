// scripts/research/factory-learning-runtime/content-review.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';

export const AXES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

/** Validate a manually written evidence record; this is not an automatic semantic grader. */
export function validateReview(review) {
  if (review?.version !== 'FQR1-content-first1' || !/^[a-f0-9]{64}$/.test(review.input_sha256 ?? '')) throw new Error('Unbound first review');
  if (!Array.isArray(review.items) || review.items.length === 0) throw new Error('No reviewed items');
  const ids = new Set();
  for (const item of review.items) {
    if (!item.id || ids.has(item.id)) throw new Error('Missing/duplicate item ID');
    ids.add(item.id);
    if (!item.type || !item.coverage || !item.findings || !Array.isArray(item.private_evidence)) throw new Error(`Incomplete review ${item.id}`);
    for (const axis of AXES) {
      const judgment = item.axes?.[axis];
      if (!['pass', 'fail', 'unknown', 'not_applicable'].includes(judgment?.state) || !judgment.reason) throw new Error(`Missing ${axis} evidence ${item.id}`);
    }
    if (item.public_qualified !== false || item.assessment_qualified !== false) throw new Error('Research review cannot authorize release');
  }
  return true;
}

/** Only explicit, source-checked alternatives are candidates for deterministic scoring. */
export function judgeDeclaredAnswer(response, policy) {
  if (!policy || policy.semantic_review !== 'pass' || !Array.isArray(policy.accepted) || !policy.accepted.length) return { status: 'scoring_error', code: 'UNVALIDATED_ANSWER_POLICY' };
  if (typeof response !== 'string') return { status: 'scoring_error', code: 'INVALID_RESPONSE_SHAPE' };
  const normalize = text => {
    let result = text.normalize('NFC');
    if (policy.trim === true) result = result.trim();
    if (policy.collapse_spaces === true) result = result.replace(/\s+/gu, ' ');
    if (policy.case_insensitive === true) result = result.toLocaleLowerCase('en-US');
    return result;
  };
  if (!normalize(response)) return { status: 'defer', code: 'NO_OBSERVABLE_RESPONSE' };
  return policy.accepted.some(answer => normalize(answer) === normalize(response))
    ? { status: 'correct', code: 'DECLARED_ACCEPTED_ANSWER' }
    : { status: 'defer', code: 'UNLISTED_ANSWER_REQUIRES_REVIEW' };
}

/** Preserve observed components. Missing evidence and system errors are never student defects. */
export function aggregateComponents(states) {
  if (!Array.isArray(states) || !states.length || states.some(state => !['correct', 'incorrect', 'defer', 'scoring_error'].includes(state))) return 'scoring_error';
  if (states.includes('scoring_error')) return 'scoring_error';
  if (states.includes('incorrect')) return 'incorrect';
  if (states.every(state => state === 'correct')) return 'correct';
  if (states.includes('correct')) return 'partial';
  return 'defer';
}

export function publicReview(review, firstSha256) {
  validateReview(review);
  return {
    version: 'FQR1-content-review1',
    first_sha256: firstSha256,
    input_sha256: review.input_sha256,
    denominator: { items: review.items.length, new_actual_items_only: true },
    items: review.items.map(item => ({
      id: item.id, type: item.type, kind: item.kind,
      coverage: item.coverage,
      structure: item.structure,
      axes: item.axes,
      failure_codes: item.findings.map(finding => finding.code),
      task_fit: item.task_fit,
      runner_support: item.runner_support,
      grading_support: item.grading_support,
      feedback_support: item.feedback_support,
      public_qualified: false, assessment_qualified: false,
    })),
    counts: Object.fromEntries(AXES.map(axis => [axis, Object.fromEntries(['pass', 'fail', 'unknown', 'not_applicable'].map(state => [state, review.items.filter(item => item.axes[axis].state === state).length]))])),
    limits: ['AI content review only', 'No human/student/rights authorization', 'Purposive sample: no population defect-rate inference'],
  };
}

export function checkFirst(firstPath, expectedSha256) {
  const bytes = fs.readFileSync(firstPath);
  if (sha256(bytes) !== expectedSha256) throw new Error('First review changed');
  const review = JSON.parse(bytes);
  validateReview(review);
  return review;
}
