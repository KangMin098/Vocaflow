// scripts/textbook/frym-benchmark/benchmark.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AXES, GRADES, buildBenchmark, hash, judgeBenchmark, sampleAnalysisHash, screenSample, verifyDecision, verifySnapshot, workflowState } from './benchmark.mjs'

const H = text => hash(text)
const axisDefs = Object.fromEntries(AXES.map(axis => [axis, { metric: `${axis}_score`, scale: 'ratio', unit: 'fixture_score', measurement_method: 'synthetic_fixture', missing_rule: 'inconclusive', rater_policy: 'independent', direction: 1, resolution: .1, minimum_meaningful_delta: .5, auxiliary_metrics: [], auxiliary_override_rule: 'none', rater_agreement_floor: .8, missing_priority: 'inconclusive' }]))
const selection = { schema: 'frym-benchmark-selection/1', status: 'sealed', selected_sample_ids: GRADES.flatMap(grade => Array.from({ length: 30 }, (_, index) => `${grade}-${index}`)) }
const protocol = () => ({
  schema: 'frym-benchmark/1', status: 'sealed', version: 'fixture-v1', codebook_hash: hash(axisDefs), selection_manifest: structuredClone(selection), selection_manifest_hash: hash(selection), grades: [...GRADES],
  minimum: { per_grade: 30, publishers: 3, series_per_publisher: 2, max_publisher_share: .4, max_series_share: .2, comparison_n: 12, item_type_comparison_n: 12 },
  item_types: ['literal', 'inference', 'structure'],
  axes: structuredClone(axisDefs),
  fit: { lower_quantile: .1, upper_quantile: .9, minimum_axes: 7, length_ratio_min: .75, length_ratio_max: 1.25 },
  separation: { minimum_stable_axes: 5, minimum_matching_axes: 3, minimum_reference_ratio: .5, maximum_opposite_axes: 1 },
})
const samples = (p = protocol()) => GRADES.flatMap(grade => Array.from({ length: 30 }, (_, index) => {
  const id = `${grade}-${index}`
  const base = (grade === 'high_1' ? 7 : grade === 'middle_1' ? 5 : 4) + (index % 5 - 2) * .1
  const slot = index % 10
  const row = { sample_id: id, publisher: `publisher-${Math.floor(index / 10)}`, series: `series-${Math.floor(index / 5)}`, title: `title-${id}`, grade, edition: 'fixture-1', publication_year: 2026, difficulty_step: 'fixture-level', ISBN: `fixture-isbn-${id}`, passage_id: `passage-${id}`, page: '1', genre: slot < 4 ? 'expository' : slot < 8 ? 'argumentative' : 'narrative', source_method: 'fixture', rights_basis: 'authorized_local_analysis', analyzer_version: 'fixture-v1', evidence_locator: `fixture:${id}`, access_date: '2026-10-06', passage_hash: H(`passage-${id}`), item_set_hash: H(`items-${id}`), scoring_key_hash: H(`key-${id}`), word_count: slot < 4 ? 100 : slot < 8 ? 200 : 300, item_count: 3, item_type_counts: { literal: 1, inference: 1, structure: 1 }, item_type_difficulty: { literal: base, inference: base, structure: base }, axis_agreement: Object.fromEntries(AXES.map(axis => [axis, 1])), codebook_hash: p.codebook_hash, selection_manifest_hash: p.selection_manifest_hash, metrics: Object.fromEntries(AXES.map(axis => [axis, base])) }
  return { ...row, analysis_hash: sampleAnalysisHash(row) }
}))
const resealRows = rows => { for (const row of rows) row.analysis_hash = sampleAnalysisHash(row); return rows }
const reseal = value => { const { analysis_hash, ...body } = value; return { ...body, analysis_hash: hash(body) } }
const f02 = () => reseal({ codebook_hash: hash(axisDefs), source_freeze_sha256: H('freeze'), item_set_hash: H('f02-items'), scoring_key_hash: H('f02-key'), variants: Object.fromEntries(['middle_1', 'high_1'].map((grade, i) => [grade, { passage_hash: H(`f02-${grade}`), genre: 'expository', word_count: 100, item_count: 3, item_type_counts: { literal: 1, inference: 1, structure: 1 }, item_type_difficulty: { literal: i ? 7 : 5, inference: i ? 7 : 5, structure: i ? 7 : 5 }, axis_agreement: Object.fromEntries(AXES.map(axis => [axis, 1])), metrics: Object.fromEntries(AXES.map(axis => [axis, i ? 7 : 5])) }])) })
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
  resealRows(rows)
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
  p.axes.discourse = { ...p.axes.discourse, metric: 'discourse_anchor', scale: 'ordinal', unit: 'anchor', resolution: 1, minimum_meaningful_delta: 1, levels: ['low', 'medium', 'high'] }
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
  rejected.analysis_hash = sampleAnalysisHash(rejected)
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
  p.axes.discourse = { ...p.axes.discourse, metric: 'discourse_anchor', scale: 'ordinal', unit: 'anchor', resolution: 1, minimum_meaningful_delta: 1, levels: ['low', 'medium', 'high'] }
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

test('sub-resolution reference shifts cannot prove level separation', () => {
  const p = protocol(), rows = samples(p), f = f02()
  for (const row of rows.filter(row => row.grade === 'high_1')) for (const axis of AXES) row.metrics[axis] -= 2 - 1e-9
  resealRows(rows)
  for (const axis of AXES) f.variants.high_1.metrics[axis] = 5 + 1e-9
  const result = judge(p, rows, reseal(f))
  assert.equal(result.level_separation.status, 'inconclusive')
  assert.equal(result.gold_s_candidate, false)
})

test('stable reference shifts with identical F02 levels fail separation', () => {
  const p = protocol(), rows = samples(p), f = f02()
  for (const axis of AXES) f.variants.high_1.metrics[axis] = f.variants.middle_1.metrics[axis]
  const result = judge(p, rows, reseal(f))
  assert.equal(result.level_separation.status, 'fail')
  assert.equal(result.gold_s_candidate, false)
})

test('no shared length or genre is inconclusive rather than a sample shortage', () => {
  const p = protocol(), rows = samples(p), f = f02()
  f.variants.high_1.word_count = 1000
  const result = judge(p, rows, reseal(f))
  assert.equal(result.level_separation.status, 'inconclusive')
  assert.equal(result.level_separation.reason, 'NO_COMMON_LENGTH_RANGE')
})

test('CLI verify-decision reports a benchmark revision as STALE', () => {
  const directory = mkdtempSync(join(tmpdir(), 'frym-benchmark-'))
  try {
    const p = protocol(), snapshot = buildBenchmark(p, samples(p)), f = f02()
    p.version = 'fixture-v2'
    const values = [p, snapshot, f, {}]
    const paths = values.map((value, index) => {
      const path = join(directory, `${index}.json`)
      writeFileSync(path, JSON.stringify(value))
      return path
    })
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./benchmark-run.mjs', import.meta.url)), 'verify-decision', paths[0], paths[1], paths[2], directory, paths[3]], { encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.equal(result.stdout.trim(), 'STALE')
    writeFileSync(paths[0], JSON.stringify(protocol()))
    const staleSeal = spawnSync(process.execPath, [fileURLToPath(new URL('./benchmark-run.mjs', import.meta.url)), 'verify-decision', paths[0], paths[1], paths[2], directory, paths[3]], { encoding: 'utf8' })
    assert.equal(staleSeal.status, 1)
    assert.equal(staleSeal.stdout.trim(), 'STALE')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('workflow checks decision against supplied snapshot even with an old current pointer', () => {
  const p = protocol(), rows = samples(p), oldSnapshot = buildBenchmark(p, rows), f = f02()
  const decision = judgeBenchmark({ protocol: p, snapshot: oldSnapshot, samples: rows, f02: f, e3: e3(f) })
  rows[0].metrics.lexical += 1
  resealRows(rows)
  const newSnapshot = buildBenchmark(p, rows)
  const oldCurrent = { benchmark_version: p.version, benchmark_snapshot_hash: oldSnapshot.snapshot_hash, f02_input_hash: hash(f), e3_run_id: 'fixture-run', e3_evidence_hash: H('fixture-e3-audit-files') }
  assert.equal(workflowState({ protocol: p, snapshot: newSnapshot, decision, current: oldCurrent }), 'stale')
})

test('judge excludes a duplicate-passage rejection before a valid same-ID row', () => {
  const p = protocol(), rows = samples(p), f = f02()
  const rejected = { ...rows[61], passage_hash: rows[60].passage_hash, metrics: Object.fromEntries(AXES.map(axis => [axis, 100])) }
  rejected.analysis_hash = sampleAnalysisHash(rejected)
  const input = [...rows.slice(0, 61), rejected, ...rows.slice(61)]
  const snapshot = buildBenchmark(p, input)
  assert.ok(snapshot.rejected[0].reasons.includes('DUPLICATE_PASSAGE'))
  assert.equal(snapshot.grades.middle_1.n, 30)
  const result = judgeBenchmark({ protocol: p, snapshot, samples: input, f02: f, e3: e3(f) })
  assert.equal(result.target_fit.middle_1.status, 'pass')
  assert.equal(result.level_separation.status, 'pass')
})

test('opposite F02 shifts count even when benchmark direction differs from expectation', () => {
  const p = protocol(), rows = samples(p), f = f02()
  for (const row of rows.filter(row => row.grade === 'high_1')) for (const axis of AXES.slice(0, 3)) row.metrics[axis] -= 4
  resealRows(rows)
  const result = judge(p, rows, f)
  assert.deepEqual(result.level_separation.opposite, AXES.slice(0, 3))
  assert.equal(result.level_separation.status, 'fail')
})

test('analysis seal covers grade, genre, length, item count and evidence location', () => {
  const p = protocol(), rows = samples(p)
  rows[0].grade = 'middle_1'
  rows[1].genre = 'argumentative'
  rows[2].word_count = 999
  rows[3].item_count = 9
  rows[4].evidence_locator = 'changed:5'
  const snapshot = buildBenchmark(p, rows)
  for (const rejected of snapshot.rejected) assert.ok(rejected.reasons.includes('ANALYSIS_HASH_MISMATCH'))
  assert.equal(snapshot.rejected.length, 5)
})

test('ordinal anchors require nonempty text', () => {
  const p = protocol()
  p.axes.discourse = { ...p.axes.discourse, scale: 'ordinal', resolution: 1, minimum_meaningful_delta: 1, levels: [null, false] }
  p.codebook_hash = hash(p.axes)
  assert.throws(() => buildBenchmark(p, []), /AXIS_DEFINITION_INVALID/)
})

test('codebook cannot seal without auxiliary and agreement rules', () => {
  const p = protocol()
  delete p.axes.lexical.auxiliary_override_rule
  p.codebook_hash = hash(p.axes)
  assert.throws(() => buildBenchmark(p, []), /AXIS_DEFINITION_INVALID/)
  p.axes.lexical.auxiliary_override_rule = 'none'
  p.axes.lexical.rater_agreement_floor = 1.2
  p.codebook_hash = hash(p.axes)
  assert.throws(() => buildBenchmark(p, []), /AXIS_DEFINITION_INVALID/)
})

test('missing comparable item type blocks fit even with a passing aggregate', () => {
  const p = protocol(), rows = samples(p), f = f02()
  for (const row of rows.filter(row => row.grade === 'middle_1')) {
    row.item_count = 2
    delete row.item_type_counts.inference
    delete row.item_type_difficulty.inference
  }
  resealRows(rows)
  f.variants.middle_1.item_count = 1
  f.variants.middle_1.item_type_counts = { inference: 1 }
  f.variants.middle_1.item_type_difficulty = { inference: 5 }
  const result = judge(p, rows, reseal(f))
  assert.equal(result.target_fit.middle_1.status, 'inconclusive')
  assert.equal(result.target_fit.middle_1.axes.item_difficulty.reason, 'MISSING_ITEM_TYPE')
  assert.equal(result.gold_s_candidate, false)
})

test('F02 needs positive item counts and nonempty type evidence', () => {
  const p = protocol(), rows = samples(p), f = f02()
  f.variants.middle_1.item_count = 0
  f.variants.middle_1.item_type_counts = {}
  f.variants.middle_1.item_type_difficulty = {}
  assert.throws(() => judge(p, rows, reseal(f)), /F02_ANALYSIS_INVALID/)
})

test('item-type share drift fails fit despite matching type difficulty', () => {
  const p = protocol(), rows = samples(p), f = f02()
  f.variants.middle_1.item_count = 100
  f.variants.middle_1.item_type_counts = { literal: 98, inference: 1, structure: 1 }
  const result = judge(p, rows, reseal(f))
  assert.equal(result.target_fit.middle_1.axes.item_difficulty.status, 'fail')
  assert.equal(result.target_fit.middle_1.status, 'fail')
})

test('a failed core axis wins over missing item-type comparison', () => {
  const p = protocol(), rows = samples(p), f = f02()
  for (const row of rows.filter(row => row.grade === 'middle_1')) {
    row.item_count = 2
    delete row.item_type_counts.inference
    delete row.item_type_difficulty.inference
  }
  resealRows(rows)
  f.variants.middle_1.item_count = 1
  f.variants.middle_1.item_type_counts = { inference: 1 }
  f.variants.middle_1.item_type_difficulty = { inference: 5 }
  f.variants.middle_1.metrics.lexical = 100
  const result = judge(p, rows, reseal(f))
  assert.equal(result.target_fit.middle_1.axes.item_difficulty.status, 'inconclusive')
  assert.equal(result.target_fit.middle_1.status, 'fail')
})

test('F02 low rater agreement cannot produce a candidate', () => {
  const p = protocol(), rows = samples(p), f = f02()
  f.variants.middle_1.axis_agreement.lexical = 0
  assert.throws(() => judge(p, rows, reseal(f)), /F02_ANALYSIS_INVALID/)
})

test('failed item type outranks a different missing item type', () => {
  const p = protocol(), rows = samples(p), f = f02()
  for (const row of rows.filter(row => row.grade === 'middle_1')) {
    row.item_count = 2
    delete row.item_type_counts.inference
    delete row.item_type_difficulty.inference
  }
  resealRows(rows)
  f.variants.middle_1.item_type_difficulty.literal = 100
  const result = judge(p, rows, reseal(f))
  assert.equal(result.target_fit.middle_1.axes.item_difficulty.status, 'fail')
  assert.equal(result.target_fit.middle_1.status, 'fail')
})
