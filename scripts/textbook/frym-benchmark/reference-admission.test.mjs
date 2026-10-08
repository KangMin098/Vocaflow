// scripts/textbook/frym-benchmark/reference-admission.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { AXES, hash } from './benchmark.mjs'
import { normalizedPassageHash } from './two-stage-seal.mjs'
import { admitReference, verifyReferenceSelection } from './reference-admission.mjs'
import { assessReferenceCalibration, buildCalibrationPackets, buildAdjudicationPacket } from './reference-calibration.mjs'
import { evaluateAdmittedMultiGradeBenchmark, evaluateMultiGradeBenchmark } from './multi-grade-benchmark.mjs'

const sha = value => createHash('sha256').update(value).digest('hex')

function fixture(t, cohort = 'open_reference', grade_scope = { mode: 'grade_range', grades: ['middle_1', 'middle_2'] }) {
  const dir = mkdtempSync(join(tmpdir(), 'benchmark-reference-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const source_path = join(dir, 'source.txt')
  const body = 'Synthetic licensed instructional passage and questions.'
  writeFileSync(source_path, body)
  const file_hash = sha(body)
  const passage_text = 'Plants use sunlight to make food. This process helps them grow.'
  const questions = [{ id: 'Q1', type: 'literal', stem: 'What helps plants grow?', answer: 'Making food.' }]
  const candidate = { candidate_id: 'open:edition-1:p1', cohort, grade_scope,
    publisher: 'Fixture Publisher', series: 'Fixture Series', genre: 'expository', passage_text, questions }
  const codebook = { axes: Object.fromEntries(AXES.map(axis => [axis,
    { scale: 'ratio', valid_min: 0, valid_max: 5, rater_agreement_floor: .7, auxiliary_metrics: [] }])),
  item_types: ['literal'], item_type_difficulty: { scale: 'ratio', valid_min: 0, valid_max: 5 } }
  const evidence = { file_hash,
    edition: { verified: true, file_hash, edition: '2017', reviewer_id: 'edition_reviewer',
      local_locator: 'file:imprint', catalog_url: 'https://example.org/catalog',
      catalog_snapshot_hash: sha('catalog'), local_edition: '2017', catalog_edition: '2017' },
    grade_scope: { ...grade_scope, verified: true, file_hash, reviewer_id: 'grade_reviewer',
      local_locator: 'file:cover', catalog_url: 'https://example.org/catalog',
      catalog_snapshot_hash: sha('catalog'), local_grades: grade_scope.grades,
      catalog_grades: grade_scope.grades, label_system: 'KR', korean_equivalence: 'verified' },
    rights: { verified: true, file_hash, reviewer_id: 'rights_reviewer',
      evidence_hash: sha('license evidence'), license_snapshot_hash: sha('license snapshot'),
      passage_covered: true, items_covered: true,
      third_party_exception: false, license: 'CC-BY-4.0', license_url: 'https://example.org/license',
      decision: 'AUTHORIZED_FOR_ANALYSIS' },
    boundary: { verified: true, reviewer_id: 'boundary_reviewer',
      passage: { file_hash, locator: 'page:1', start_hash: sha('start'), end_hash: sha('end') },
      items: { file_hash, locator: 'page:2', start_hash: sha('item-start'), end_hash: sha('item-end') } } }
  const rules = { schema: 'benchmark-reference-selection/1', status: 'sealed', cohort,
    inventory_hash: hash([file_hash]), codebook_hash: hash(codebook.axes),
    measurement_contract_hash: hash(codebook), maximum_samples: 1, seed: 'precommitted-seed' }
  const passage_hash = normalizedPassageHash(passage_text)
  const item_set_hash = hash(questions.map(({ answer, ...item }) => item))
  const scoring_key_hash = hash(questions.map(({ id, answer }) => ({ id, answer })))
  const screening = { schema: 'benchmark-reference-screening/1', rules_hash: hash(rules),
    inventory_hash: rules.inventory_hash, held_files: [], candidates: [{ candidate_id: candidate.candidate_id,
      status: 'metadata_eligible', cohort, file_hash, source_path_hash: sha(source_path.normalize('NFC')),
      passage_hash, item_set_hash,
      scoring_key_hash, evidence_hash: hash(evidence), grade_scope }] }
  const manifest = { schema: 'benchmark-reference-manifest/1', status: 'sealed', rules_hash: hash(rules),
    screening_hash: hash(screening), selected_ids: [candidate.candidate_id] }
  const analysis = { codebook_hash: rules.codebook_hash, passage_hash, item_set_hash,
    analyzer_version: 'fixture-1', evidence_hash: sha('analysis evidence'),
    rater_independence: 'independent_model_families',
    metrics: Object.fromEntries(AXES.map(axis => [axis, 2])),
    axis_agreement: Object.fromEntries(AXES.map(axis => [axis, .9])),
    item_type_difficulty: { literal: 2 } }
  return { source_path, candidate, evidence, analysis, codebook, rules, screening, manifest }
}

test('open reference preserves a range-grade admission receipt and fails closed on changed evidence', t => {
  const input = fixture(t)
  const { receipt, reference } = admitReference(input)
  assert.equal(receipt.cohort, 'open_reference')
  assert.deepEqual(reference.grade_scope, { mode: 'grade_range', grades: ['middle_1', 'middle_2'] })
  assert.equal(reference.rights_basis, 'open_license_verified')
  assert.equal(reference.admission_receipt_hash, hash(receipt))
  const altered = structuredClone(input)
  altered.evidence.rights.third_party_exception = true
  altered.screening.candidates[0].evidence_hash = hash(altered.evidence)
  altered.manifest.screening_hash = hash(altered.screening)
  assert.throws(() => admitReference(altered), /REFERENCE_RIGHTS_UNVERIFIED/)
  assert.throws(() => admitReference({ ...input, candidate: { ...input.candidate, passage_text: 'Changed.' } }), /REFERENCE_CONTENT_CHANGED/)
  assert.throws(() => admitReference({ ...input, analysis: { ...input.analysis,
    axis_agreement: { ...input.analysis.axis_agreement, inference: .2 } } }), /REFERENCE_AXIS_EVIDENCE_INVALID/)
  assert.throws(() => admitReference({ ...input, codebook: { ...input.codebook,
    item_type_difficulty: { ...input.codebook.item_type_difficulty, valid_max: 20 } } }),
  /REFERENCE_MEASUREMENT_CONTRACT_CHANGED/)
  writeFileSync(input.source_path, 'Changed original file')
  assert.throws(() => admitReference(input), /REFERENCE_SOURCE_CHANGED/)
})

test('government public-domain reference requires specific passage and item origin evidence', t => {
  const input = fixture(t)
  input.evidence.rights.license = 'US-GOV-PUBLIC-DOMAIN'
  input.evidence.rights.license_url = 'https://nodis3.gsfc.nasa.gov/displayCA.cfm?Internal_ID=N_PR_2200_002C_&page_name=Chapter4'
  input.evidence.rights.public_domain_basis = 'nasa_employee_work_text_only'
  input.grade_source_path = join(input.source_path, '..', 'grade-guide.txt')
  writeFileSync(input.grade_source_path, 'Grades 6 through 8')
  input.evidence.grade_scope.supporting_file_hash = sha('Grades 6 through 8')
  input.evidence.grade_scope.catalog_grades_observed = ['elementary_6', 'middle_1', 'middle_2']
  input.evidence.grade_scope.primary_grade_anchor = 'educator_guide'
  input.evidence.grade_scope.catalog_grade_discrepancy = 'tag_broader_than_guide'
  input.evidence.grade_scope.label_system = 'US'
  input.evidence.grade_scope.korean_equivalence = 'unverified'
  input.analysis.rater_independence = 'same_model_family_separate_calls'
  input.screening.candidates[0].evidence_hash = hash(input.evidence)
  input.manifest.screening_hash = hash(input.screening)
  assert.throws(() => admitReference(input), /REFERENCE_RIGHTS_UNVERIFIED/)
  input.evidence.rights.passage_origin_url = 'https://www.nasa.gov/example/student-guide.pdf'
  input.evidence.rights.items_origin_url = input.evidence.rights.passage_origin_url
  input.evidence.rights.passage_origin_hash = input.evidence.file_hash
  input.evidence.rights.items_origin_hash = input.evidence.file_hash
  input.evidence.rights.scoring_origin_url = 'https://www.nasa.gov/example/educator-guide.pdf'
  input.evidence.rights.scoring_origin_hash = sha('educator guide answers')
  input.scoring_source_path = join(input.source_path, '..', 'educator-guide.txt')
  writeFileSync(input.scoring_source_path, 'educator guide answers')
  input.screening.candidates[0].evidence_hash = hash(input.evidence)
  input.manifest.screening_hash = hash(input.screening)
  const admitted = admitReference(input)
  assert.equal(admitted.reference.rights_basis, 'nasa_analysis_reviewed')
  assert.equal(admitted.receipt.grade_source_hash, sha('Grades 6 through 8'))
  assert.equal(admitted.receipt.scoring_source_hash, sha('educator guide answers'))
  assert.deepEqual(admitted.receipt.catalog_grades_observed, ['elementary_6', 'middle_1', 'middle_2'])
  assert.equal(admitted.receipt.catalog_grade_discrepancy, 'tag_broader_than_guide')
  assert.equal(admitted.receipt.public_domain_basis, 'nasa_employee_work_text_only')
  assert.equal(admitted.receipt.calibration_eligible, false)
  assert.equal(admitted.reference.korean_equivalence, 'unverified')
  const missingGrade = structuredClone(input)
  delete missingGrade.evidence.grade_scope.supporting_file_hash
  missingGrade.screening.candidates[0].evidence_hash = hash(missingGrade.evidence)
  missingGrade.manifest.screening_hash = hash(missingGrade.screening)
  assert.throws(() => admitReference(missingGrade), /REFERENCE_GRADE_SOURCE_UNVERIFIED/)
  const incompatibleCatalog = structuredClone(input)
  incompatibleCatalog.evidence.grade_scope.catalog_grades_observed = ['elementary_5']
  incompatibleCatalog.screening.candidates[0].evidence_hash = hash(incompatibleCatalog.evidence)
  incompatibleCatalog.manifest.screening_hash = hash(incompatibleCatalog.screening)
  assert.throws(() => admitReference(incompatibleCatalog), /REFERENCE_GRADE_SOURCE_UNVERIFIED/)
  assert.throws(() => evaluateAdmittedMultiGradeBenchmark({
    contract: { reference_cohort: 'open_reference' },
    admitted: [{ input, ...admitted }],
  }), /REFERENCE_CALIBRATION_EVIDENCE_REQUIRED/)
  writeFileSync(input.scoring_source_path, 'changed answer guide')
  assert.throws(() => admitReference(input), /REFERENCE_SCORING_SOURCE_CHANGED/)
  writeFileSync(input.scoring_source_path, 'educator guide answers')
  const nongovernment = structuredClone(input)
  nongovernment.evidence.rights.passage_origin_url = 'https://www.nasa.gov.evil.example/student-guide.pdf'
  nongovernment.screening.candidates[0].evidence_hash = hash(nongovernment.evidence)
  nongovernment.manifest.screening_hash = hash(nongovernment.screening)
  assert.throws(() => admitReference(nongovernment), /REFERENCE_RIGHTS_UNVERIFIED/)
  const stateGovernment = structuredClone(input)
  stateGovernment.evidence.rights.passage_origin_url = 'https://example.ca.gov/student-guide.pdf'
  stateGovernment.screening.candidates[0].evidence_hash = hash(stateGovernment.evidence)
  stateGovernment.manifest.screening_hash = hash(stateGovernment.screening)
  assert.throws(() => admitReference(stateGovernment), /REFERENCE_RIGHTS_UNVERIFIED/)
  input.evidence.rights.third_party_exception = true
  input.screening.candidates[0].evidence_hash = hash(input.evidence)
  input.manifest.screening_hash = hash(input.screening)
  assert.throws(() => admitReference(input), /REFERENCE_RIGHTS_UNVERIFIED/)
})

test('a separate grade-scope source is byte-checked when declared', t => {
  const input = fixture(t)
  input.grade_source_path = join(input.source_path, '..', 'educator-grade-guide.txt')
  writeFileSync(input.grade_source_path, 'Grades 6 through 8')
  input.evidence.grade_scope.supporting_file_hash = sha('Grades 6 through 8')
  input.screening.candidates[0].evidence_hash = hash(input.evidence)
  input.manifest.screening_hash = hash(input.screening)
  assert.equal(admitReference(input).reference.sample_id, input.candidate.candidate_id)
  writeFileSync(input.grade_source_path, 'Grades 5 through 8')
  assert.throws(() => admitReference(input), /REFERENCE_GRADE_SOURCE_CHANGED/)
})

test('sealed selection, cohort and grade scope reject mixed or stale inputs', t => {
  const input = fixture(t)
  assert.deepEqual(verifyReferenceSelection(input).selected_ids, [input.candidate.candidate_id])
  assert.throws(() => admitReference({ ...input, evidence: { ...input.evidence,
    grade_scope: { ...input.evidence.grade_scope, grades: ['middle_1'] } } }), /REFERENCE_CANDIDATE_STALE/)
  assert.throws(() => admitReference({ ...input, candidate: { ...input.candidate,
    cohort: 'commercial_textbook' } }), /REFERENCE_CANDIDATE_STALE/)
  assert.throws(() => verifyReferenceSelection({ ...input, manifest: { ...input.manifest,
    selected_ids: [] } }), /REFERENCE_MANIFEST_SELECTION_INVALID/)
  const leaked = structuredClone(input)
  leaked.screening.candidates[0].metrics = { lexical: 5 }
  leaked.manifest.screening_hash = hash(leaked.screening)
  assert.throws(() => verifyReferenceSelection(leaked), /REFERENCE_SELECTION_CHAIN_INVALID/)
  const held = structuredClone(input)
  held.screening.held_files.push({ file_hash: held.screening.candidates[0].file_hash, reason: 'rights_pending' })
  held.manifest.screening_hash = hash(held.screening)
  assert.throws(() => verifyReferenceSelection(held), /REFERENCE_HELD_FILE_MIXED/)
  const mixed = structuredClone(input)
  mixed.screening.candidates[0].cohort = 'commercial_textbook'
  mixed.manifest.screening_hash = hash(mixed.screening)
  assert.throws(() => verifyReferenceSelection(mixed), /REFERENCE_SCREENING_INVALID/)
})

test('commercial authorized analysis and single-grade scope remain separate', t => {
  const input = fixture(t, 'commercial_textbook', { mode: 'single_grade', grades: ['middle_1'] })
  const result = admitReference(input)
  assert.equal(result.reference.rights_basis, 'authorized_local_analysis')
  const altered = structuredClone(input)
  altered.evidence.rights.decision = 'CATALOG_REFERENCE_ONLY'
  altered.screening.candidates[0].evidence_hash = hash(altered.evidence)
  altered.manifest.screening_hash = hash(altered.screening)
  assert.throws(() => admitReference(altered), /REFERENCE_RIGHTS_UNVERIFIED/)
})

test('multi-grade evaluation re-admits file-backed references before reading them', t => {
  const input = fixture(t)
  const { receipt, reference } = admitReference(input)
  const contract = { reference_cohort: 'open_reference' }
  assert.throws(() => evaluateMultiGradeBenchmark({ contract, references: [reference] }),
    /OPEN_REFERENCE_ADMISSION_REQUIRED/)
  assert.throws(() => evaluateAdmittedMultiGradeBenchmark({
    contract, admitted: [{ input, receipt: { ...receipt, file_hash: sha('other') }, reference }],
  }), /ADMITTED_REFERENCE_STALE_OR_MIXED/)
  assert.throws(() => evaluateAdmittedMultiGradeBenchmark({
    contract, admitted: [{ input, receipt, reference: { ...reference, grade_scope: { mode: 'single_grade', grades: ['middle_1'] } } }],
  }), /ADMITTED_REFERENCE_STALE_OR_MIXED/)
  assert.throws(() => evaluateAdmittedMultiGradeBenchmark({
    contract, admitted: [{ input, receipt, reference }],
  }), /REFERENCE_CALIBRATION_EVIDENCE_REQUIRED/)
})

test('calibration eligibility separates rights, Korean grade mapping, and rater independence', t => {
  const input = fixture(t)
  const admitted = admitReference(input)
  const admission = { input, ...admitted }
  const blank = assessReferenceCalibration({ admission })
  assert.equal(blank.calibration_eligible, false)
  assert.equal(blank.stages.rights_eligible.reason, 'RIGHTS_EVIDENCE_MISSING')
  const evidence = {
    rights: { source_file_hash: admitted.receipt.file_hash,
      passage_hash: admitted.receipt.passage_hash, item_set_hash: admitted.receipt.item_set_hash,
      source_rights: 'authorized', passage_rights: 'authorized', third_party_content: 'absent',
      rights_confidence: 'documented', source_evidence_hash: sha('source permission'),
      passage_evidence_hash: sha('passage permission') },
    grade_mapping: { source_grade_scope_hash: hash(admitted.receipt.grade_scope),
      grade_source_hash: admitted.receipt.grade_source_hash,
      source_grade_scope: { label_system: admitted.receipt.grade_label_system,
        source_hash: admitted.receipt.grade_source_hash,
        labels: admitted.receipt.grade_scope.grades }, status: 'verified',
      mapping_evidence_hash: sha('Korean curriculum mapping'), reviewer_id: 'human-reviewer',
      anchor_sources: [{ source_id: 'anchor-a', evidence_hash: sha('anchor one') },
        { source_id: 'anchor-b', evidence_hash: sha('anchor two') }],
      korean_target_mapping: admitted.receipt.grade_scope.grades.map(grade =>
        ({ source_grade: grade, korean_grade: grade })) },
    rating: { analysis_hash: admitted.receipt.analysis_hash,
      codebook_hash: admitted.receipt.codebook_hash,
      reviewers: [{ id: 'r1', model_family: 'family-a', invocation_id: 'call-a',
        ratings: Object.fromEntries(AXES.map(axis => [axis, 2])),
        output_hash: hash(Object.fromEntries(AXES.map(axis => [axis, 2]))) },
      { id: 'r2', model_family: 'family-b', invocation_id: 'call-b',
        ratings: Object.fromEntries(AXES.map(axis => [axis, 2])),
        output_hash: hash(Object.fromEntries(AXES.map(axis => [axis, 2]))) }],
      axis_reviews: Object.fromEntries(AXES.map(axis => [axis, { rater_a: 2, rater_b: 2 }])) },
  }
  const dir = join(input.source_path, '..')
  evidence.rights.source_evidence_path = join(dir, 'source-permission.txt')
  evidence.rights.passage_evidence_path = join(dir, 'passage-permission.txt')
  evidence.grade_mapping.mapping_evidence_path = join(dir, 'grade-mapping.txt')
  writeFileSync(evidence.rights.source_evidence_path, 'source permission')
  writeFileSync(evidence.rights.passage_evidence_path, 'passage permission')
  writeFileSync(evidence.grade_mapping.mapping_evidence_path, 'Korean curriculum mapping')
  evidence.grade_mapping.anchor_sources.forEach((anchor, index) => {
    anchor.evidence_path = join(dir, `anchor-${index}.txt`)
    writeFileSync(anchor.evidence_path, index === 0 ? 'anchor one' : 'anchor two')
  })
  evidence.rating.reviewers.forEach((reviewer, index) => {
    reviewer.output_path = join(dir, `rater-${index}.json`)
    reviewer.invocation_evidence_path = join(dir, `invocation-${index}.json`)
    const raw = JSON.stringify({ reviewer_id: reviewer.id, invocation_id: reviewer.invocation_id,
      model_family: reviewer.model_family, ratings: reviewer.ratings,
      passage_hash: admitted.receipt.passage_hash, analysis_hash: admitted.receipt.analysis_hash,
      codebook_hash: admitted.receipt.codebook_hash })
    writeFileSync(reviewer.output_path, raw)
    reviewer.output_hash = sha(raw)
    const packet = buildCalibrationPackets(input, admitted)[index === 0 ? 'rater-a' : 'rater-b']
    const invocation = JSON.stringify({ invocation_id: reviewer.invocation_id,
      reviewer_id: reviewer.id, model_family: reviewer.model_family, operator_reviewed: true,
      packet_hash: packet.packet_hash,
      request_hash: sha(`${JSON.stringify(packet, null, 2)}\n`), response_hash: reviewer.output_hash })
    writeFileSync(reviewer.invocation_evidence_path, invocation)
    reviewer.invocation_evidence_hash = sha(invocation)
  })
  const pass = assessReferenceCalibration({ admission, evidence })
  assert.equal(pass.calibration_eligible, true)
  assert.equal(pass.benchmark_cohort_eligible, false)
  assert.throws(() => evaluateAdmittedMultiGradeBenchmark({
    contract: { reference_cohort: 'open_reference' },
    admitted: [{ ...admission, calibration_evidence: evidence, calibration_decision: pass }],
  }), /MULTI_GRADE_CONTRACT_INVALID/)
  const sameFamily = structuredClone(evidence)
  sameFamily.rating.reviewers[1].model_family = 'family-a'
  assert.equal(assessReferenceCalibration({ admission, evidence: sameFamily }).stages.rating_independence_eligible.reason,
    'RATERS_SAME_MODEL_FAMILY')
  const replayedInvocation = structuredClone(evidence)
  replayedInvocation.rating.reviewers[1].invocation_id = replayedInvocation.rating.reviewers[0].invocation_id
  assert.throws(() => assessReferenceCalibration({ admission, evidence: replayedInvocation }),
    /CALIBRATION_RATER_INDEPENDENCE_INVALID/)
  const weakRights = structuredClone(evidence)
  weakRights.rights.rights_confidence = 'reviewed_inference'
  assert.equal(assessReferenceCalibration({ admission, evidence: weakRights }).stages.rights_eligible.status, 'hold')
  const noMapping = structuredClone(evidence)
  noMapping.grade_mapping.status = 'unverified'
  assert.equal(assessReferenceCalibration({ admission, evidence: noMapping }).stages.grade_anchor_eligible.status, 'hold')
  const inventedLabels = structuredClone(evidence)
  inventedLabels.grade_mapping.source_grade_scope.labels = ['X', 'Y']
  inventedLabels.grade_mapping.korean_target_mapping = ['X', 'Y'].map(source_grade =>
    ({ source_grade, korean_grade: 'middle_1' }))
  assert.throws(() => assessReferenceCalibration({ admission, evidence: inventedLabels }),
    /CALIBRATION_GRADE_MAPPING_INVALID/)
  const stale = structuredClone(evidence)
  stale.rating.analysis_hash = sha('other analysis')
  assert.throws(() => assessReferenceCalibration({ admission, evidence: stale }), /CALIBRATION_RATING_STALE/)
  writeFileSync(evidence.rights.source_evidence_path, 'revoked source permission')
  assert.throws(() => assessReferenceCalibration({ admission, evidence }), /CALIBRATION_SOURCE_RIGHTS_CHANGED/)
  writeFileSync(evidence.rights.source_evidence_path, 'source permission')
  writeFileSync(evidence.rating.reviewers[0].output_path, '{}')
  assert.throws(() => assessReferenceCalibration({ admission, evidence }), /CALIBRATION_RATER_OUTPUT_CHANGED/)
  const originalRater = evidence.rating.reviewers[0]
  writeFileSync(originalRater.output_path, JSON.stringify({ reviewer_id: originalRater.id, invocation_id: originalRater.invocation_id,
    model_family: originalRater.model_family, ratings: originalRater.ratings,
    passage_hash: admitted.receipt.passage_hash, analysis_hash: admitted.receipt.analysis_hash,
    codebook_hash: admitted.receipt.codebook_hash }))
  const wrongPassage = JSON.stringify({ reviewer_id: originalRater.id, invocation_id: originalRater.invocation_id,
    model_family: originalRater.model_family, ratings: originalRater.ratings,
    passage_hash: sha('other passage'), analysis_hash: admitted.receipt.analysis_hash,
    codebook_hash: admitted.receipt.codebook_hash })
  writeFileSync(originalRater.output_path, wrongPassage)
  const staleRater = structuredClone(evidence)
  staleRater.rating.reviewers[0].output_hash = sha(wrongPassage)
  const staleInvocation = JSON.parse(readFileSync(originalRater.invocation_evidence_path, 'utf8'))
  staleInvocation.response_hash = sha(wrongPassage)
  staleRater.rating.reviewers[0].invocation_evidence_path = join(dir, 'invocation-stale.json')
  writeFileSync(staleRater.rating.reviewers[0].invocation_evidence_path, JSON.stringify(staleInvocation))
  staleRater.rating.reviewers[0].invocation_evidence_hash = sha(JSON.stringify(staleInvocation))
  assert.throws(() => assessReferenceCalibration({ admission, evidence: staleRater }),
    /CALIBRATION_RATER_OUTPUT_STALE/)
  writeFileSync(originalRater.output_path, JSON.stringify({ reviewer_id: originalRater.id, invocation_id: originalRater.invocation_id,
    model_family: originalRater.model_family, ratings: originalRater.ratings,
    passage_hash: admitted.receipt.passage_hash, analysis_hash: admitted.receipt.analysis_hash,
    codebook_hash: admitted.receipt.codebook_hash }))
  const forgedRating = structuredClone(evidence)
  forgedRating.rating.reviewers[0].ratings.lexical = 4
  assert.throws(() => assessReferenceCalibration({ admission, evidence: forgedRating }), /CALIBRATION_RATER_OUTPUT_INVALID/)
  const disputed = structuredClone(evidence)
  const second = disputed.rating.reviewers[1]
  second.ratings.processing_load = 3
  second.output_path = join(dir, 'rater-1-disputed.json')
  const secondRaw = JSON.stringify({ reviewer_id: second.id, invocation_id: second.invocation_id,
    model_family: second.model_family, ratings: second.ratings,
    passage_hash: admitted.receipt.passage_hash, analysis_hash: admitted.receipt.analysis_hash,
    codebook_hash: admitted.receipt.codebook_hash })
  writeFileSync(second.output_path, secondRaw)
  second.output_hash = sha(secondRaw)
  second.invocation_evidence_path = join(dir, 'invocation-1-disputed.json')
  const secondInvocation = JSON.parse(readFileSync(evidence.rating.reviewers[1].invocation_evidence_path, 'utf8'))
  secondInvocation.response_hash = second.output_hash
  writeFileSync(second.invocation_evidence_path, JSON.stringify(secondInvocation))
  second.invocation_evidence_hash = sha(JSON.stringify(secondInvocation))
  disputed.rating.axis_reviews.processing_load = { rater_a: 2, rater_b: 3,
    adjudicator_id: 'arbiter', adjudicated: 2 }
  const arbPacket = buildAdjudicationPacket(input, admitted, disputed.rating.reviewers)
  const arbRaw = JSON.stringify({ adjudicator_id: 'arbiter', packet_hash: arbPacket.packet_hash,
    rater_a_output_hash: disputed.rating.reviewers[0].output_hash,
    rater_b_output_hash: second.output_hash, axis_reviews: disputed.rating.axis_reviews })
  const arbOutput = join(dir, 'arbiter.json'), arbInvocationPath = join(dir, 'arbiter-invocation.json')
  writeFileSync(arbOutput, arbRaw)
  const arbInvocation = JSON.stringify({ reviewer_id: 'arbiter', invocation_id: 'arb-call',
    packet_hash: arbPacket.packet_hash, operator_reviewed: true,
    request_hash: sha(`${JSON.stringify(arbPacket, null, 2)}\n`), response_hash: sha(arbRaw) })
  writeFileSync(arbInvocationPath, arbInvocation)
  disputed.rating.adjudication = { id: 'arbiter', invocation_id: 'arb-call',
    output_path: arbOutput, output_hash: sha(arbRaw),
    invocation_evidence_path: arbInvocationPath, invocation_evidence_hash: sha(arbInvocation) }
  assert.equal(assessReferenceCalibration({ admission, evidence: disputed }).calibration_eligible, true)
  const wrongArbiter = structuredClone(disputed)
  wrongArbiter.rating.reviewers[0].output_hash = sha('other rater output')
  assert.throws(() => assessReferenceCalibration({ admission, evidence: wrongArbiter }),
    /CALIBRATION_INVOCATION_EVIDENCE_INVALID/)
  assert.throws(() => evaluateAdmittedMultiGradeBenchmark({
    contract: { reference_cohort: 'open_reference' },
    admitted: [{ ...admission, calibration_evidence: sameFamily,
      calibration_decision: assessReferenceCalibration({ admission, evidence: sameFamily }) }],
  }), /REFERENCE_CALIBRATION_INELIGIBLE/)
  assert.throws(() => evaluateAdmittedMultiGradeBenchmark({
    contract: { reference_cohort: 'open_reference' },
    admitted: [{ ...admission, calibration_evidence: evidence,
      calibration_decision: { ...pass, decision_hash: sha('tampered') } }],
  }), /REFERENCE_CALIBRATION_INELIGIBLE/)
})

test('CLI writes a create-only metadata receipt without textbook text', t => {
  const input = fixture(t)
  const dir = mkdtempSync(join(tmpdir(), 'benchmark-reference-cli-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const paths = Object.fromEntries(['rules', 'screening', 'manifest'].map(key => {
    const path = join(dir, `${key}.json`)
    writeFileSync(path, JSON.stringify(input[key]))
    return [key, path]
  }))
  const bundle = join(dir, 'bundle.json'), output = join(dir, 'receipt.json')
  writeFileSync(bundle, JSON.stringify({ source_path: input.source_path,
    candidate: input.candidate, evidence: input.evidence, analysis: input.analysis,
    codebook: input.codebook }))
  const run = () => spawnSync(process.execPath, [join(import.meta.dirname, 'reference-admit.mjs'),
    paths.rules, paths.screening, paths.manifest, bundle, output], { encoding: 'utf8' })
  const first = run()
  assert.equal(first.status, 0, first.stderr)
  assert.equal(run().status, 1)
  const saved = readFileSync(output, 'utf8')
  assert.equal(saved.includes(input.candidate.passage_text), false)
  assert.equal(saved.includes(input.candidate.questions[0].stem), false)
  assert.deepEqual(JSON.parse(saved).reference.grade_scope, input.candidate.grade_scope)
})

test('calibration drain exports create-only bound packets and imports missing reviews as hold', t => {
  const input = fixture(t)
  input.candidate.questions[0].explanation = 'SECRET_ANSWER_EXPLANATION'
  input.candidate.questions[0].options = [{ text: 'visible option', correct: true }]
  input.screening.candidates[0].item_set_hash = hash(input.candidate.questions.map(({ answer, ...item }) => item))
  input.analysis.item_set_hash = input.screening.candidates[0].item_set_hash
  input.manifest.screening_hash = hash(input.screening)
  const dir = mkdtempSync(join(tmpdir(), 'reference-calibration-drain-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const paths = Object.fromEntries(['rules', 'screening', 'manifest'].map(key => {
    const path = join(dir, `${key}.json`)
    writeFileSync(path, JSON.stringify(input[key]))
    return [key, path]
  }))
  const bundle = join(dir, 'bundle.json'), receipt = join(dir, 'receipt.json')
  writeFileSync(bundle, JSON.stringify({ source_path: input.source_path,
    candidate: input.candidate, evidence: input.evidence, analysis: input.analysis,
    codebook: input.codebook }))
  writeFileSync(receipt, JSON.stringify(admitReference(input)))
  const script = join(import.meta.dirname, 'reference-calibration-run.mjs')
  const run = (command, output) => spawnSync(process.execPath,
    [script, command, paths.rules, paths.screening, paths.manifest, bundle, receipt, dir,
      ...(output ? [output] : [])], { encoding: 'utf8' })
  assert.equal(run('export').status, 0)
  assert.equal(readFileSync(join(dir, 'rater-a.packet.json'), 'utf8').includes('SECRET_ANSWER_EXPLANATION'), false)
  assert.equal(readFileSync(join(dir, 'rater-a.packet.json'), 'utf8').includes('"correct"'), false)
  const leakingCodebook = structuredClone(input)
  leakingCodebook.codebook.axes.lexical.answer = 'secret'
  assert.throws(() => buildCalibrationPackets(leakingCodebook, admitReference(input)),
    /CALIBRATION_CODEBOOK_ANSWER_LEAK/)
  assert.match(run('export').stdout, /"unchanged":4/)
  assert.match(run('export-adjudication').stderr, /CALIBRATION_RATER_OUTPUTS_REQUIRED/)
  const decisionPath = join(dir, 'decision.json')
  assert.equal(run('import', decisionPath).status, 0)
  const saved = JSON.parse(readFileSync(decisionPath, 'utf8'))
  assert.equal(saved.calibration_eligible, false)
  assert.equal(saved.missing_outputs.length, 5)
  assert.equal(readFileSync(decisionPath, 'utf8').includes(input.candidate.passage_text), false)
  assert.notEqual(run('import', decisionPath).status, 0)
  for (const [index, kind] of ['rater-a', 'rater-b'].entries()) {
    const packet = JSON.parse(readFileSync(join(dir, `${kind}.packet.json`), 'utf8'))
    const raw = JSON.stringify({ kind, candidate_id: input.candidate.candidate_id,
      packet_hash: packet.packet_hash, reviewer_id: `reviewer-${index}`,
      invocation_id: `call-${index}`, model_family: `family-${index}`,
      passage_hash: packet.passage_hash, analysis_hash: packet.analysis_hash,
      codebook_hash: packet.codebook_hash,
      ratings: Object.fromEntries(AXES.map(axis => [axis, 2])) })
    writeFileSync(join(dir, `${kind}.out.json`), raw)
    const invocation = { reviewer_id: `reviewer-${index}`, invocation_id: `call-${index}`,
      model_family: `family-${index}`, operator_reviewed: true,
      packet_hash: packet.packet_hash, request_hash: sha(readFileSync(join(dir, `${kind}.packet.json`))),
      response_hash: sha(raw) }
    writeFileSync(join(dir, `${kind}.invocation.json`), JSON.stringify(invocation))
  }
  assert.equal(run('export-adjudication').status, 0)
  const arbPacket = JSON.parse(readFileSync(join(dir, 'adjudication.packet.json'), 'utf8'))
  assert.equal(arbPacket.rater_a.output_hash, sha(readFileSync(join(dir, 'rater-a.out.json'))))
  assert.equal(arbPacket.rater_b.output_hash, sha(readFileSync(join(dir, 'rater-b.out.json'))))
  writeFileSync(join(dir, 'adjudication.out.json'), JSON.stringify({ kind: 'adjudication',
    candidate_id: input.candidate.candidate_id, packet_hash: arbPacket.packet_hash,
    axis_reviews: Object.fromEntries(AXES.map(axis => [axis, { rater_a: 2, rater_b: 2 }])) }))
  const partialDecision = join(dir, 'decision-with-ratings.json')
  assert.equal(run('import', partialDecision).status, 0)
  const partial = JSON.parse(readFileSync(partialDecision, 'utf8'))
  assert.equal(partial.stages.rating_independence_eligible.status, 'pass')
  assert.equal(partial.calibration_eligible, false)
  const secondOutput = join(dir, 'rater-b.out.json')
  const alteredRater = JSON.parse(readFileSync(secondOutput, 'utf8'))
  alteredRater.ratings.lexical = 4
  writeFileSync(secondOutput, JSON.stringify(alteredRater))
  assert.notEqual(run('export-adjudication').status, 0)
  const packetPath = join(dir, 'grade.packet.json')
  const altered = JSON.parse(readFileSync(packetPath, 'utf8'))
  altered.grade_source_hash = sha('different guide')
  writeFileSync(packetPath, JSON.stringify(altered))
  assert.match(run('export').stderr, /CALIBRATION_PACKET_STALE:grade/)
})
