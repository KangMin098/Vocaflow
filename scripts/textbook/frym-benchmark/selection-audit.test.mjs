// scripts/textbook/frym-benchmark/selection-audit.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { recomputeSelection } from './selection-audit.mjs'

const digest = id => createHash('sha256').update(`fixed-seed\n${id}`.normalize('NFC')).digest('hex')
const rows = Array.from({ length: 7 }, (_, i) => ({
  candidate_id: `sample-${i}`, status: 'metadata_eligible', grade: 'middle_1',
  publisher: `publisher-${Math.floor(i / 2)}`, series: `series-${i}`,
  genre: i < 2 ? 'expository' : i < 4 ? 'argumentative' : 'narrative',
  word_count: i % 3 === 0 ? 100 : i % 3 === 1 ? 200 : 300,
  item_type_counts: { literal: 1, inference: 1 },
}))
const protocol = {
  metadata_screening: { candidates: rows }, item_types: ['literal', 'inference'],
  minimum: { per_grade: 6, publishers: 3, series_per_publisher: 2, max_publisher_share: .4, max_series_share: .2, item_type_comparison_n: 1 },
  selection_protocol: { seed: 'fixed-seed', genre_quota: { expository: 2, argumentative: 2, narrative: 2 }, length_bins: { short_max: 149, medium_max: 299, minimum_each: 2 } },
}

test('selection audit independently chooses the first feasible hash-ranked cohort', () => {
  const result = recomputeSelection(protocol)
  const expected = rows.slice(0, 6).map(row => row.candidate_id).sort((a, b) => digest(a).localeCompare(digest(b)) || a.localeCompare(b))
  assert.deepEqual(result.selected_sample_ids, expected)
  assert.deepEqual(result.excluded_candidate_ids, ['sample-6'])
  assert.equal(result.excluded_reasons['sample-6'], 'not_selected_by_sealed_ranking')
})

test('selection audit records hold reasons and does not rank held rows', () => {
  const changed = structuredClone(protocol)
  changed.metadata_screening.candidates[6].status = 'hold_metadata'
  changed.metadata_screening.candidates[6].reasons = ['EDITION_UNCONFIRMED']
  const result = recomputeSelection(changed)
  assert.equal(result.excluded_reasons['sample-6'], 'hold_metadata:EDITION_UNCONFIRMED')
  assert.equal(result.selected_sample_ids.length, 6)
})

test('selection audit fails closed when exact feasibility search exceeds its bound', () => {
  assert.throws(() => recomputeSelection(protocol, { maxStates: 1 }), /SELECTION_AUDIT_INCONCLUSIVE/)
})

test('insufficient cohort is deterministic but cannot claim complete coverage', () => {
  const changed = structuredClone(protocol)
  changed.metadata_screening.candidates = changed.metadata_screening.candidates.slice(0, 2)
  assert.deepEqual(recomputeSelection(changed).selected_sample_ids, changed.metadata_screening.candidates.map(row => row.candidate_id).sort((a, b) => digest(a).localeCompare(digest(b))))
})

test('real-size infeasible genre supply closes without exhausting the search bound', () => {
  const changed = structuredClone(protocol)
  changed.minimum.per_grade = 30
  changed.selection_protocol.genre_quota = { expository: 12, argumentative: 12, narrative: 6 }
  changed.metadata_screening.candidates = Array.from({ length: 40 }, (_, i) => ({ ...rows[i % rows.length], candidate_id: `large-${i}`, genre: 'expository' }))
  const result = recomputeSelection(changed, { maxStates: 100 })
  assert.deepEqual(result.selected_sample_ids, [])
  assert.equal(result.excluded_reasons['large-0'], 'grade_infeasible')
})
