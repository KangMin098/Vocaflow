// scripts/textbook/frym-benchmark/reference-admission.mjs
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { AXES, GRADES, hash } from './benchmark.mjs'
import { normalizedPassageHash } from './two-stage-seal.mjs'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const filled = value => typeof value === 'string' && value.trim().length > 0
const webUrl = value => { try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false } }
const governmentUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' &&
  (url.hostname === 'gov' || url.hostname.endsWith('.gov')) } catch { return false } }
const fail = code => { throw Error(code) }
const same = (a, b) => hash(a) === hash(b)
const earlyAnalysis = value => value && typeof value === 'object' && Object.entries(value).some(([key, child]) =>
  ['metrics', 'analysis', 'analysis_hash', 'axis_agreement', 'ordinal_reviews', 'item_type_difficulty'].includes(key) || earlyAnalysis(child))

function scopeValid(scope) {
  const grades = scope?.grades
  return ['single_grade', 'grade_range', 'multi_grade'].includes(scope?.mode) &&
    Array.isArray(grades) && grades.length >= (scope.mode === 'single_grade' ? 1 : 2) &&
    (scope.mode !== 'single_grade' || grades.length === 1) &&
    grades.every((grade, index) => GRADES.includes(grade) &&
      (index === 0 || GRADES.indexOf(grade) > GRADES.indexOf(grades[index - 1]) &&
        (scope.mode !== 'grade_range' || GRADES.indexOf(grade) === GRADES.indexOf(grades[index - 1]) + 1)))
}

export function verifyReferenceSelection({ rules, screening, manifest }) {
  if (rules?.schema !== 'benchmark-reference-selection/1' || rules.status !== 'sealed' ||
      !['commercial_textbook', 'open_reference'].includes(rules.cohort) ||
      !hex(rules.inventory_hash) || !hex(rules.codebook_hash) ||
      !hex(rules.measurement_contract_hash) || !filled(rules.seed) ||
      !Number.isInteger(rules.maximum_samples) || rules.maximum_samples < 1 ||
      screening?.schema !== 'benchmark-reference-screening/1' ||
      screening.rules_hash !== hash(rules) || screening.inventory_hash !== rules.inventory_hash ||
      !Array.isArray(screening.candidates) || !Array.isArray(screening.held_files) ||
      manifest?.schema !== 'benchmark-reference-manifest/1' ||
      manifest.status !== 'sealed' ||
      manifest.rules_hash !== hash(rules) || manifest.screening_hash !== hash(screening) ||
      earlyAnalysis(rules) || earlyAnalysis(screening) || earlyAnalysis(manifest))
    fail('REFERENCE_SELECTION_CHAIN_INVALID')
  const ids = new Set(), passages = new Set(), files = new Set()
  for (const held of screening.held_files) {
    if (!hex(held?.file_hash) || !filled(held.reason) || files.has(held.file_hash))
      fail('REFERENCE_HELD_FILE_INVALID')
    files.add(held.file_hash)
  }
  for (const row of screening.candidates) {
    if (!filled(row?.candidate_id) || ids.has(row.candidate_id) ||
        !hex(row.file_hash) || !hex(row.source_path_hash) ||
        !hex(row.passage_hash) || !hex(row.item_set_hash) || !hex(row.scoring_key_hash) ||
        !hex(row.evidence_hash) || !scopeValid(row.grade_scope) ||
        row.cohort !== rules.cohort || !['metadata_eligible', 'hold', 'reject'].includes(row.status))
      fail('REFERENCE_SCREENING_INVALID')
    if (screening.held_files.some(held => held.file_hash === row.file_hash))
      fail('REFERENCE_HELD_FILE_MIXED')
    ids.add(row.candidate_id); files.add(row.file_hash)
    if (row.status === 'metadata_eligible') {
      if (passages.has(row.passage_hash)) fail('REFERENCE_DUPLICATE_PASSAGE')
      passages.add(row.passage_hash)
    } else if (!filled(row.reason)) fail('REFERENCE_HOLD_REASON_MISSING')
  }
  if (hash([...files].sort()) !== rules.inventory_hash) fail('REFERENCE_INVENTORY_CHANGED')
  const selected = screening.candidates.filter(row => row.status === 'metadata_eligible')
    .sort((a, b) => hash([rules.seed, a.candidate_id]).localeCompare(hash([rules.seed, b.candidate_id])))
    .slice(0, rules.maximum_samples).map(row => row.candidate_id)
  if (!same(manifest.selected_ids, selected)) fail('REFERENCE_MANIFEST_SELECTION_INVALID')
  return { selected_ids: selected, manifest_hash: hash(manifest) }
}

function verifyMeasurements(analysis, codebook, questions) {
  if (!codebook || hash(codebook.axes) !== analysis.codebook_hash ||
      !Array.isArray(codebook.item_types) || !codebook.item_type_difficulty ||
      questions.some(item => !codebook.item_types.includes(item.type))) fail('REFERENCE_CODEBOOK_MISMATCH')
  for (const axis of AXES) {
    const def = codebook.axes[axis], value = analysis.metrics[axis]
    if (!def || !['ratio', 'ordinal'].includes(def.scale) ||
        !Number.isFinite(analysis.axis_agreement?.[axis]) ||
        analysis.axis_agreement[axis] < def.rater_agreement_floor ||
        analysis.axis_agreement[axis] > 1 ||
        (def.scale === 'ratio' && (value < def.valid_min || value > def.valid_max)) ||
        (def.scale === 'ordinal' && (!Number.isInteger(value) || value < 0 || value >= def.levels?.length)) ||
        !Array.isArray(def.auxiliary_metrics) ||
        def.auxiliary_metrics.some(metric => !Number.isFinite(analysis.auxiliary_metrics?.[axis]?.[metric])))
      fail('REFERENCE_AXIS_EVIDENCE_INVALID')
    if (def.scale === 'ordinal') {
      const review = analysis.ordinal_reviews?.[axis]
      if (!filled(review?.rater_a_id) || !filled(review?.rater_b_id) ||
          review.rater_a_id === review.rater_b_id ||
          !Number.isInteger(review.rater_a) || !Number.isInteger(review.rater_b) ||
          review.rater_a < 0 || review.rater_a >= def.levels.length ||
          review.rater_b < 0 || review.rater_b >= def.levels.length ||
          (review.rater_a === review.rater_b ? review.rater_a !== value || review.adjudicated != null :
            !filled(review.adjudicator_id) || review.adjudicator_id === review.rater_a_id ||
            review.adjudicator_id === review.rater_b_id || review.adjudicated !== value))
        fail('REFERENCE_ORDINAL_REVIEW_INVALID')
    }
  }
  const scale = codebook.item_type_difficulty
  if (scale.scale !== 'ratio' || questions.some(item =>
    analysis.item_type_difficulty[item.type] < scale.valid_min ||
    analysis.item_type_difficulty[item.type] > scale.valid_max))
    fail('REFERENCE_ITEM_DIFFICULTY_INVALID')
}

export function admitReference({ source_path, scoring_source_path, candidate, evidence, analysis, codebook, rules, screening, manifest }) {
  const { selected_ids, manifest_hash } = verifyReferenceSelection({ rules, screening, manifest })
  const row = screening.candidates.find(value => value.candidate_id === candidate?.candidate_id)
  if (!row || !selected_ids.includes(row.candidate_id) || row.status !== 'metadata_eligible' ||
      row.cohort !== candidate.cohort || !same(row.grade_scope, candidate.grade_scope) ||
      row.evidence_hash !== hash(evidence) || row.file_hash !== evidence?.file_hash ||
      !filled(candidate.publisher) || !filled(candidate.series) ||
      !['expository', 'argumentative', 'narrative'].includes(candidate.genre) ||
      !same(candidate.grade_scope, evidence?.grade_scope?.grades && {
        mode: evidence.grade_scope.mode, grades: evidence.grade_scope.grades,
      })) fail('REFERENCE_CANDIDATE_STALE')
  let bytes
  try { bytes = readFileSync(source_path) } catch { fail('REFERENCE_SOURCE_UNREADABLE') }
  if (sha(bytes) !== row.file_hash || evidence.file_hash !== row.file_hash) fail('REFERENCE_SOURCE_CHANGED')
  if (sha(source_path.normalize('NFC')) !== row.source_path_hash) fail('REFERENCE_SOURCE_PATH_CHANGED')
  if (evidence.edition?.verified !== true || evidence.edition.file_hash !== row.file_hash ||
      !filled(evidence.edition.edition) || !filled(evidence.edition.reviewer_id) ||
      !filled(evidence.edition.local_locator) || !webUrl(evidence.edition.catalog_url) ||
      !hex(evidence.edition.catalog_snapshot_hash) ||
      evidence.edition.local_edition !== evidence.edition.edition ||
      evidence.edition.catalog_edition !== evidence.edition.edition ||
      evidence.grade_scope?.verified !== true || evidence.grade_scope.file_hash !== row.file_hash ||
      !filled(evidence.grade_scope.reviewer_id) ||
      !filled(evidence.grade_scope.local_locator) ||
      !webUrl(evidence.grade_scope.catalog_url) ||
      !hex(evidence.grade_scope.catalog_snapshot_hash) ||
      !same(evidence.grade_scope.local_grades, row.grade_scope.grades) ||
      !same(evidence.grade_scope.catalog_grades, row.grade_scope.grades) ||
      evidence.boundary?.verified !== true || !filled(evidence.boundary.reviewer_id) ||
      evidence.boundary.passage?.file_hash !== row.file_hash ||
      evidence.boundary.items?.file_hash !== row.file_hash ||
      !filled(evidence.boundary.passage.locator) || !filled(evidence.boundary.items.locator) ||
      !hex(evidence.boundary.passage.start_hash) || !hex(evidence.boundary.passage.end_hash) ||
      !hex(evidence.boundary.items.start_hash) || !hex(evidence.boundary.items.end_hash))
    fail('REFERENCE_PROVENANCE_INCOMPLETE')
  const rights = evidence.rights
  if (rights?.verified !== true || rights.file_hash !== row.file_hash ||
      !filled(rights.reviewer_id) || !hex(rights.evidence_hash) ||
      !hex(rights.license_snapshot_hash) ||
      rights.passage_covered !== true || rights.items_covered !== true ||
      rights.third_party_exception !== false ||
      (rules.cohort === 'open_reference' &&
        (!['CC-BY-4.0', 'CC0-1.0', 'US-GOV-PUBLIC-DOMAIN'].includes(rights.license) ||
          !webUrl(rights.license_url) ||
          (rights.license === 'US-GOV-PUBLIC-DOMAIN' &&
            (!governmentUrl(rights.license_url) ||
              !governmentUrl(rights.passage_origin_url) || !governmentUrl(rights.items_origin_url) ||
              !governmentUrl(rights.scoring_origin_url) ||
              !hex(rights.passage_origin_hash) || !hex(rights.items_origin_hash) ||
              !hex(rights.scoring_origin_hash))))) ||
      (rules.cohort === 'commercial_textbook' && rights.decision !== 'AUTHORIZED_FOR_ANALYSIS'))
    fail('REFERENCE_RIGHTS_UNVERIFIED')
  if (rules.cohort === 'open_reference' && rights.license === 'US-GOV-PUBLIC-DOMAIN') {
    if (rights.passage_origin_hash !== row.file_hash || rights.items_origin_hash !== row.file_hash ||
        !filled(scoring_source_path)) fail('REFERENCE_ORIGIN_FILE_UNVERIFIED')
    let scoringBytes
    try { scoringBytes = readFileSync(scoring_source_path) } catch { fail('REFERENCE_SCORING_SOURCE_UNREADABLE') }
    if (sha(scoringBytes) !== rights.scoring_origin_hash) fail('REFERENCE_SCORING_SOURCE_CHANGED')
  }
  if (!filled(candidate.passage_text) || !Array.isArray(candidate.questions) || !candidate.questions.length ||
      candidate.questions.some(item => !filled(item?.id) || !filled(item?.stem) || !filled(item?.answer) || !filled(item?.type)) ||
      new Set(candidate.questions.map(item => item.id)).size !== candidate.questions.length ||
      normalizedPassageHash(candidate.passage_text) !== row.passage_hash ||
      hash(candidate.questions.map(({ answer, ...item }) => item)) !== row.item_set_hash ||
      hash(candidate.questions.map(({ id, answer }) => ({ id, answer }))) !== row.scoring_key_hash)
    fail('REFERENCE_CONTENT_CHANGED')
  if (analysis?.codebook_hash !== rules.codebook_hash ||
      analysis.passage_hash !== row.passage_hash || analysis.item_set_hash !== row.item_set_hash ||
      !filled(analysis.analyzer_version) || !hex(analysis.evidence_hash) ||
      AXES.some(axis => !Number.isFinite(analysis.metrics?.[axis])) ||
      !analysis.item_type_difficulty ||
      candidate.questions.some(item => !Number.isFinite(analysis.item_type_difficulty[item.type])))
    fail('REFERENCE_NINE_AXIS_INCOMPLETE')
  if (hash(codebook) !== rules.measurement_contract_hash) fail('REFERENCE_MEASUREMENT_CONTRACT_CHANGED')
  verifyMeasurements(analysis, codebook, candidate.questions)
  const receipt = {
    schema: 'benchmark-reference-admission/1', cohort: rules.cohort,
    candidate_id: row.candidate_id, grade_scope: row.grade_scope,
    file_hash: row.file_hash, source_path_hash: row.source_path_hash,
    evidence_hash: row.evidence_hash,
    rules_hash: hash(rules), screening_hash: hash(screening), manifest_hash,
    analysis_hash: hash(analysis), codebook_hash: rules.codebook_hash,
    measurement_contract_hash: rules.measurement_contract_hash,
    passage_hash: row.passage_hash, item_set_hash: row.item_set_hash,
    scoring_key_hash: row.scoring_key_hash,
  }
  const reference = {
    sample_id: row.candidate_id, cohort: rules.cohort, grade_scope: row.grade_scope,
    passage_hash: row.passage_hash, admission_receipt_hash: hash(receipt),
    codebook_hash: rules.codebook_hash, rights_basis: rules.cohort === 'open_reference' ?
      (rights.license === 'US-GOV-PUBLIC-DOMAIN' ? 'public_domain_verified' : 'open_license_verified') :
      'authorized_local_analysis',
    publisher: candidate.publisher, series: candidate.series, genre: candidate.genre,
    word_count: candidate.passage_text.trim().split(/\s+/).length,
    metrics: analysis.metrics, item_type_difficulty: analysis.item_type_difficulty,
  }
  return { receipt, reference }
}
