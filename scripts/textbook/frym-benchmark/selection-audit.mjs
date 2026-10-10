// scripts/textbook/frym-benchmark/selection-audit.mjs
import { createHash } from 'node:crypto'
import { GRADES } from './benchmark.mjs'

const rank = (seed, id) => createHash('sha256').update(`${seed}\n${id}`.normalize('NFC')).digest('hex')
const bin = (row, rules) => row.word_count <= rules.length_bins.short_max ? 'short' : row.word_count <= rules.length_bins.medium_max ? 'medium' : 'long'

function feasible(rows, protocol) {
  const { minimum, selection_protocol: rules, item_types: types } = protocol
  const n = minimum.per_grade
  if (rows.length !== n) return false
  const publishers = new Map()
  const series = new Map()
  const genres = new Map()
  const lengths = new Map()
  const itemTypes = new Map()
  for (const row of rows) {
    publishers.set(row.publisher, (publishers.get(row.publisher) ?? 0) + 1)
    const seriesKey = JSON.stringify([row.publisher, row.series])
    series.set(seriesKey, (series.get(seriesKey) ?? 0) + 1)
    genres.set(row.genre, (genres.get(row.genre) ?? 0) + 1)
    const length = bin(row, rules)
    lengths.set(length, (lengths.get(length) ?? 0) + 1)
    for (const type of types) if (row.item_type_counts[type] > 0) itemTypes.set(type, (itemTypes.get(type) ?? 0) + 1)
  }
  return publishers.size >= minimum.publishers &&
    [...publishers].every(([publisher, count]) => count / n <= minimum.max_publisher_share &&
      [...series].filter(([key]) => JSON.parse(key)[0] === publisher).length >= minimum.series_per_publisher) &&
    [...series.values()].every(count => count / n <= minimum.max_series_share) &&
    Object.entries(rules.genre_quota).every(([genre, count]) => genres.get(genre) === count) &&
    ['short', 'medium', 'long'].every(length => (lengths.get(length) ?? 0) >= rules.length_bins.minimum_each) &&
    types.every(type => (itemTypes.get(type) ?? 0) >= minimum.item_type_comparison_n)
}

function selectGrade(rows, protocol, maxStates) {
  const ordered = rows.sort((a, b) => rank(protocol.selection_protocol.seed, a.candidate_id).localeCompare(rank(protocol.selection_protocol.seed, b.candidate_id)) || a.candidate_id.localeCompare(b.candidate_id))
  const n = protocol.minimum.per_grade
  if (ordered.length < n) return ordered.map(row => row.candidate_id)
  const quota = protocol.selection_protocol.genre_quota
  const lengthMinimum = protocol.selection_protocol.length_bins.minimum_each
  if (Object.entries(quota).some(([genre, count]) => ordered.filter(row => row.genre === genre).length < count) ||
      ['short', 'medium', 'long'].some(length => ordered.filter(row => bin(row, protocol.selection_protocol) === length).length < lengthMinimum) ||
      protocol.item_types.some(type => ordered.filter(row => row.item_type_counts[type] > 0).length < protocol.minimum.item_type_comparison_n)) return []
  const chosen = []
  let states = 0
  function search(index) {
    if (++states > maxStates) throw Error('SELECTION_AUDIT_INCONCLUSIVE')
    if (chosen.length === n) return feasible(chosen, protocol)
    if (chosen.length + ordered.length - index < n) return false
    if (index >= ordered.length) return false
    for (const [genre, count] of Object.entries(quota)) {
      const current = chosen.filter(row => row.genre === genre).length
      if (current > count || current + ordered.slice(index).filter(row => row.genre === genre).length < count) return false
    }
    for (const length of ['short', 'medium', 'long']) {
      const current = chosen.filter(row => bin(row, protocol.selection_protocol) === length).length
      if (current + ordered.slice(index).filter(row => bin(row, protocol.selection_protocol) === length).length < lengthMinimum) return false
    }
    if (protocol.item_types.some(type => chosen.filter(row => row.item_type_counts[type] > 0).length + ordered.slice(index).filter(row => row.item_type_counts[type] > 0).length < protocol.minimum.item_type_comparison_n)) return false
    const publisherCap = Math.floor(n * protocol.minimum.max_publisher_share)
    const seriesCap = Math.floor(n * protocol.minimum.max_series_share)
    if (chosen.some(row => chosen.filter(item => item.publisher === row.publisher).length > publisherCap ||
      chosen.filter(item => item.publisher === row.publisher && item.series === row.series).length > seriesCap)) return false
    chosen.push(ordered[index])
    if (search(index + 1)) return true
    chosen.pop()
    return search(index + 1)
  }
  return search(0) ? chosen.map(row => row.candidate_id) : []
}

export function recomputeSelection(protocol, { maxStates = 1_000_000 } = {}) {
  if (!Number.isInteger(maxStates) || maxStates < 1) throw Error('SELECTION_AUDIT_LIMIT_INVALID')
  const candidates = protocol.metadata_screening.candidates
  const selected = GRADES.flatMap(grade => selectGrade(candidates.filter(row => row.status === 'metadata_eligible' && row.grade === grade), protocol, maxStates))
  const selectedSet = new Set(selected)
  const eligibleByGrade = new Map(GRADES.map(grade => [grade, candidates.filter(row => row.status === 'metadata_eligible' && row.grade === grade)]))
  const excluded = candidates.filter(row => !selectedSet.has(row.candidate_id))
  const excludedReasons = Object.fromEntries(excluded.map(row => [row.candidate_id,
    row.status !== 'metadata_eligible' ? `${row.status}:${row.reasons.join('|')}` :
      (eligibleByGrade.get(row.grade).length >= protocol.minimum.per_grade && !selected.some(id => eligibleByGrade.get(row.grade).some(candidate => candidate.candidate_id === id))) ? 'grade_infeasible' : 'not_selected_by_sealed_ranking']))
  return { selected_sample_ids: selected, excluded_candidate_ids: excluded.map(row => row.candidate_id), excluded_reasons: excludedReasons }
}
