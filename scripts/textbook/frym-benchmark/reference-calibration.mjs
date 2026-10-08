// scripts/textbook/frym-benchmark/reference-calibration.mjs
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { AXES, GRADES, hash } from './benchmark.mjs'
import { admitReference } from './reference-admission.mjs'
import { assertExternalCandidate } from './local-candidate-path.mjs'

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const filled = value => typeof value === 'string' && value.trim().length > 0
const fail = code => { throw Error(code) }
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const answerField = value => value && typeof value === 'object' && Object.entries(value).some(([key, child]) =>
  /^(answer|correct|rationale|explanation|scoring_key)$/i.test(key) || answerField(child))
const blindQuestions = questions => questions.map(({ id, type, stem, options }) => {
  if (options === undefined) return { id, type, stem }
  if (!Array.isArray(options) || !options.every(option => typeof option === 'string' ||
      typeof option?.text === 'string')) fail('CALIBRATION_BLIND_OPTIONS_INVALID')
  return { id, type, stem, options: options.map(option =>
    typeof option === 'string' ? option : option.text) }
})
const evidenceFile = (path, expectedHash, code) => {
  if (!filled(path) || !hex(expectedHash)) fail(code)
  assertExternalCandidate(path)
  let bytes
  try { bytes = readFileSync(path) } catch { fail(code) }
  if (sha(bytes) !== expectedHash) fail(code)
  return bytes
}

export function buildCalibrationPackets(input, admission) {
  if (answerField(input.codebook)) fail('CALIBRATION_CODEBOOK_ANSWER_LEAK')
  const shared = { schema: 'reference-calibration-packet/1', candidate_id: admission.receipt.candidate_id,
    admission_receipt_hash: admission.reference.admission_receipt_hash,
    passage_hash: admission.receipt.passage_hash,
    analysis_hash: admission.receipt.analysis_hash, codebook_hash: admission.receipt.codebook_hash }
  const packet = (kind, extra = {}) => {
    const body = { ...shared, kind, ...extra }
    return { ...body, packet_hash: hash(body) }
  }
  const blind = { passage_text: input.candidate.passage_text,
    questions: blindQuestions(input.candidate.questions),
    codebook: input.codebook }
  return {
    rights: packet('rights', { file_hash: admission.receipt.file_hash,
      item_set_hash: admission.receipt.item_set_hash, rights_basis: admission.reference.rights_basis }),
    grade: packet('grade', { source_grade_scope: admission.receipt.grade_scope,
      grade_source_hash: admission.receipt.grade_source_hash,
      grade_label_system: admission.receipt.grade_label_system }),
    'rater-a': packet('rater-a', blind), 'rater-b': packet('rater-b', blind),
  }
}

export function buildAdjudicationPacket(input, admission, reviewers) {
  if (answerField(input.codebook)) fail('CALIBRATION_CODEBOOK_ANSWER_LEAK')
  if (!Array.isArray(reviewers) || reviewers.length !== 2 ||
      reviewers.some(row => !hex(row?.output_hash) || !row.ratings))
    fail('CALIBRATION_RATER_OUTPUTS_REQUIRED')
  const body = { schema: 'reference-calibration-packet/1', kind: 'adjudication',
    candidate_id: admission.receipt.candidate_id,
    admission_receipt_hash: admission.reference.admission_receipt_hash,
    passage_hash: admission.receipt.passage_hash, analysis_hash: admission.receipt.analysis_hash,
    codebook_hash: admission.receipt.codebook_hash,
    passage_text: input.candidate.passage_text,
    questions: blindQuestions(input.candidate.questions),
    codebook: input.codebook,
    rater_a: { output_hash: reviewers[0].output_hash, ratings: reviewers[0].ratings },
    rater_b: { output_hash: reviewers[1].output_hash, ratings: reviewers[1].ratings } }
  return { ...body, packet_hash: hash(body) }
}

function rightsStatus(rights, admission) {
  if (!rights) return { status: 'hold', reason: 'RIGHTS_EVIDENCE_MISSING' }
  if (rights.source_file_hash !== admission.receipt.file_hash ||
      rights.passage_hash !== admission.receipt.passage_hash ||
      rights.item_set_hash !== admission.receipt.item_set_hash)
    fail('CALIBRATION_RIGHTS_STALE')
  if (!['authorized', 'unknown', 'excluded'].includes(rights.source_rights) ||
      !['authorized', 'unknown', 'excluded'].includes(rights.passage_rights) ||
      !['absent', 'cleared', 'unknown', 'present_uncleared'].includes(rights.third_party_content) ||
      !['documented', 'reviewed_inference', 'unknown'].includes(rights.rights_confidence))
    fail('CALIBRATION_RIGHTS_INVALID')
  if (rights.source_rights === 'excluded' || rights.passage_rights === 'excluded' ||
      rights.third_party_content === 'present_uncleared')
    return { status: 'reject', reason: 'RIGHTS_EXCLUDED' }
  if (rights.source_rights !== 'authorized' || rights.passage_rights !== 'authorized' ||
      !['absent', 'cleared'].includes(rights.third_party_content) ||
      rights.rights_confidence !== 'documented' || !hex(rights.source_evidence_hash) ||
      !hex(rights.passage_evidence_hash))
    return { status: 'hold', reason: 'RIGHTS_NOT_DOCUMENTED_FOR_CALIBRATION' }
  evidenceFile(rights.source_evidence_path, rights.source_evidence_hash, 'CALIBRATION_SOURCE_RIGHTS_CHANGED')
  evidenceFile(rights.passage_evidence_path, rights.passage_evidence_hash, 'CALIBRATION_PASSAGE_RIGHTS_CHANGED')
  return { status: 'pass', reason: null }
}

function gradeStatus(mapping, admission) {
  if (!mapping) return { status: 'hold', reason: 'GRADE_MAPPING_MISSING' }
  if (mapping.source_grade_scope_hash !== hash(admission.receipt.grade_scope) ||
      mapping.grade_source_hash !== admission.receipt.grade_source_hash)
    fail('CALIBRATION_GRADE_ANCHOR_STALE')
  if (mapping.source_grade_scope?.label_system !== admission.receipt.grade_label_system ||
      mapping.source_grade_scope?.source_hash !== admission.receipt.grade_source_hash ||
      !Array.isArray(mapping.source_grade_scope?.labels) ||
      mapping.source_grade_scope.labels.length !== admission.receipt.grade_scope.grades.length ||
      hash(mapping.source_grade_scope.labels) !== hash(admission.receipt.grade_scope.grades) ||
      new Set(mapping.source_grade_scope.labels).size !== mapping.source_grade_scope.labels.length ||
      !['verified', 'unverified', 'rejected'].includes(mapping.status))
    fail('CALIBRATION_GRADE_MAPPING_INVALID')
  if (mapping.status === 'rejected') return { status: 'reject', reason: 'GRADE_MAPPING_REJECTED' }
  if (mapping.status !== 'verified' || !hex(mapping.mapping_evidence_hash) ||
      !filled(mapping.reviewer_id) ||
      !Array.isArray(mapping.anchor_sources) || mapping.anchor_sources.length < 2 ||
      new Set(mapping.anchor_sources.map(row => row?.source_id)).size !== mapping.anchor_sources.length ||
      mapping.anchor_sources.some(row => !filled(row?.source_id) || !hex(row?.evidence_hash)) ||
      !Array.isArray(mapping.korean_target_mapping) ||
      mapping.korean_target_mapping.length !== admission.receipt.grade_scope.grades.length ||
      mapping.korean_target_mapping.some(row => !filled(row?.source_grade) ||
        !GRADES.includes(row?.korean_grade) ||
        !mapping.source_grade_scope.labels.includes(row.source_grade)) ||
      new Set(mapping.korean_target_mapping.map(row => row.source_grade)).size !== mapping.korean_target_mapping.length)
    return { status: 'hold', reason: 'KOREAN_GRADE_EQUIVALENCE_UNVERIFIED' }
  evidenceFile(mapping.mapping_evidence_path, mapping.mapping_evidence_hash, 'CALIBRATION_GRADE_MAPPING_CHANGED')
  for (const anchor of mapping.anchor_sources)
    evidenceFile(anchor.evidence_path, anchor.evidence_hash, 'CALIBRATION_GRADE_ANCHOR_CHANGED')
  return { status: 'pass', reason: null }
}

function ratingStatus(rating, admission) {
  if (!rating) return { status: 'hold', reason: 'RATING_REVIEW_MISSING' }
  if (rating.analysis_hash !== admission.receipt.analysis_hash ||
      rating.codebook_hash !== admission.receipt.codebook_hash)
    fail('CALIBRATION_RATING_STALE')
  if (!Array.isArray(rating.reviewers) || rating.reviewers.length !== 2 ||
      rating.reviewers.some(row => !filled(row?.id) || !filled(row?.model_family) ||
        !filled(row?.invocation_id) || !hex(row?.output_hash) ||
        !hex(row?.invocation_evidence_hash) ||
        AXES.some(axis => !Number.isFinite(row.ratings?.[axis]))) ||
      rating.reviewers[0].id === rating.reviewers[1].id)
    fail('CALIBRATION_RATING_INVALID')
  if (rating.reviewers[0].model_family === rating.reviewers[1].model_family)
    return { status: 'hold', reason: 'RATERS_SAME_MODEL_FAMILY' }
  if (rating.reviewers[0].invocation_id === rating.reviewers[1].invocation_id ||
      rating.reviewers[0].output_hash === rating.reviewers[1].output_hash)
    fail('CALIBRATION_RATER_INDEPENDENCE_INVALID')
  const packets = buildCalibrationPackets(admission.input, admission)
  for (const [index, reviewer] of rating.reviewers.entries()) {
    const packet = packets[index === 0 ? 'rater-a' : 'rater-b']
    const invocationRaw = evidenceFile(reviewer.invocation_evidence_path,
      reviewer.invocation_evidence_hash, 'CALIBRATION_INVOCATION_EVIDENCE_CHANGED')
    let invocation
    try { invocation = JSON.parse(invocationRaw.toString('utf8')) }
    catch { fail('CALIBRATION_INVOCATION_EVIDENCE_INVALID') }
    if (invocation.invocation_id !== reviewer.invocation_id ||
        invocation.model_family !== reviewer.model_family ||
        invocation.reviewer_id !== reviewer.id || invocation.operator_reviewed !== true ||
        invocation.packet_hash !== packet.packet_hash ||
        invocation.request_hash !== sha(`${JSON.stringify(packet, null, 2)}\n`) ||
        invocation.response_hash !== reviewer.output_hash)
      fail('CALIBRATION_INVOCATION_EVIDENCE_INVALID')
    const raw = evidenceFile(reviewer.output_path, reviewer.output_hash, 'CALIBRATION_RATER_OUTPUT_CHANGED')
    let output
    try { output = JSON.parse(raw.toString('utf8')) } catch { fail('CALIBRATION_RATER_OUTPUT_INVALID') }
    if (output.reviewer_id !== reviewer.id || output.invocation_id !== reviewer.invocation_id ||
        output.model_family !== reviewer.model_family || hash(output.ratings) !== hash(reviewer.ratings))
      fail('CALIBRATION_RATER_OUTPUT_INVALID')
    if (output.passage_hash !== admission.receipt.passage_hash ||
        output.analysis_hash !== admission.receipt.analysis_hash ||
        output.codebook_hash !== admission.receipt.codebook_hash)
      fail('CALIBRATION_RATER_OUTPUT_STALE')
  }
  const disagreement = AXES.some(axis => rating.axis_reviews?.[axis]?.rater_a !==
    rating.axis_reviews?.[axis]?.rater_b)
  if (disagreement) {
    const arbiter = rating.adjudication
    if (!filled(arbiter?.id) || rating.reviewers.some(row => row.id === arbiter.id) ||
        !filled(arbiter.invocation_id) ||
        rating.reviewers.some(row => row.invocation_id === arbiter.invocation_id))
      return { status: 'hold', reason: 'RATING_ADJUDICATION_INCOMPLETE' }
    const raw = evidenceFile(arbiter.output_path, arbiter.output_hash,
      'CALIBRATION_ADJUDICATOR_OUTPUT_CHANGED')
    const invocationRaw = evidenceFile(arbiter.invocation_evidence_path,
      arbiter.invocation_evidence_hash, 'CALIBRATION_ADJUDICATOR_INVOCATION_CHANGED')
    let output, invocation
    try { output = JSON.parse(raw.toString('utf8')); invocation = JSON.parse(invocationRaw.toString('utf8')) }
    catch { fail('CALIBRATION_ADJUDICATOR_INVALID') }
    const packet = buildAdjudicationPacket(admission.input, admission, rating.reviewers)
    if (output.adjudicator_id !== arbiter.id || output.packet_hash !== packet.packet_hash ||
        hash(output.axis_reviews) !== hash(rating.axis_reviews) ||
        output.rater_a_output_hash !== rating.reviewers[0].output_hash ||
        output.rater_b_output_hash !== rating.reviewers[1].output_hash ||
        invocation.reviewer_id !== arbiter.id || invocation.invocation_id !== arbiter.invocation_id ||
        invocation.packet_hash !== packet.packet_hash || invocation.operator_reviewed !== true ||
        invocation.request_hash !== sha(`${JSON.stringify(packet, null, 2)}\n`) ||
        invocation.response_hash !== arbiter.output_hash)
      fail('CALIBRATION_ADJUDICATOR_INVALID')
  }
  if (!rating.axis_reviews || AXES.some(axis => {
    const review = rating.axis_reviews[axis]
    return !review || review.rater_a !== rating.reviewers[0].ratings[axis] ||
      review.rater_b !== rating.reviewers[1].ratings[axis] ||
      (review.rater_a !== review.rater_b &&
        (!filled(review.adjudicator_id) || review.adjudicator_id !== rating.adjudication?.id ||
          !Number.isFinite(review.adjudicated) ||
          rating.reviewers.some(row => row.id === review.adjudicator_id)))
  })) return { status: 'hold', reason: 'RATING_ADJUDICATION_INCOMPLETE' }
  if (AXES.some(axis => {
    const review = rating.axis_reviews[axis]
    const resolved = review.rater_a === review.rater_b ? review.rater_a : review.adjudicated
    return resolved !== admission.input.analysis.metrics[axis]
  })) return { status: 'hold', reason: 'RATING_ANALYSIS_REVISION_REQUIRED' }
  return { status: 'pass', reason: null }
}

export function assessReferenceCalibration({ admission, evidence }) {
  if (!admission?.input || !admission.receipt || !admission.reference) fail('CALIBRATION_ADMISSION_REQUIRED')
  const current = admitReference(admission.input)
  if (hash(current.receipt) !== hash(admission.receipt) ||
      hash(current.reference) !== hash(admission.reference)) fail('CALIBRATION_ADMISSION_STALE')
  if (admission.receipt.cohort !== 'open_reference') fail('CALIBRATION_COHORT_INVALID')
  const rights = rightsStatus(evidence?.rights, current)
  const grade = gradeStatus(evidence?.grade_mapping, current)
  const rating = ratingStatus(evidence?.rating, admission)
  const stages = { admitted: { status: 'pass', reason: null }, rights_eligible: rights,
    grade_anchor_eligible: grade, rating_independence_eligible: rating }
  const calibration_eligible = [rights, grade, rating].every(stage => stage.status === 'pass')
  const decision = { schema: 'reference-calibration-eligibility/1',
    admission_receipt_hash: current.reference.admission_receipt_hash,
    evidence_hash: hash(evidence ?? null), evidence_level: 'operator_reviewed_local',
    stages, calibration_eligible,
    benchmark_cohort_eligible: false,
    benchmark_cohort_reason: 'REPRESENTATIVENESS_NOT_EVALUATED' }
  return { ...decision, decision_hash: hash(decision) }
}
