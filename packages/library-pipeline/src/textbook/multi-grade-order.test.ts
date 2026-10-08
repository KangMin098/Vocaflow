// packages/library-pipeline/src/textbook/multi-grade-order.test.ts
import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { sealProductOrder } from './factory-order'
import { canonicalJson } from './review-digest'
import { reviewDigest } from './review-digest'
import { buildColophon } from './brand'
import { runMultiGradeFactoryDryRun } from './multi-grade-production'
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

const rawSha = (value: string) => createHash('sha256').update(value).digest('hex')
function productionFixture(mode: 'shared_passage_grade_specific_items' | 'grade_specific_adaptations' | 'grade_specific_units') {
  const g = group(mode)
  const e = evidence(g)
  const stages = e.variants.map((variant, index) => {
    const passage = index && mode === 'grade_specific_adaptations' ? 'A more complex grade-two passage.' : 'A shared research passage.'
    const lineage = { product_order_id: variant.product_order_id, order_revision: variant.order_revision,
      order_hash: variant.order_hash, source_hash: e.source_hash, rights_hash: e.rights_hash,
      adaptation_hash: variant.adaptation_hash, benchmark_snapshot_hash: variant.benchmark_snapshot_hash,
      promotion_request_hash: h(index ? '1' : '2'), evidence_hash: h(index ? '3' : '4'),
      certificate_hash: h(index ? '5' : '6'), eligibility_hash: h(index ? '7' : '8'), trust_policy_hash: h('9') }
    if (index && mode === 'grade_specific_adaptations') variant.adaptation_hash = rawSha(passage)
    lineage.adaptation_hash = variant.adaptation_hash
    const item = { id: `item-${index}`, ref_id: `article-${index}`,
      payload: { passage, factory_lineage: lineage }, answer_key: { answer: index + 1 } }
    const itemDigest = reviewDigest(item.payload, item.answer_key)
    const text = `Grade ${index + 1} explanation.`
    const unit = { unit_id: `unit-${index}`, html: `<section class="unit"><p>${passage}</p><p>Item ${index + 1}</p></section>` }
    variant.passage_hash = rawSha(passage)
    variant.item_set_hash = digest([[item.id, itemDigest]])
    variant.activity_hash = null
    variant.analysis_hash = digest({ grade: variant.grade })
    variant.unit_set_hash = digest([[unit.unit_id, rawSha(unit.html)]])
    return { grade: variant.grade, article_id: `article-${index}`, passage, lineage, items: [item],
      explanations: [{ item_id: item.id, text, item_digest: itemDigest, factory_lineage: lineage }],
      reviews: [{ item_id: item.id, decision: 'approved' as const, item_digest: itemDigest,
        explanation_hash: rawSha(text), factory_lineage: lineage }],
      activities: [], analysis: { grade: variant.grade }, unit }
  })
  const render = { colophon: buildColophon({ title: 'Synthetic Multi Grade', step: null,
    schoolBand: null, vLevel: 5, issued: new Date('2026-10-08T00:00:00Z'), autoPassed: 2, autoTotal: 2 }),
    step: null, schoolBand: null, vLevel: 5, totalSteps: 7, totalMinutes: 20, autoPassed: 2,
    autoTotal: 2, passageChip: 'research', answerBias: { chi2: 0, cramersV: 0, biased: false },
    proof: { passages: 2, defective: 0 } }
  const currentLineages = stages.map(stage => ({ grade: stage.grade, article_id: stage.article_id, source_id: e.source_id,
    lineage: structuredClone(stage.lineage) }))
  return { group: g, evidence: e, currentEvidence: structuredClone(e), currentLineages, stages, render }
}

describe('multi-grade synthetic factory E2E', () => {
  for (const mode of ['shared_passage_grade_specific_items', 'grade_specific_adaptations', 'grade_specific_units'] as const) {
    it(`renders ${mode} through ready, item, explanation, review, unit and volume`, () => {
      const input = productionFixture(mode)
      const output = runMultiGradeFactoryDryRun(input)
      expect(output.html).toContain('Synthetic Multi Grade')
      expect(output.html).toContain('Grade 1 explanation.')
      expect(output.html).toContain('Grade 2 explanation.')
      expect(output.manifest.units.map(unit => unit.grade)).toEqual(['middle_1', 'middle_2'])
      expect(output.manifest.item_evidence).toHaveLength(2)
      expect(output.manifest.evidence_level).toBe('caller_supplied_unverified')
      expect(output.html).toContain('SYNTHETIC DRY RUN')
      expect(output.manifest.render_eligible).toBe(false)
      expect(output.manifest.seed_eligible).toBe(false)
    })
  }

  it('rejects grade mixing, stale item/explanation/review, changed rights and unit output', () => {
    const input = productionFixture('shared_passage_grade_specific_items')
    const check = (edit: (value: ReturnType<typeof productionFixture>) => void, reason: RegExp) => {
      const copy = structuredClone(input)
      edit(copy)
      expect(() => runMultiGradeFactoryDryRun(copy)).toThrow(reason)
    }
    check(value => { value.stages[1].lineage.order_hash = value.stages[0].lineage.order_hash }, /PROMOTION_STALE/)
    check(value => { value.currentLineages[1].lineage.certificate_hash = h('0') }, /PROMOTION_STALE/)
    check(value => { value.currentLineages[1].source_id = 'other-source' }, /PROMOTION_STALE/)
    check(value => { value.currentLineages[1].article_id = value.currentLineages[0].article_id }, /READING_CHILD_REUSED/)
    check(value => { value.stages[1].items[0].payload.passage = 'Changed.' }, /ITEM_LINEAGE/)
    check(value => { value.stages[1].items[0].ref_id = value.stages[0].article_id }, /ITEM_LINEAGE/)
    check(value => { value.stages[1].explanations[0].text = 'Changed.' }, /EDITORIAL_STALE/)
    check(value => { value.stages[1].reviews[0].decision = 'rejected' as 'approved' }, /Invalid literal/)
    check(value => { value.currentEvidence.rights_hash = h('0') }, /PRODUCTION_STALE/)
    check(value => { value.stages[1].unit.html = '<section>Changed</section>' }, /UNIT_SET_STALE/)
    check(value => { value.stages[1].items[0].id = value.stages[0].items[0].id }, /ITEM_DUPLICATE/)
    check(value => { value.render.proof.passages = 99 }, /RENDER_PROOF_MISMATCH/)
  })

  it('runs the factory CLI and writes an immutable HTML plus lineage sidecar', () => {
    const root = mkdtempSync(join(tmpdir(), 'vocaflow-multi-grade-'))
    const inputPath = join(root, 'input.json')
    const outputDir = join(root, 'output')
    const script = resolve(import.meta.dirname, '../../../../scripts/textbook/multi-grade-factory-dry-run.mjs')
    try {
      writeFileSync(inputPath, JSON.stringify(productionFixture('shared_passage_grade_specific_items')))
      const run = spawnSync(process.execPath, ['--import', 'tsx', script, inputPath, outputDir],
        { cwd: resolve(import.meta.dirname, '../../../..'), encoding: 'utf8' })
      expect(run.status, run.stderr).toBe(0)
      const manifest = JSON.parse(readFileSync(join(outputDir, 'lineage-manifest.json'), 'utf8'))
      expect(rawSha(readFileSync(join(outputDir, 'volume.html'), 'utf8'))).toBe(manifest.html_sha256)
      expect(manifest.item_evidence).toHaveLength(2)
      expect(spawnSync(process.execPath, ['--import', 'tsx', script, inputPath, outputDir],
        { cwd: resolve(import.meta.dirname, '../../../..'), encoding: 'utf8' }).status).not.toBe(0)
    } finally {
      for (const file of [join(outputDir, 'volume.html'), join(outputDir, 'lineage-manifest.json'), inputPath]) {
        try { unlinkSync(file) } catch { /* A failed CLI may not have created the file. */ }
      }
      try { rmdirSync(outputDir) } catch { /* A failed CLI may not have created the directory. */ }
      rmdirSync(root)
    }
  })
})
