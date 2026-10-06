// scripts/textbook/frym-benchmark/benchmark.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { AXES, GRADES, buildBenchmark, hash, judgeBenchmark, sampleAnalysisHash, screenSample, verifyDecision, verifySnapshot, workflowState } from './benchmark.mjs'

const H = text => hash(text)
const axisDefs = Object.fromEntries(AXES.map(axis => [axis, { metric: `${axis}_score`, scale: 'ratio', unit: 'fixture_score', measurement_method: 'synthetic_fixture', missing_rule: 'inconclusive', rater_policy: 'independent', direction: 1, resolution: .1, minimum_meaningful_delta: .5 }]))
const selection = { schema: 'frym-benchmark-selection/1', status: 'sealed', selected_sample_ids: GRADES.flatMap(grade => Array.from({ length: 30 }, (_, index) => `${grade}-${index}`)) }
const protocol = () => ({
  schema: 'frym-benchmark/1', status: 'sealed', version: 'fixture-v1', codebook_hash: hash(axisDefs), selection_manifest: structuredClone(selection), selection_manifest_hash: hash(selection), grades: [...GRADES],
  minimum: { per_grade: 30, publishers: 3, series_per_publisher: 2, max_publisher_share: .4, max_series_share: .2, comparison_n: 12 },
  axes: structuredClone(axisDefs),
  fit: { lower_quantile: .1, upper_quantile: .9, minimum_axes: 7, length_ratio_min: .75, length_ratio_max: 1.25 },
  separation: { minimum_stable_axes: 5, minimum_matching_axes: 3, minimum_reference_ratio: .5, maximum_opposite_axes: 1 },
})
const samples = (p = protocol()) => GRADES.flatMap(grade => Array.from({ length: 30 }, (_, index) => {
  const id = `${grade}-${index}`
  const base = (grade === 'high_1' ? 7 : grade === 'middle_1' ? 5 : 4) + (index % 5 - 2) * .1
  const slot = index % 10
  const row = { sample_id: id, publisher: `publisher-${Math.floor(index / 10)}`, series: `series-${Math.floor(index / 5)}`, title: `title-${id}`, grade, edition: 'fixture-1', publication_year: 2026, difficulty_step: 'fixture-level', ISBN: `fixture-isbn-${id}`, passage_id: `passage-${id}`, page: '1', genre: slot < 4 ? 'expository' : slot < 8 ? 'argumentative' : 'narrative', source_method: 'fixture', rights_basis: 'authorized_local_analysis', analyzer_version: 'fixture-v1', evidence_locator: `fixture:${id}`, access_date: '2026-10-06', passage_hash: H(`passage-${id}`), item_set_hash: H(`items-${id}`), scoring_key_hash: H(`key-${id}`), word_count: slot < 4 ? 100 : slot < 8 ? 200 : 300, item_count: 3, codebook_hash: p.codebook_hash, selection_manifest_hash: p.selection_manifest_hash, metrics: Object.fromEntries(AXES.map(axis => [axis, base])) }
  return { ...row, analysis_hash: sampleAnalysisHash(row) }
}))
const resealRows = rows => { for (const row of rows) row.analysis_hash = sampleAnalysisHash(row); return rows }
const reseal = value => { const { analysis_hash, ...body } = value; return { ...body, analysis_hash: hash(body) } }
const f02 = () => reseal({ codebook_hash: hash(axisDefs), source_freeze_sha256: H('freeze'), item_set_hash: H('f02-items'), scoring_key_hash: H('f02-key'), variants: Object.fromEntries(['middle_1', 'high_1'].map((grade, i) => [grade, { passage_hash: H(`f02-${grade}`), genre: 'expository', word_count: 100, metrics: Object.fromEntries(AXES.map(axis => [axis, i ? 7 : 5])) }])) })
const e3 = (f = f02()) => ({ status: 'verified', valid_n: 28, run_id: 'fixture-run', evidence_hash: H('fixture-e3-audit-files'), seal: { source_freeze_sha256: f.source_freeze_sha256, item_set_hash: f.item_set_hash, scoring_key_hash: f.scoring_key_hash, passage_hash: Object.fromEntries(Object.entries(f.variants).map(([grade, variant]) => [grade, variant.passage_hash])) } })
const judge = (p = protocol(), rows = samples(p), f = f02(), evidence = e3(f)) => judgeBenchmark({ protocol: p, snapshot: buildBenchmark(p, rows), samples: rows, f02: f, e3: evidence })

test('fixture alone builds complete distributions and a Gold-S candidate, never Gold-S', () => {
  const p = protocol(), rows = samples(p), snapshot = buildBenchmark(p, rows), result = judge(p, rows)
  assert.equal(snapshot.grades.middle_1.status, 'calibrated')
  assert.equal(snapshot.grades.high_1.distribution.lexical.n, 30)
  assert.equal(result.target_fit.middle_1.status, 'pass')
  assert.equal(result.target_fit.high_1.status, 'pass')
  assert.equal(result.level_separation.status, 'pass')
  assert.equal(result.gold_s_candidate, true)
  assert.equal(result.gold_s, false)
  assert.equal(result.db_seed, false)
  assert.equal(workflowState({ protocol: p, snapshot, decision: result, current: { benchmark_version: p.version, benchmark_snapshot_hash: snapshot.snapshot_hash, f02_input_hash: hash(f02()), e3_run_id: 'fixture-run', e3_evidence_hash: H('fixture-e3-audit-files') } }), 'gold_s_candidate')
})

test('missing item, multiple-grade label, and rights uncertainty stay out of distributions', () => {
  const p = protocol(), rows = samples(p)
  const middle = rows.filter(row => row.grade === 'middle_1')
  middle[0].item_count = 0
  middle[1].grade = 'middle_1~middle_2'
  middle[2].rights_basis = 'unknown'
  const snapshot = buildBenchmark(p, rows)
  assert.equal(snapshot.grades.middle_1.status, 'insufficient_benchmark')
  assert.equal(snapshot.grades.middle_1.n, 27)
  assert.deepEqual(snapshot.rejected.map(row => row.reasons[0]), ['PASSAGE_OR_ITEMS_MISSING', 'GRADE_NOT_SINGLE', 'RIGHTS_UNCONFIRMED'])
})

test('out-of-band core axis fails target fit without being averaged away', () => {
  const p = protocol(), rows = samples(p), f = f02()
  f.variants.middle_1.metrics.lexical = 100
  const result = judge(p, rows, reseal(f))
  assert.equal(result.target_fit.middle_1.status, 'fail')
  assert.equal(result.gold_s_candidate, false)
})

test('overlapping grade distributions do not force a separation pass', () => {
  const p = protocol(), rows = samples(p), f = f02()
  for (const row of rows.filter(row => row.grade === 'high_1')) for (const axis of AXES) row.metrics[axis] -= 2
  resealRows(rows)
  for (const axis of AXES) f.variants.high_1.metrics[axis] -= 2
  const result = judge(p, rows, reseal(f))
  assert.equal(result.level_separation.status, 'inconclusive')
  assert.equal(result.gold_s_candidate, false)
})

test('insufficient publishers or samples cannot calibrate', () => {
  const p = protocol(), rows = samples(p).filter(row => row.grade === 'high_1' || row.publisher !== 'publisher-2')
  const snapshot = buildBenchmark(p, rows)
  assert.equal(snapshot.grades.middle_1.status, 'insufficient_benchmark')
  assert.equal(judge(p, rows).target_fit.middle_1.status, 'insufficient_benchmark')
})

test('genre and length concentration prevent calibration', () => {
  const p = protocol(), rows = samples(p)
  for (const row of rows.filter(row => row.grade === 'middle_1')) { row.genre = 'expository'; row.word_count = 100 }
  const snapshot = buildBenchmark(p, rows)
  assert.ok(snapshot.grades.middle_1.reasons.includes('GENRE_COVERAGE'))
  assert.ok(snapshot.grades.middle_1.reasons.includes('LENGTH_COVERAGE'))
  assert.equal(workflowState({ protocol: p, snapshot }), 'insufficient_benchmark')
})

test('benchmark version, sealed codebook, sample measurements and F02 seal invalidate decisions', () => {
  const p = protocol(), rows = samples(p), snapshot = buildBenchmark(p, rows), f = f02(), result = judge(p, rows, f)
  assert.equal(verifyDecision(result, { benchmark_version: p.version, benchmark_snapshot_hash: snapshot.snapshot_hash, f02_input_hash: hash(f), e3_run_id: 'fixture-run', e3_evidence_hash: H('fixture-e3-audit-files') }).status, 'current')
  assert.equal(verifyDecision(result, { benchmark_version: p.version, benchmark_snapshot_hash: snapshot.snapshot_hash, f02_input_hash: hash(f), e3_run_id: 'fixture-run', e3_evidence_hash: H('changed-e3-audit-files') }).status, 'stale')
  assert.equal(verifyDecision(result, { benchmark_version: 'fixture-v2', benchmark_snapshot_hash: snapshot.snapshot_hash, f02_input_hash: hash(f), e3_run_id: 'fixture-run' }).status, 'stale')
  assert.throws(() => verifySnapshot(snapshot, { ...p, version: 'fixture-v2' }), /BENCHMARK_STALE/)
  rows[0].metrics.lexical += 1
  assert.throws(() => judgeBenchmark({ protocol: p, snapshot, samples: rows, f02: f, e3: e3(f) }), /BENCHMARK_SAMPLE_CHANGED/)
  const cleanRows = samples(p), cleanSnapshot = buildBenchmark(p, cleanRows)
  f.variants.middle_1.passage_hash = H('changed')
  assert.throws(() => judgeBenchmark({ protocol: p, snapshot: cleanSnapshot, samples: cleanRows, f02: reseal(f), e3: e3() }), /F02_INPUT_STALE/)
})

test('unsealed protocol and malformed axis cannot open benchmark', () => {
  const p = protocol()
  p.status = 'draft'
  assert.throws(() => buildBenchmark(p, []), /PROTOCOL_UNSEALED/)
  p.status = 'sealed'
  delete p.axes.inference
  assert.throws(() => buildBenchmark(p, []), /AXES_INCOMPLETE/)
  assert.ok(screenSample(samples(protocol())[0], protocol()).length === 0)
})

test('selection manifest prevents unselected samples and mutation', () => {
  const p = protocol(), rows = samples(p)
  rows[0].sample_id = 'unselected'
  resealRows(rows)
  const snapshot = buildBenchmark(p, rows)
  assert.equal(snapshot.rejected[0].reasons.includes('NOT_SELECTED'), true)
  p.selection_manifest.selected_sample_ids.push('later-added')
  assert.throws(() => buildBenchmark(p, rows), /SELECTION_MANIFEST_INVALID/)
})

test('ordinal discourse uses ordered anchors rather than a ratio threshold', () => {
  const p = protocol(), rows = samples(p), f = f02()
  p.axes.discourse = { metric: 'discourse_anchor', scale: 'ordinal', unit: 'anchor', measurement_method: 'synthetic_fixture', missing_rule: 'inconclusive', rater_policy: 'independent', direction: 1, resolution: 1, minimum_meaningful_delta: 1, levels: ['low', 'medium', 'high'] }
  p.codebook_hash = hash(p.axes)
  for (const row of rows) row.codebook_hash = p.codebook_hash
  for (const row of rows) row.metrics.discourse = row.grade === 'high_1' ? 2 : 1
  for (const row of rows) row.ordinal_reviews = { discourse: { rater_a_id: 'expert-a', rater_b_id: 'expert-b', rater_a: row.metrics.discourse, rater_b: row.metrics.discourse } }
  resealRows(rows)
  f.variants.middle_1.metrics.discourse = 1
  f.variants.high_1.metrics.discourse = 2
  for (const grade of ['middle_1', 'high_1']) f.variants[grade].ordinal_reviews = { discourse: { rater_a_id: 'expert-a', rater_b_id: 'expert-b', rater_a: f.variants[grade].metrics.discourse, rater_b: f.variants[grade].metrics.discourse } }
  f.codebook_hash = p.codebook_hash
  const result = judge(p, rows, reseal(f))
  assert.equal(result.level_separation.status, 'pass')
  f.variants.high_1.metrics.discourse = 100
  assert.throws(() => judge(p, rows, reseal(f)), /F02_ANALYSIS_INVALID/)
})

test('E3 failure blocks candidate and modified decisions become stale', () => {
  const p = protocol(), rows = samples(p), f = f02(), evidence = e3(f)
  evidence.valid_n = 27
  const result = judge(p, rows, f, evidence)
  assert.equal(result.gold_s_candidate, false)
  const altered = { ...result, gold_s_candidate: true }
  const snapshot = buildBenchmark(p, rows)
  assert.equal(verifyDecision(altered, { benchmark_version: p.version, benchmark_snapshot_hash: snapshot.snapshot_hash, f02_input_hash: hash(f), e3_run_id: evidence.run_id, e3_evidence_hash: evidence.evidence_hash }).status, 'stale')
  const tamperedSnapshot = { ...snapshot, grades: { ...snapshot.grades, middle_1: { ...snapshot.grades.middle_1, n: 99 } } }
  assert.throws(() => verifySnapshot(tamperedSnapshot, p), /BENCHMARK_STALE/)
})

test('workflow states never promote a draft, missing sample, or stale decision', () => {
  const p = protocol(), rows = samples(p), snapshot = buildBenchmark(p, rows), f = f02(), result = judge(p, rows, f)
  assert.equal(workflowState(), 'draft')
  assert.equal(workflowState({ protocol: p }), 'sealed')
  assert.equal(workflowState({ protocol: p, snapshot }), 'benchmark_calibrated')
  assert.equal(workflowState({ protocol: p, snapshot, decision: result, current: { benchmark_version: 'new-version', benchmark_snapshot_hash: snapshot.snapshot_hash, f02_input_hash: hash(f), e3_run_id: 'fixture-run' } }), 'stale')
  const newProtocol = { ...p, version: 'fixture-v2' }
  assert.equal(workflowState({ protocol: newProtocol, snapshot, decision: result, current: { benchmark_version: newProtocol.version, benchmark_snapshot_hash: snapshot.snapshot_hash, f02_input_hash: hash(f), e3_run_id: 'fixture-run' } }), 'stale')
})

test('sample access date is required provenance', () => {
  const p = protocol(), rows = samples(p)
  delete rows[0].access_date
  rows[1].access_date = '2026-02-30'
  const snapshot = buildBenchmark(p, rows)
  assert.ok(snapshot.rejected[0].reasons.includes('ACCESS_DATE_INVALID'))
  assert.ok(snapshot.rejected[1].reasons.includes('ACCESS_DATE_INVALID'))
  assert.equal(snapshot.grades.elementary_5.status, 'insufficient_benchmark')
})

test('an ineligible row cannot reserve a selected passage or sample ID', () => {
  const p = protocol(), rows = samples(p)
  const rejected = { ...rows[0], rights_basis: 'unknown' }
  const snapshot = buildBenchmark(p, [rejected, ...rows])
  assert.equal(snapshot.rejected.length, 1)
  assert.deepEqual(snapshot.rejected[0].reasons, ['RIGHTS_UNCONFIRMED'])
  assert.equal(snapshot.grades.elementary_5.n, 30)
  const sealed = f02()
  const result = judgeBenchmark({ protocol: p, snapshot, samples: [rejected, ...rows], f02: sealed, e3: e3(sealed) })
  assert.equal(result.target_fit.middle_1.status, 'pass')
})

test('changed analysis inputs or measurements invalidate the analysis seal', () => {
  const p = protocol(), rows = samples(p)
  rows[0].item_set_hash = H('changed-items')
  rows[1].metrics.lexical += 1
  const snapshot = buildBenchmark(p, rows)
  assert.ok(snapshot.rejected[0].reasons.includes('ANALYSIS_HASH_MISMATCH'))
  assert.ok(snapshot.rejected[1].reasons.includes('ANALYSIS_HASH_MISMATCH'))
})

test('ordinal measurements require two independent matching reviews or adjudication', () => {
  const p = protocol(), rows = samples(p)
  p.axes.discourse = { metric: 'discourse_anchor', scale: 'ordinal', unit: 'anchor', measurement_method: 'synthetic_fixture', missing_rule: 'inconclusive', rater_policy: 'independent', direction: 1, resolution: 1, minimum_meaningful_delta: 1, levels: ['low', 'medium', 'high'] }
  p.codebook_hash = hash(p.axes)
  for (const row of rows) { row.codebook_hash = p.codebook_hash; row.metrics.discourse = 1 }
  resealRows(rows)
  const missing = buildBenchmark(p, rows)
  assert.ok(missing.rejected[0].reasons.includes('ORDINAL_REVIEW_INVALID:discourse'))
  for (const row of rows) {
    row.ordinal_reviews = { discourse: { rater_a_id: 'a', rater_b_id: 'b', rater_a: 0, rater_b: 1, adjudicator_id: 'c', adjudicated: 1 } }
  }
  resealRows(rows)
  assert.equal(buildBenchmark(p, rows).rejected.length, 0)
})

test('a definite fit failure takes precedence over inconclusive separation', () => {
  const p = protocol(), rows = samples(p), f = f02()
  for (const row of rows.filter(row => row.grade === 'high_1')) for (const axis of AXES) row.metrics[axis] -= 2
  resealRows(rows)
  for (const axis of AXES) f.variants.high_1.metrics[axis] -= 2
  f.variants.middle_1.metrics.lexical = 100
  const snapshot = buildBenchmark(p, rows), sealed = reseal(f)
  const result = judgeBenchmark({ protocol: p, snapshot, samples: rows, f02: sealed, e3: e3(sealed) })
  assert.equal(result.target_fit.middle_1.status, 'fail')
  assert.equal(result.level_separation.status, 'inconclusive')
  assert.equal(workflowState({ protocol: p, snapshot, decision: result, current: { benchmark_version: p.version, benchmark_snapshot_hash: snapshot.snapshot_hash, f02_input_hash: hash(sealed), e3_run_id: 'fixture-run', e3_evidence_hash: H('fixture-e3-audit-files') } }), 'fail')
})

test('sub-resolution grade shifts cannot prove level separation', () => {
  const p = protocol(), rows = samples(p), f = f02()
  for (const row of rows.filter(row => row.grade === 'high_1')) for (const axis of AXES) row.metrics[axis] -= 2 - 1e-9
  resealRows(rows)
  for (const axis of AXES) f.variants.high_1.metrics[axis] = 5 + 1e-9
  const result = judge(p, rows, reseal(f))
  assert.equal(result.level_separation.status, 'inconclusive')
  assert.equal(result.gold_s_candidate, false)
})

test('no shared length or genre is inconclusive rather than a sample shortage', () => {
  const p = protocol(), rows = samples(p), f = f02()
  f.variants.high_1.word_count = 1000
  const result = judge(p, rows, reseal(f))
  assert.equal(result.level_separation.status, 'inconclusive')
  assert.equal(result.level_separation.reason, 'NO_COMMON_LENGTH_RANGE')
})
