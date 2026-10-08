// scripts/textbook/frym-benchmark/reference-analysis-revision.mjs
import { AXES, hash } from './benchmark.mjs'
import { admitReference } from './reference-admission.mjs'
import { assessReferenceCalibration } from './reference-calibration.mjs'

const fail = code => { throw Error(code) }

export function reviseReferenceAnalysis(admission, evidence) {
  const old = admitReference(admission.input)
  if (hash(old.receipt) !== hash(admission.receipt) ||
      hash(old.reference) !== hash(admission.reference)) fail('REVISION_PARENT_STALE')
  const decision = assessReferenceCalibration({ admission, evidence })
  if (decision.stages.rating_independence_eligible.reason !== 'RATING_ANALYSIS_REVISION_REQUIRED')
    fail('REVISION_RATING_EVIDENCE_REQUIRED')
  const rating = evidence.rating
  const metrics = {}, axis_agreement = {}, ordinal_reviews = {}
  for (const axis of AXES) {
    const row = rating.axis_reviews[axis]
    const resolved = row.rater_a === row.rater_b ? row.rater_a : row.adjudicated
    metrics[axis] = resolved
    const scale = admission.input.codebook.axes[axis]
    const span = scale.scale === 'ordinal' ? scale.levels.length - 1 : scale.valid_max - scale.valid_min
    axis_agreement[axis] = 1 - Math.abs(row.rater_a - row.rater_b) / Math.max(1, span)
    ordinal_reviews[axis] = {
      rater_a_id: rating.reviewers[0].id, rater_b_id: rating.reviewers[1].id,
      rater_a: row.rater_a, rater_b: row.rater_b,
      ...(row.rater_a !== row.rater_b ?
        { adjudicator_id: rating.adjudication.id, adjudicated: resolved } : {}),
    }
  }
  const analysis = { ...admission.input.analysis,
    analyzer_version: 'cross-family-adjudicated-revision/1',
    evidence_hash: hash({ parent_admission_receipt_hash: old.reference.admission_receipt_hash,
      rating_evidence_hash: hash(rating), metrics, axis_agreement, ordinal_reviews }),
    metrics, axis_agreement, ordinal_reviews,
    rater_independence: 'independent_model_families' }
  const input = { ...admission.input, analysis }
  const revised = admitReference(input)
  if (revised.reference.admission_receipt_hash === old.reference.admission_receipt_hash)
    fail('REVISION_RECEIPT_UNCHANGED')
  const changed_axes = AXES.filter(axis =>
    admission.input.analysis.metrics[axis] !== analysis.metrics[axis])
  const lineage = { schema: 'reference-analysis-revision/1',
    candidate_id: old.receipt.candidate_id,
    parent_admission_receipt_hash: old.reference.admission_receipt_hash,
    parent_analysis_hash: old.receipt.analysis_hash,
    admission_receipt_hash: revised.reference.admission_receipt_hash,
    analysis_hash: revised.receipt.analysis_hash,
    rating_evidence_hash: hash(rating),
    rights_review_hash: hash(evidence.rights ?? null),
    grade_review_hash: hash(evidence.grade_mapping ?? null),
    changed_axes,
    stale_effect: 'parent calibration decision and packets cannot be reused for revised admission',
    calibration_eligible: false, benchmark_cohort_eligible: false }
  return { input, receipt: revised.receipt, reference: revised.reference,
    lineage: { ...lineage, lineage_hash: hash(lineage) } }
}
