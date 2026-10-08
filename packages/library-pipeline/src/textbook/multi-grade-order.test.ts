// packages/library-pipeline/src/textbook/multi-grade-order.test.ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { sealProductOrder } from './factory-order'
import { canonicalJson } from './review-digest'
import {
  assessMultiGradeEvidence, bindMultiGradeEvidence, planMultiGradeVolume,
  sealMultiGradeProductOrder,
} from './multi-grade-order'

const h = (value: string) => value.repeat(64)
const digest = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex')
const target = JSON.parse(readFileSync(new URL('../../../../scripts/textbook/targets/knowledge-middle1.json', import.meta.url), 'utf8'))
const difficulty = { lexical: 3, syntax: 3, information_density: 3, discourse: 3, inference: 3, abstraction: 3, background_knowledge: 3 }
const order = (grade: 'middle_1' | 'middle_2' | 'middle_3') => ({
  schema: 'textbook-product-order/1', product_order_id: `f02-${grade}`, order_revision: 1,
  series_id: 'bridge-reading', edition_id: 'first', product_family: 'P03', product_variant: 'knowledge',
  target: { ...target, age_band: grade, reasoning_band: grade }, grade_target: grade,
  reading_skill_targets: ['R2', 'R3', 'R4'], purposes: ['knowledge'], exam_alignment: [],
  domain_mix: { science: 100 }, genre_mix: { explanation: 100 },
  source_policy_version: 'source-v1', source_policy_hash: h('3'),
  rights_policy_version: 'rights-v1', rights_policy_hash: h('4'),
  adaptation_policy_version: 'adapt-v1', adaptation_policy_hash: h('5'),
  item_types: ['main_point'], activity_types: [], passage_difficulty_profile: difficulty,
  item_difficulty_profile: { reasoning: grade === 'middle_1' ? 3 : grade === 'middle_2' ? 4 : 5 },
  unit_spec_version: 'unit-v1', chapter_spec_version: 'chapter-v1', volume_spec_version: 'volume-v1',
  layout_profile: 'reading-v1', benchmark_contract_version: 'benchmark-v1', benchmark_contract_hash: h('6'),
  evidence_policy_version: 'evidence-v1', evidence_policy_hash: h('2'),
  trust_policy_version: 'trust-v1', trust_policy_hash: h('1'),
  created_at: '2026-10-08T00:00:00Z', sealed_at: '2026-10-08T00:01:00Z',
})
const group = (delivery_mode: 'shared_passage_grade_specific_items' | 'grade_specific_adaptations' | 'grade_specific_units' = 'shared_passage_grade_specific_items') => ({
  schema: 'textbook-product-order-group/1', group_id: 'f02-middle-range', group_revision: 1,
  grade_scope: { mode: 'grade_range', grades: ['middle_1', 'middle_2'] }, delivery_mode,
  orders: [{ grade: 'middle_1', order: order('middle_1') }, { grade: 'middle_2', order: order('middle_2') }],
})
const evidence = (g = group()) => ({
  schema: 'textbook-multi-grade-evidence/1', group_id: g.group_id, group_revision: g.group_revision,
  group_hash: sealMultiGradeProductOrder(g).group_hash, source_id: 'source-f02', source_hash: h('a'), rights_hash: h('b'),
  variants: g.orders.map(({ grade, order: child }, index) => ({
    grade, product_order_id: child.product_order_id, order_revision: child.order_revision,
    order_hash: sealProductOrder(child).order_hash, passage_hash: h('c'), adaptation_hash: h('d'),
    item_set_hash: h(index ? 'f' : 'e'), activity_hash: h(index ? '8' : '7'),
    benchmark_version: 'benchmark-v1', benchmark_snapshot_hash: h(index ? '0' : '9'),
    gold_s_candidate_hash: null, unit_set_hash: h(index ? '6' : '5'), analysis_hash: h(index ? '8' : '7'),
  })),
})

describe('multi-grade Product Order', () => {
  it('seals single, contiguous range, and noncontiguous multi-grade scopes', () => {
    expect(sealMultiGradeProductOrder(group()).group.grade_scope.grades).toEqual(['middle_1', 'middle_2'])
    const single = { ...group(), grade_scope: { mode: 'single_grade', grades: ['middle_1'] }, delivery_mode: 'single_grade', orders: [{ grade: 'middle_1', order: order('middle_1') }] }
    expect(sealMultiGradeProductOrder(single).group.grade_scope.mode).toBe('single_grade')
    const multi = { ...group(), grade_scope: { mode: 'multi_grade', grades: ['middle_1', 'middle_3'] }, orders: [{ grade: 'middle_1', order: order('middle_1') }, { grade: 'middle_3', order: order('middle_3') }] }
    expect(sealMultiGradeProductOrder(multi).group.grade_scope.mode).toBe('multi_grade')
    expect(() => sealMultiGradeProductOrder({ ...multi, grade_scope: { mode: 'grade_range', grades: ['middle_1', 'middle_3'] } })).toThrow()
    expect(() => sealMultiGradeProductOrder({ ...group(), orders: [{ grade: 'middle_1', order: order('middle_1') }, { grade: 'middle_2', order: order('middle_1') }] })).toThrow()
    const elementary = (fineGrade: 'elementary_5' | 'elementary_6') => {
      const child = order('middle_1')
      return { grade: fineGrade, order: { ...child, product_order_id: `f02-${fineGrade}`,
        grade_target: 'upper_elementary', grade_detail_target: fineGrade,
        target: { ...child.target, age_band: 'upper_elementary',
          reasoning_band: 'upper_elementary', language_band: 'elementary', passage_v_level: 2 } } }
    }
    const elementaryRange = { ...group(), grade_scope: { mode: 'grade_range', grades: ['elementary_5', 'elementary_6'] },
      orders: [elementary('elementary_5'), elementary('elementary_6')] }
    expect(sealMultiGradeProductOrder(elementaryRange).group.grade_scope.grades).toEqual(['elementary_5', 'elementary_6'])
    const switched = structuredClone(elementaryRange)
    switched.orders[1].order.grade_detail_target = 'elementary_5'
    expect(() => sealMultiGradeProductOrder(switched)).toThrow()
  })

  it('binds shared passage, distinct grade items, benchmark and rights evidence', () => {
    const current = evidence()
    expect(bindMultiGradeEvidence(group(), current).evidence_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(assessMultiGradeEvidence(group(), current, current).state).toBe('current')
    expect(assessMultiGradeEvidence(group(), current, { ...current, rights_hash: h('0') }).state).toBe('stale')
    expect(assessMultiGradeEvidence(group(), current, current, false).state).toBe('invalidated')
    expect(assessMultiGradeEvidence({ ...group(), group_revision: 2 }, current, current).state).toBe('stale')
    expect(() => bindMultiGradeEvidence(group(), { ...current, variants: [current.variants[1], current.variants[0]] })).toThrow('MULTI_GRADE_CHILD_ORDER_STALE_OR_MIXED')
    const sameItems = structuredClone(current)
    sameItems.variants[1].item_set_hash = sameItems.variants[0].item_set_hash
    expect(() => bindMultiGradeEvidence(group(), sameItems)).toThrow('SHARED_PASSAGE_VARIANT_MISMATCH')
    const changedOrder = { ...group(), group_revision: 2 }
    expect(() => bindMultiGradeEvidence(changedOrder, current)).toThrow('MULTI_GRADE_GROUP_STALE')
  })

  it('requires distinct adaptation passages and blocks mixed-unit assembly', () => {
    const specific = group('grade_specific_adaptations')
    const current = evidence(specific)
    current.variants[1].passage_hash = h('1')
    current.variants[1].adaptation_hash = h('2')
    expect(bindMultiGradeEvidence(specific, current).evidence_hash).toMatch(/^[a-f0-9]{64}$/)
    const units = current.variants.map((variant, index) => ({
      unit_id: `unit-${index}`, grade: variant.grade, product_order_id: variant.product_order_id,
      order_revision: variant.order_revision, order_hash: variant.order_hash,
      source_id: current.source_id, source_hash: current.source_hash, rights_hash: current.rights_hash,
      passage_hash: variant.passage_hash, adaptation_hash: variant.adaptation_hash,
      item_set_hash: variant.item_set_hash,
      activity_hash: variant.activity_hash, benchmark_snapshot_hash: variant.benchmark_snapshot_hash,
      unit_content_hash: h(index ? '4' : '3'),
    }))
    for (const variant of current.variants) {
      current.variants.find(row => row.grade === variant.grade)!.unit_set_hash = digest(units
        .filter(unit => unit.grade === variant.grade).map(unit => [unit.unit_id, unit.unit_content_hash]))
    }
    const plan = planMultiGradeVolume(specific, current, units)
    expect(plan.plan_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(plan.render_eligible).toBe(false)
    expect(plan.seed_eligible).toBe(false)
    expect(() => planMultiGradeVolume(specific, current, [units[0]])).toThrow('MULTI_GRADE_UNIT_MISSING')
    expect(() => planMultiGradeVolume(specific, current, [units[0], { ...units[1], order_hash: units[0].order_hash }])).toThrow('MULTI_GRADE_UNIT_LINEAGE_STALE_OR_MIXED')
    expect(() => planMultiGradeVolume(specific, current, [units[0], { ...units[1], adaptation_hash: h('f') }])).toThrow('MULTI_GRADE_UNIT_LINEAGE_STALE_OR_MIXED')
    expect(() => planMultiGradeVolume(specific, current, [units[0], { ...units[1], unit_content_hash: h('f') }])).toThrow('MULTI_GRADE_UNIT_SET_STALE')
    expect(() => bindMultiGradeEvidence(specific, evidence(specific))).toThrow('GRADE_ADAPTATION_MISSING_OR_REUSED')
    const unitSpecific = group('grade_specific_units')
    const reusedUnits = evidence(unitSpecific)
    reusedUnits.variants[1].unit_set_hash = reusedUnits.variants[0].unit_set_hash
    expect(() => bindMultiGradeEvidence(unitSpecific, reusedUnits)).toThrow('GRADE_UNIT_SET_REUSED')
  })
})
