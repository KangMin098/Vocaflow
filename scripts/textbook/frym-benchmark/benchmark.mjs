// scripts/textbook/frym-benchmark/benchmark.mjs
import { createHash } from 'node:crypto'

export const AXES = Object.freeze([
  'lexical', 'syntax', 'information_density', 'discourse', 'inference',
  'background_knowledge', 'abstraction', 'item_difficulty', 'processing_load',
])
export const GRADES = Object.freeze(['elementary_5', 'elementary_6', 'middle_1', 'middle_2', 'middle_3', 'high_1', 'high_2', 'high_3'])
const REQUIRED_AXES = new Set(AXES.slice(0, 5))
const HEX = /^[a-f0-9]{64}$/
const fail = (code) => { throw Error(code) }
const isHex = (value) => typeof value === 'string' && HEX.test(value)
const isText = (value) => typeof value === 'string' && value.trim().length > 0

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  }
  return value
}

export const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
const unique = values => new Set(values).size
const quantile = (sorted, p) => {
  const at = (sorted.length - 1) * p
  const lo = Math.floor(at), hi = Math.ceil(at)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo)
}
const stats = values => {
  const sorted = [...values].sort((a, b) => a - b)
  const p25 = quantile(sorted, .25), p75 = quantile(sorted, .75)
  return { n: sorted.length, p10: quantile(sorted, .1), p25, median: quantile(sorted, .5), p75, iqr: p75 - p25, p90: quantile(sorted, .9) }
}

export function validateProtocol(protocol) {
  if (protocol?.schema !== 'frym-benchmark/1' || protocol.status !== 'sealed' || !isText(protocol.version) || !isHex(protocol.codebook_hash) || !isHex(protocol.selection_manifest_hash)) fail('PROTOCOL_UNSEALED')
  const selection = protocol.selection_manifest
  if (selection?.schema !== 'frym-benchmark-selection/1' || selection.status !== 'sealed' || !Array.isArray(selection.selected_sample_ids) || unique(selection.selected_sample_ids) !== selection.selected_sample_ids.length || selection.selected_sample_ids.some(id => !isText(id)) || hash(selection) !== protocol.selection_manifest_hash) fail('SELECTION_MANIFEST_INVALID')
  if (!Array.isArray(protocol.grades) || protocol.grades.join('|') !== GRADES.join('|')) fail('GRADES_INVALID')
  const m = protocol.minimum
  if (!Number.isInteger(m?.per_grade) || m.per_grade < 30 || !Number.isInteger(m.publishers) || m.publishers < 3 || !Number.isInteger(m.series_per_publisher) || m.series_per_publisher < 2 || !(m.max_publisher_share > 0 && m.max_publisher_share <= .4) || !(m.max_series_share > 0 && m.max_series_share <= .2) || !Number.isInteger(m.comparison_n) || m.comparison_n < 12) fail('MINIMUM_INVALID')
  if (Object.keys(protocol.axes ?? {}).sort().join('|') !== [...AXES].sort().join('|') || hash(protocol.axes) !== protocol.codebook_hash) fail('AXES_INCOMPLETE')
  for (const axis of AXES) {
    const def = protocol.axes[axis]
    if (!['ratio', 'ordinal'].includes(def?.scale) || !isText(def.metric) || !isText(def.unit) || !isText(def.measurement_method) || !isText(def.missing_rule) || !isText(def.rater_policy) || ![1, -1].includes(def.direction) || (def.scale === 'ordinal' && (!Array.isArray(def.levels) || def.levels.length < 2 || unique(def.levels) !== def.levels.length))) fail('AXIS_DEFINITION_INVALID')
  }
  if (protocol.fit?.lower_quantile !== .1 || protocol.fit?.upper_quantile !== .9 || protocol.fit?.minimum_axes !== 7 || protocol.fit?.length_ratio_min !== .75 || protocol.fit?.length_ratio_max !== 1.25 || protocol.separation?.minimum_stable_axes !== 5 || protocol.separation?.minimum_matching_axes !== 3 || protocol.separation?.minimum_reference_ratio !== .5 || protocol.separation?.maximum_opposite_axes !== 1) fail('DECISION_RULES_INVALID')
  return hash(protocol)
}

export function screenSample(sample, protocol) {
  const reasons = []
  const required = ['sample_id', 'publisher', 'series', 'title', 'edition', 'difficulty_step', 'passage_id', 'page', 'genre', 'source_method', 'rights_basis', 'analyzer_version', 'evidence_locator']
  if (required.some(key => !isText(sample?.[key])) || !(isText(sample?.ISBN) || (isText(sample?.publisher_id) && isText(sample?.canonical_url)))) reasons.push('PROVENANCE_INCOMPLETE')
  if (!Number.isInteger(sample?.publication_year) || sample.publication_year < 1900) reasons.push('PUBLICATION_YEAR_INVALID')
  if (!protocol.grades.includes(sample?.grade) || sample?.grade?.includes('~')) reasons.push('GRADE_NOT_SINGLE')
  if (!['expository', 'argumentative', 'narrative'].includes(sample?.genre)) reasons.push('GENRE_INVALID')
  if (sample?.rights_basis !== 'authorized_local_analysis') reasons.push('RIGHTS_UNCONFIRMED')
  if (!isHex(sample?.analysis_hash) || !isHex(sample?.passage_hash) || !isHex(sample?.item_set_hash) || !isHex(sample?.scoring_key_hash)) reasons.push('INPUT_HASH_MISSING')
  if (!Number.isInteger(sample?.word_count) || sample.word_count < 1 || !Number.isInteger(sample?.item_count) || sample.item_count < 1) reasons.push('PASSAGE_OR_ITEMS_MISSING')
  if (sample?.codebook_hash !== protocol.codebook_hash || sample?.selection_manifest_hash !== protocol.selection_manifest_hash) reasons.push('PROTOCOL_INPUT_MISMATCH')
  if (!protocol.selection_manifest.selected_sample_ids.includes(sample?.sample_id)) reasons.push('NOT_SELECTED')
  for (const axis of AXES) {
    const value = sample?.metrics?.[axis]
    const def = protocol.axes[axis]
    if (!Number.isFinite(value) || (def.scale === 'ordinal' && (!Number.isInteger(value) || value < 0 || value >= def.levels.length))) reasons.push(`AXIS_MISSING:${axis}`)
  }
  return [...new Set(reasons)]
}

export function buildBenchmark(protocol, samples) {
  const protocol_hash = validateProtocol(protocol)
  if (!Array.isArray(samples)) fail('SAMPLES_NOT_ARRAY')
  const seen = new Set(), passageHashes = new Set()
  const rejected = [], accepted = []
  for (const sample of samples) {
    const reasons = screenSample(sample, protocol)
    if (seen.has(sample?.sample_id)) reasons.push('DUPLICATE_SAMPLE_ID')
    if (isHex(sample?.passage_hash) && passageHashes.has(sample.passage_hash)) reasons.push('DUPLICATE_PASSAGE')
    seen.add(sample?.sample_id)
    if (isHex(sample?.passage_hash)) passageHashes.add(sample.passage_hash)
    if (reasons.length) rejected.push({ sample_id: sample?.sample_id ?? null, reasons })
    else accepted.push(sample)
  }
  const grades = {}
  for (const grade of protocol.grades) {
    const rows = accepted.filter(row => row.grade === grade)
    const publishers = [...new Set(rows.map(row => row.publisher))]
    const reasons = []
    if (rows.length < protocol.minimum.per_grade) reasons.push('INSUFFICIENT_SAMPLE')
    if (publishers.length < protocol.minimum.publishers) reasons.push('INSUFFICIENT_PUBLISHERS')
    if (rows.filter(row => row.genre === 'expository').length < 12 || rows.filter(row => row.genre === 'argumentative').length < 12 || rows.filter(row => row.genre === 'narrative').length < 6) reasons.push('GENRE_COVERAGE')
    if (rows.filter(row => row.word_count < 150).length < 6 || rows.filter(row => row.word_count >= 150 && row.word_count < 300).length < 6 || rows.filter(row => row.word_count >= 300).length < 6) reasons.push('LENGTH_COVERAGE')
    for (const publisher of publishers) {
      const own = rows.filter(row => row.publisher === publisher)
      if (unique(own.map(row => row.series)) < protocol.minimum.series_per_publisher) reasons.push('INSUFFICIENT_SERIES')
      if (own.length / rows.length > protocol.minimum.max_publisher_share) reasons.push('PUBLISHER_CONCENTRATION')
    }
    for (const series of new Set(rows.map(row => `${row.publisher}\u0000${row.series}`))) {
      if (rows.filter(row => `${row.publisher}\u0000${row.series}` === series).length / rows.length > protocol.minimum.max_series_share) reasons.push('SERIES_CONCENTRATION')
    }
    const distribution = reasons.length ? null : Object.fromEntries(AXES.map(axis => [axis, stats(rows.map(row => row.metrics[axis]))]))
    grades[grade] = { status: reasons.length ? 'insufficient_benchmark' : 'calibrated', reasons: [...new Set(reasons)], n: rows.length, publishers: publishers.length, sample_ids: rows.map(row => row.sample_id).sort(), distribution }
  }
  const snapshot = { schema: 'frym-benchmark-snapshot/1', benchmark_version: protocol.version, protocol_hash, selection_manifest_hash: protocol.selection_manifest_hash, codebook_hash: protocol.codebook_hash, sample_set_hash: hash([...accepted].sort((a, b) => a.sample_id.localeCompare(b.sample_id))), rejected, grades }
  return { ...snapshot, snapshot_hash: hash(snapshot) }
}

export function verifySnapshot(snapshot, protocol) {
  if (snapshot?.schema !== 'frym-benchmark-snapshot/1' || snapshot.protocol_hash !== validateProtocol(protocol) || snapshot.benchmark_version !== protocol.version || snapshot.selection_manifest_hash !== protocol.selection_manifest_hash || snapshot.codebook_hash !== protocol.codebook_hash || snapshot.snapshot_hash !== hash(Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== 'snapshot_hash')))) fail('BENCHMARK_STALE')
  return true
}

function comparisonRows(samples, grade, variant, protocol) {
  return samples.filter(row => row.grade === grade && row.genre === variant.genre && row.word_count >= variant.word_count * protocol.fit.length_ratio_min && row.word_count <= variant.word_count * protocol.fit.length_ratio_max)
}

export function judgeBenchmark({ protocol, snapshot, samples, f02, e3 }) {
  verifySnapshot(snapshot, protocol)
  const acceptedIds = new Set(Object.values(snapshot.grades).flatMap(grade => grade.sample_ids))
  const accepted = samples.filter(row => acceptedIds.has(row.sample_id))
  if (accepted.length !== acceptedIds.size || hash([...accepted].sort((a, b) => a.sample_id.localeCompare(b.sample_id))) !== snapshot.sample_set_hash || accepted.some(row => screenSample(row, protocol).length)) fail('BENCHMARK_SAMPLE_CHANGED')
  const { analysis_hash, ...f02Analysis } = f02 ?? {}
  if (f02?.codebook_hash !== protocol.codebook_hash || analysis_hash !== hash(f02Analysis) || !['middle_1', 'high_1'].every(grade => {
    const variant = f02?.variants?.[grade]
    return variant && ['expository', 'argumentative', 'narrative'].includes(variant.genre) && Number.isInteger(variant.word_count) && variant.word_count > 0 && AXES.every(axis => Number.isFinite(variant.metrics?.[axis]))
  })) fail('F02_ANALYSIS_INVALID')
  if (!isHex(f02?.source_freeze_sha256) || !isHex(f02?.item_set_hash) || !isHex(f02?.scoring_key_hash) || !['middle_1', 'high_1'].every(grade => isHex(f02?.variants?.[grade]?.passage_hash) && f02.variants[grade].passage_hash === e3?.seal?.passage_hash?.[grade]) || f02.item_set_hash !== e3?.seal?.item_set_hash || f02.scoring_key_hash !== e3?.seal?.scoring_key_hash || f02.source_freeze_sha256 !== e3?.seal?.source_freeze_sha256) fail('F02_INPUT_STALE')
  const results = {}
  for (const grade of ['middle_1', 'high_1']) {
    const variant = f02.variants[grade]
    const reference = comparisonRows(accepted, grade, variant, protocol)
    const publishers = unique(reference.map(row => row.publisher))
    if (snapshot.grades[grade]?.status !== 'calibrated' || reference.length < protocol.minimum.comparison_n || publishers < protocol.minimum.publishers) {
      results[grade] = { status: 'insufficient_benchmark', n: reference.length }
      continue
    }
    const axes = {}
    for (const axis of AXES) {
      const dist = stats(reference.map(row => row.metrics[axis]))
      const value = variant.metrics?.[axis]
      axes[axis] = Number.isFinite(value) ? { status: value >= dist.p10 && value <= dist.p90 ? 'pass' : 'fail', value, p10: dist.p10, p90: dist.p90 } : { status: 'inconclusive' }
    }
    const core = [...REQUIRED_AXES].every(axis => axes[axis].status === 'pass')
    const pass = Object.values(axes).filter(result => result.status === 'pass').length
    results[grade] = { status: Object.values(axes).some(result => result.status === 'inconclusive') ? 'inconclusive' : core && pass >= protocol.fit.minimum_axes ? 'pass' : 'fail', n: reference.length, axes }
  }
  const middle = f02.variants.middle_1, high = f02.variants.high_1
  let separation = { status: 'insufficient_benchmark' }
  const lowRows = comparisonRows(accepted, 'middle_1', middle, protocol)
  const highRows = comparisonRows(accepted, 'high_1', high, protocol)
  const commonGenre = middle.genre === high.genre
  const commonLength = Math.max(middle.word_count * .75, high.word_count * .75) <= Math.min(middle.word_count * 1.25, high.word_count * 1.25)
  const lowBound = Math.max(middle.word_count * .75, high.word_count * .75)
  const highBound = Math.min(middle.word_count * 1.25, high.word_count * 1.25)
  const commonLowRows = lowRows.filter(row => row.word_count >= lowBound && row.word_count <= highBound)
  const commonHighRows = highRows.filter(row => row.word_count >= lowBound && row.word_count <= highBound)
  if (commonGenre && commonLength && commonLowRows.length >= protocol.minimum.comparison_n && commonHighRows.length >= protocol.minimum.comparison_n && unique(commonLowRows.map(row => row.publisher)) >= protocol.minimum.publishers && unique(commonHighRows.map(row => row.publisher)) >= protocol.minimum.publishers && snapshot.grades.middle_1?.status === 'calibrated' && snapshot.grades.high_1?.status === 'calibrated') {
    const stable = [], matching = [], opposite = []
    for (const axis of AXES) {
      const def = protocol.axes[axis]
      const refDelta = stats(commonHighRows.map(row => row.metrics[axis])).median - stats(commonLowRows.map(row => row.metrics[axis])).median
      const f02Delta = high.metrics?.[axis] - middle.metrics?.[axis]
      if (!Number.isFinite(f02Delta) || refDelta === 0 || Math.sign(refDelta) !== def.direction) continue
      const direction = Math.sign(refDelta)
      const publisherStable = [...new Set([...commonLowRows, ...commonHighRows].map(row => row.publisher))].every(publisher => {
        const lo = commonLowRows.filter(row => row.publisher !== publisher), hi = commonHighRows.filter(row => row.publisher !== publisher)
        return lo.length && hi.length && Math.sign(stats(hi.map(row => row.metrics[axis])).median - stats(lo.map(row => row.metrics[axis])).median) === direction
      })
      if (!publisherStable) continue
      stable.push(axis)
      if (Math.sign(f02Delta) === direction && (def.scale === 'ordinal' || Math.abs(f02Delta) >= Math.abs(refDelta) * protocol.separation.minimum_reference_ratio)) matching.push(axis)
      else if (Math.sign(f02Delta) === -direction) opposite.push(axis)
    }
    separation = stable.length < protocol.separation.minimum_stable_axes || (!stable.includes('discourse') && !stable.includes('inference')) ? { status: 'inconclusive', stable, matching, opposite } : { status: matching.length >= protocol.separation.minimum_matching_axes && matching.some(axis => axis === 'discourse' || axis === 'inference') && opposite.length <= protocol.separation.maximum_opposite_axes ? 'pass' : 'fail', stable, matching, opposite }
  }
  const e3Valid = e3?.status === 'verified' && e3?.valid_n === 28 && isText(e3?.run_id)
  const candidate = e3Valid && Object.values(snapshot.grades).every(grade => grade.status === 'calibrated') && results.middle_1.status === 'pass' && results.high_1.status === 'pass' && separation.status === 'pass'
  const basis = { benchmark_version: snapshot.benchmark_version, benchmark_snapshot_hash: snapshot.snapshot_hash, f02_input_hash: hash(f02), e3_run_id: e3?.run_id ?? null, target_fit: results, level_separation: separation, gold_s_candidate: candidate, gold_s: false, db_seed: false }
  return { ...basis, decision_hash: hash(basis) }
}

export function verifyDecision(decision, current) {
  const { decision_hash, ...body } = decision
  if (decision_hash !== hash(body) || decision.benchmark_version !== current.benchmark_version || decision.benchmark_snapshot_hash !== current.benchmark_snapshot_hash || decision.f02_input_hash !== current.f02_input_hash || decision.e3_run_id !== current.e3_run_id) return { status: 'stale' }
  return { status: 'current' }
}

export function workflowState({ protocol, snapshot, decision, current } = {}) {
  if (!protocol || protocol.status !== 'sealed') return 'draft'
  validateProtocol(protocol)
  if (!snapshot) return 'sealed'
  verifySnapshot(snapshot, protocol)
  if (Object.values(snapshot.grades).some(grade => grade.status !== 'calibrated')) return 'insufficient_benchmark'
  if (!decision) return 'benchmark_calibrated'
  if (verifyDecision(decision, current ?? {}).status === 'stale') return 'stale'
  if (decision.target_fit.middle_1.status === 'insufficient_benchmark' || decision.target_fit.high_1.status === 'insufficient_benchmark' || decision.level_separation.status === 'insufficient_benchmark') return 'insufficient_benchmark'
  if (decision.target_fit.middle_1.status === 'inconclusive' || decision.target_fit.high_1.status === 'inconclusive' || decision.level_separation.status === 'inconclusive') return 'inconclusive'
  if (decision.target_fit.middle_1.status === 'fail' || decision.target_fit.high_1.status === 'fail' || decision.level_separation.status === 'fail') return 'fail'
  return decision.gold_s_candidate ? 'gold_s_candidate' : 'evaluated_not_candidate'
}
