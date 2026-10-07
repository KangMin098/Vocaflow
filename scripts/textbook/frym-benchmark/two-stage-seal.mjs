// scripts/textbook/frym-benchmark/two-stage-seal.mjs
import { GRADES, hash } from './benchmark.mjs'
import { recomputeSelection } from './selection-audit.mjs'

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const fail = code => { throw Error(code) }
const idList = values => Array.isArray(values) && values.every(value => typeof value === 'string' && value.length > 0) && new Set(values).size === values.length
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
const validSource = value => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.hash }
  catch { return false }
}
const forbiddenAnalysis = value => {
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(([key, child]) =>
    ['metrics', 'analysis', 'analysis_hash', 'axis_agreement', 'ordinal_reviews', 'item_type_difficulty'].includes(key) || forbiddenAnalysis(child))
}
const counts = values => Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(item => item === value).length]))
export const screeningInventoryHash = fileHashes => hash([...fileHashes].sort())
export const normalizedPassageHash = passage => hash(passage.trim().replace(/\s+/g, ' ').normalize('NFC'))

export function cohortComposition(screening, selectedIds) {
  const candidates = new Map(screening.candidates.map(row => [row.candidate_id, row]))
  return Object.fromEntries(GRADES.map(grade => {
    const rows = selectedIds.map(id => candidates.get(id)).filter(row => row?.grade === grade)
    const lengthBin = row => row.word_count < 150 ? 'short' : row.word_count < 300 ? 'medium' : 'long'
    return [grade, { count: rows.length, publishers: counts(rows.map(row => row.publisher)),
      series: counts(rows.map(row => JSON.stringify([row.publisher, row.series]))),
      genres: counts(rows.map(row => row.genre)), length_bins: counts(rows.map(lengthBin)) }]
  }))
}

export function cohortCoverage(composition, minimum, rules) {
  for (const grade of GRADES) {
    const row = composition[grade]
    if (row.count < minimum.per_grade || Object.keys(row.publishers).length < minimum.publishers ||
        Object.entries(row.publishers).some(([publisher, count]) => count / row.count > minimum.max_publisher_share ||
          Object.keys(row.series).filter(series => JSON.parse(series)[0] === publisher).length < minimum.series_per_publisher) ||
        Object.values(row.series).some(count => count / row.count > minimum.max_series_share) ||
        Object.entries(rules.genre_quota).some(([genre, count]) => (row.genres[genre] ?? 0) < count) ||
        ['short', 'medium', 'long'].some(bin => (row.length_bins[bin] ?? 0) < rules.length_bins.minimum_each)) return 'insufficient_benchmark'
  }
  return 'complete'
}

export function validateTwoStageSeal(protocol) {
  if (protocol?.schema !== 'frym-benchmark/2') fail('TWO_STAGE_PROTOCOL_REQUIRED')
  const rules = protocol.selection_protocol
  if (rules?.schema !== 'frym-selection-protocol/1' || rules.status !== 'sealed' ||
      !validDate(rules.search_cutoff) ||
      !Array.isArray(rules.search_sources) || !rules.search_sources.length ||
      rules.search_sources.some(source => !validSource(source)) ||
      typeof rules.run_id !== 'string' || !rules.run_id || typeof rules.seed !== 'string' || !rules.seed ||
      rules.selection_algorithm !== 'hash_rank_feasible_v1' ||
      hash(rules.genre_quota) !== hash({ expository: 12, argumentative: 12, narrative: 6 }) ||
      hash(rules.length_bins) !== hash({ short_max: 149, medium_max: 299, minimum_each: 6 }) ||
      !['single_grade_only'].includes(rules.grade_policy) ||
      !['authorized_local_analysis_only'].includes(rules.rights_policy) ||
      !['sample_only_flagged'].includes(rules.preview_policy) ||
      !['one_per_normalized_passage_hash'].includes(rules.duplicate_policy) ||
      !Array.isArray(rules.inventory_file_hashes) || !rules.inventory_file_hashes.length ||
      rules.inventory_file_hashes.some(fileHash => !hex(fileHash)) ||
      new Set(rules.inventory_file_hashes).size !== rules.inventory_file_hashes.length ||
      rules.inventory_snapshot_hash !== screeningInventoryHash(rules.inventory_file_hashes) ||
      rules.codebook_hash !== protocol.codebook_hash || rules.rules_hash !== hash({
        minimum: protocol.minimum, item_types: protocol.item_types, item_type_difficulty: protocol.item_type_difficulty,
        fit: protocol.fit, separation: protocol.separation,
      }) || forbiddenAnalysis(rules) || 'selected_sample_ids' in rules ||
      hash(rules) !== protocol.selection_protocol_hash) fail('SELECTION_PROTOCOL_STALE_OR_INVALID')

  const screening = protocol.metadata_screening
  if (screening?.schema !== 'frym-metadata-screening/1' || screening.status !== 'frozen' ||
      screening.run_id !== rules.run_id || screening.selection_protocol_hash !== protocol.selection_protocol_hash ||
      !hex(screening.inventory_snapshot_hash) || !Array.isArray(screening.candidates) ||
      !idList(screening.candidates.map(row => row?.candidate_id)) ||
      !Array.isArray(screening.held_file_hashes) || screening.held_file_hashes.some(fileHash => !hex(fileHash)) ||
      new Set(screening.held_file_hashes).size !== screening.held_file_hashes.length ||
      screening.held_file_hashes.some(fileHash => screening.candidates.some(row => row.file_hash === fileHash)) ||
      screening.inventory_snapshot_hash !== rules.inventory_snapshot_hash ||
      screeningInventoryHash(new Set([...screening.candidates.map(row => row.file_hash), ...screening.held_file_hashes])) !== rules.inventory_snapshot_hash ||
      forbiddenAnalysis(screening) || hash(screening) !== protocol.metadata_screening_hash) fail('METADATA_SCREENING_STALE_OR_INVALID')
  const candidates = new Map()
  for (const row of screening.candidates) {
    if (!hex(row.file_hash) || !['metadata_eligible', 'hold_metadata', 'reject_metadata'].includes(row.status) ||
        (row.status !== 'metadata_eligible' && (!Array.isArray(row.reasons) || !row.reasons.length || row.reasons.some(reason => typeof reason !== 'string' || !reason))) ||
        (row.status === 'metadata_eligible' && (typeof row.publisher !== 'string' || !row.publisher ||
          typeof row.series !== 'string' || !row.series || !GRADES.includes(row.grade) ||
          typeof row.title !== 'string' || !row.title || typeof row.passage_id !== 'string' || !row.passage_id ||
          typeof row.page !== 'string' || !row.page ||
          (!(typeof row.ISBN === 'string' && row.ISBN) &&
            !(typeof row.publisher_id === 'string' && row.publisher_id && typeof row.canonical_url === 'string' && /^https?:\/\//.test(row.canonical_url))) ||
          typeof row.edition !== 'string' || !row.edition ||
          !Number.isInteger(row.publication_year) || row.publication_year < 1900 ||
          row.rights_basis !== 'authorized_local_analysis' ||
          typeof row.difficulty_step !== 'string' || !row.difficulty_step || !validDate(row.access_date) || row.access_date > rules.search_cutoff ||
          !['expository', 'argumentative', 'narrative'].includes(row.genre) ||
          !Number.isInteger(row.word_count) || row.word_count < 1 ||
          !hex(row.normalized_passage_hash) ||
          !row.item_type_counts || Array.isArray(row.item_type_counts) ||
          Object.keys(row.item_type_counts).some(type => !protocol.item_types.includes(type) || !Number.isInteger(row.item_type_counts[type]) || row.item_type_counts[type] < 1) ||
          !Object.keys(row.item_type_counts).length))) fail('METADATA_CANDIDATE_INVALID')
    candidates.set(row.candidate_id, row)
  }
  const passageKeys = screening.candidates.filter(row => row.status === 'metadata_eligible').map(row => row.normalized_passage_hash)
  if (new Set(passageKeys).size !== passageKeys.length) fail('METADATA_DUPLICATE_PASSAGE')

  const manifest = protocol.selection_manifest
  if (manifest?.run_id !== rules.run_id || forbiddenAnalysis(manifest) || manifest.selection_protocol_hash !== protocol.selection_protocol_hash ||
      manifest.metadata_screening_hash !== protocol.metadata_screening_hash ||
      manifest.inventory_snapshot_hash !== screening.inventory_snapshot_hash ||
      !idList(manifest.selected_sample_ids) || !idList(manifest.excluded_candidate_ids) ||
      manifest.selected_sample_ids.some(id => candidates.get(id)?.status !== 'metadata_eligible') ||
      [...manifest.selected_sample_ids, ...manifest.excluded_candidate_ids].length !== candidates.size ||
      new Set([...manifest.selected_sample_ids, ...manifest.excluded_candidate_ids]).size !== candidates.size ||
      [...manifest.selected_sample_ids, ...manifest.excluded_candidate_ids].some(id => !candidates.has(id))) fail('SAMPLE_MANIFEST_STALE_OR_MIXED')
  const composition = cohortComposition(screening, manifest.selected_sample_ids)
  if (hash(composition) !== hash(manifest.cohort_composition)) fail('SAMPLE_MANIFEST_COMPOSITION_INVALID')
  if (manifest.coverage_status !== cohortCoverage(composition, protocol.minimum, rules)) fail('SAMPLE_MANIFEST_COVERAGE_INVALID')
  const recomputed = recomputeSelection(protocol)
  if (hash(manifest.selected_sample_ids) !== hash(recomputed.selected_sample_ids) ||
      hash(manifest.excluded_candidate_ids) !== hash(recomputed.excluded_candidate_ids) ||
      hash(manifest.excluded_reasons) !== hash(recomputed.excluded_reasons)) fail('SAMPLE_MANIFEST_SELECTION_INVALID')
  return { selection_protocol_hash: protocol.selection_protocol_hash, metadata_screening_hash: protocol.metadata_screening_hash, sample_manifest_hash: protocol.selection_manifest_hash }
}
