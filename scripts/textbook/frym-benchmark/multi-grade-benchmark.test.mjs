// scripts/textbook/frym-benchmark/multi-grade-benchmark.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AXES, hash } from './benchmark.mjs'
import { evaluateMultiGradeBenchmark, sealMultiGradeBenchmarkContract } from './multi-grade-benchmark.mjs'

const h = value => value.repeat(64)
const metrics = value => Object.fromEntries(AXES.map(axis => [axis, value]))
const group = (mode = 'shared_passage_grade_specific_items') => ({
  schema: 'textbook-product-order-group/1', group_id: 'middle-book', group_revision: 1,
  grade_scope: { mode: 'grade_range', grades: ['middle_1', 'middle_2'] }, delivery_mode: mode,
  orders: ['middle_1', 'middle_2'].map(grade => ({ grade,
    order: { product_order_id: `order-${grade}`, order_revision: 1 } })),
})
const contract = g => ({
  schema: 'multi-grade-benchmark-contract/1', status: 'sealed', group_hash: hash(g),
  codebook_hash: h('a'), grade_scope: g.grade_scope, delivery_mode: g.delivery_mode,
  minimum_per_grade: 30, minimum_range_reference: 12, minimum_publishers: 3,
  minimum_series_per_publisher: 2, maximum_publisher_share: .4, maximum_series_share: .2,
  item_types: ['literal', 'inference'], lower_quantile: .1, upper_quantile: .9,
  minimum_matching_item_types: 2,
  minimum_matching_axes: 3, minimum_stable_axes: 5,
  maximum_opposite_axes: 1, minimum_reference_ratio: .5,
})
const evidence = g => ({ group_id: g.group_id, group_revision: g.group_revision,
  group_hash: hash(g), source_id: 'source-f02', source_hash: h('7'), rights_hash: h('8'),
  variants: g.grade_scope.grades.map((grade, index) => ({
  grade, product_order_id: g.orders[index].order.product_order_id,
  order_revision: g.orders[index].order.order_revision, order_hash: hash(g.orders[index].order),
  passage_hash: g.delivery_mode === 'shared_passage_grade_specific_items' ? h('b') : h(index ? 'c' : 'b'),
  adaptation_hash: h('9'), item_set_hash: h(index ? 'e' : 'd'), activity_hash: h('0'),
  unit_set_hash: h(index ? '4' : '3'), analysis_hash: h('a'),
  benchmark_version: 'v1', benchmark_snapshot_hash: h(index ? '2' : '1'),
})) })
const variants = (g, e) => Object.fromEntries(g.grade_scope.grades.map((grade, index) => [grade, {
  grade, passage_hash: e.variants[index].passage_hash, item_set_hash: e.variants[index].item_set_hash,
  order_hash: e.variants[index].order_hash, source_id: e.source_id,
  source_hash: e.source_hash, rights_hash: e.rights_hash,
  adaptation_hash: e.variants[index].adaptation_hash, activity_hash: e.variants[index].activity_hash,
  unit_set_hash: e.variants[index].unit_set_hash, codebook_hash: h('a'),
  benchmark_version: e.variants[index].benchmark_version,
  benchmark_snapshot_hash: e.variants[index].benchmark_snapshot_hash,
  genre: 'expository', word_count: 200,
  metrics: metrics(g.delivery_mode === 'shared_passage_grade_specific_items' ? 2.5 : index ? 3 : 2),
  item_type_difficulty: { literal: index ? 3 : 2, inference: index ? 3 : 2 },
}]))
const row = (id, scope, value, index) => ({
  sample_id: id, passage_hash: hash(id), admission_receipt_hash: hash(`receipt:${id}`),
  codebook_hash: h('a'),
  grade_scope: scope, publisher: `publisher-${index % 3}`, series: `series-${index % 6}`,
  rights_basis: 'authorized_local_analysis', genre: 'expository', word_count: 200,
  metrics: metrics(value), item_type_difficulty: { literal: value, inference: value },
})
const references = () => [
  ...Array.from({ length: 30 }, (_, i) => row(`m1-${i}`, { mode: 'single_grade', grades: ['middle_1'] }, 2 + (i % 3) * .25, i)),
  ...Array.from({ length: 30 }, (_, i) => row(`m2-${i}`, { mode: 'single_grade', grades: ['middle_2'] }, 2.5 + (i % 3) * .25, i)),
  ...Array.from({ length: 12 }, (_, i) => row(`range-${i}`, { mode: 'grade_range', grades: ['middle_1', 'middle_2'] }, 2 + (i % 3) * .5, i)),
]
const run = (g = group(), refs = references()) => {
  const e = evidence(g)
  const v = variants(g, e)
  for (const bound of e.variants) bound.analysis_hash = hash(v[bound.grade])
  return evaluateMultiGradeBenchmark({ contract: contract(g), group: g, evidence: e,
    variants: v, references: refs })
}

test('multi-grade contract distinguishes per-grade fit, shared core, span, and item compatibility', () => {
  const result = run()
  assert.equal(result.status, 'pass')
  assert.equal(result.lower_bound_fit.status, 'pass')
  assert.equal(result.upper_bound_fit.status, 'pass')
  assert.equal(result.shared_core_fit.status, 'pass')
  assert.equal(result.grade_span_separation.status, 'pass')
  assert.equal(result.grade_span_separation.basis, 'item_difficulty')
  assert.deepEqual(result.item_compatibility, { middle_1: 'pass', middle_2: 'pass' })
  assert.equal(result.gold_s_candidate, false)
  assert.equal(result.db_seed, false)
  assert.match(result.decision_hash, /^[a-f0-9]{64}$/)
  const g = group(), e = evidence(g), v = variants(g, e)
  for (const bound of e.variants) bound.analysis_hash = hash(v[bound.grade])
  v.middle_2.item_type_difficulty.inference = 2
  e.variants[1].analysis_hash = hash(v.middle_2)
  const weak = evaluateMultiGradeBenchmark({ contract: contract(g), group: g,
    evidence: e, variants: v, references: references() })
  assert.equal(weak.grade_span_separation.status, 'fail')
})

test('grade-specific adaptation requires language and discourse separation', () => {
  const g = group('grade_specific_adaptations')
  const result = run(g)
  assert.equal(result.grade_span_separation.basis, 'passage_difficulty')
  assert.equal(result.grade_span_separation.status, 'pass')
  const e = evidence(g)
  const v = variants(g, e)
  for (const bound of e.variants) bound.analysis_hash = hash(v[bound.grade])
  v.middle_2.metrics = metrics(2)
  e.variants[1].analysis_hash = hash(v.middle_2)
  const flat = evaluateMultiGradeBenchmark({ contract: contract(g), group: g, evidence: e,
    variants: v, references: references() })
  assert.equal(flat.grade_span_separation.status, 'fail')
  assert.equal(flat.status, 'fail')
})

test('a three-grade range checks each adjacent step, not only its endpoints', () => {
  const g = { ...group(), grade_scope: { mode: 'grade_range', grades: ['middle_1', 'middle_2', 'middle_3'] },
    orders: ['middle_1', 'middle_2', 'middle_3'].map(grade => ({ grade,
      order: { product_order_id: `order-${grade}`, order_revision: 1 } })) }
  const e = evidence(g)
  e.variants[2].item_set_hash = h('f')
  const v = variants(g, e)
  v.middle_3.item_type_difficulty = { literal: 2.75, inference: 2.75 }
  for (const bound of e.variants) bound.analysis_hash = hash(v[bound.grade])
  const refs = [
    ...references().filter(row => row.grade_scope.mode === 'single_grade'),
    ...Array.from({ length: 30 }, (_, i) => ({
      ...row(`m3-${i}`, { mode: 'single_grade', grades: ['middle_3'] }, 2.5 + (i % 3) * .25, i),
      item_type_difficulty: { literal: 2.75 + (i % 3) * .25, inference: 2.75 + (i % 3) * .25 },
    })),
    ...Array.from({ length: 12 }, (_, i) => row(`range3-${i}`, g.grade_scope, 2 + (i % 3) * .5, i)),
  ]
  const result = evaluateMultiGradeBenchmark({ contract: contract(g), group: g, evidence: e,
    variants: v, references: refs })
  assert.equal(result.grade_sub_fit.middle_3.status, 'pass')
  assert.equal(result.grade_span_separation.pairs.length, 2)
  assert.equal(result.grade_span_separation.pairs[0].status, 'pass')
  assert.equal(result.grade_span_separation.pairs[1].status, 'fail')
  assert.equal(result.status, 'fail')
})

test('missing real references, mixed hashes, rights uncertainty, and duplicates fail closed', () => {
  assert.equal(run(group(), []).status, 'insufficient_benchmark')
  assert.equal(run(group(), references().slice(0, 30)).status, 'insufficient_benchmark')
  const g = group(), e = evidence(g), v = variants(g, e), c = contract(g)
  for (const bound of e.variants) bound.analysis_hash = hash(v[bound.grade])
  assert.throws(() => evaluateMultiGradeBenchmark({ contract: c, group: g,
    evidence: { ...e, group_hash: h('f') }, variants: v, references: references() }), /MULTI_GRADE_EVIDENCE_MIXED/)
  const mixedOrder = structuredClone(e)
  mixedOrder.variants[1].order_hash = h('f')
  assert.throws(() => evaluateMultiGradeBenchmark({ contract: c, group: g,
    evidence: mixedOrder, variants: v, references: references() }), /MULTI_GRADE_CHILD_ORDER_STALE_OR_MIXED/)
  const mixedPassage = structuredClone(e)
  mixedPassage.variants[1].passage_hash = h('f')
  assert.throws(() => evaluateMultiGradeBenchmark({ contract: c, group: g,
    evidence: mixedPassage, variants: v, references: references() }), /MULTI_GRADE_SHARED_PASSAGE_MISMATCH/)
  const stale = structuredClone(v)
  stale.middle_2.item_set_hash = h('f')
  assert.throws(() => evaluateMultiGradeBenchmark({ contract: c, group: g,
    evidence: e, variants: stale, references: references() }), /MULTI_GRADE_VARIANT_STALE_OR_INCOMPLETE/)
  const denied = references()
  denied[0].rights_basis = 'unknown'
  assert.throws(() => run(g, denied), /MULTI_GRADE_REFERENCE_INVALID_OR_DUPLICATE/)
  const concentrated = references().map(row => ({ ...row, publisher: 'one-publisher' }))
  assert.equal(run(g, concentrated).status, 'insufficient_benchmark')
  const duplicated = references()
  duplicated[1].passage_hash = duplicated[0].passage_hash
  assert.throws(() => run(g, duplicated), /MULTI_GRADE_REFERENCE_INVALID_OR_DUPLICATE/)
  assert.throws(() => sealMultiGradeBenchmarkContract({ ...c, grade_scope: { mode: 'grade_range', grades: ['middle_1', 'middle_3'] } }), /MULTI_GRADE_CONTRACT_INVALID/)
})
