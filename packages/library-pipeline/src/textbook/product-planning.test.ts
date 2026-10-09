// packages/library-pipeline/src/textbook/product-planning.test.ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildProductOrderFromBrief, planProductBrief } from './product-planning'
import { PRODUCT_FAMILIES } from './academic-reading'

const brief = () => ({
  schema: 'textbook-product-brief/1',
  grade_scope: { mode: 'single_grade', grades: ['middle_2'] },
  purpose: 'relation_reading',
  domain_weights: { science: 1, social: 1 },
  genre_weights: { explanation: 3, argument: 1 },
  duration_days: 20,
  units_per_chapter: 5,
  difficulty: { start: 3, end: 6 },
  passage_words: { start: 180, end: 260 },
  source_strategy: 'balanced',
})

describe('product planning', () => {
  it('can plan every declared family without treating a plan as a production adapter', () => {
    for (const family of Object.keys(PRODUCT_FAMILIES)) {
      const { plan } = planProductBrief({ ...brief(), product_family: family })
      expect(plan.product_family).toBe(family)
      expect(plan.units).toHaveLength(20)
      expect(plan.warning).toMatch(/not admission/)
    }
    expect(planProductBrief({ ...brief(), product_family: 'P13' }).plan.units[0]?.item_type_target).toBeNull()
    expect(() => planProductBrief({ ...brief(), product_family: 'P21' })).toThrow()
  })
  it('turns a grade/purpose/domain/length brief into a reproducible balanced volume plan', () => {
    const { plan, plan_hash } = planProductBrief(brief())
    expect(plan.product_family).toBe('P09')
    expect(plan.production_capability).toBe('PARTIAL')
    expect(plan.units).toHaveLength(20)
    expect(plan.chapters).toHaveLength(4)
    expect(plan.units.filter(unit => unit.domain === 'science')).toHaveLength(10)
    expect(plan.units.filter(unit => unit.domain === 'social')).toHaveLength(10)
    expect(plan.units.filter(unit => unit.genre === 'explanation')).toHaveLength(15)
    expect(plan.units[0]?.difficulty_level).toBe(3)
    expect(plan.units[19]?.difficulty_level).toBe(6)
    expect(plan.units[19]?.passage_words_target).toBe(260)
    expect(plan.units.filter(unit => unit.revisit_prior_skill)).toHaveLength(4)
    expect(plan.units[19]?.cumulative_review).toBe(true)
    expect(planProductBrief(brief()).plan_hash).toBe(plan_hash)
    expect(planProductBrief({ ...brief(), domain_weights: { science: 3, social: 1 } }).plan_hash).not.toBe(plan_hash)
  })

  it('preserves multi-grade scope and rejects invalid grade, curve and schedule inputs', () => {
    const group = { ...brief(), grade_scope: { mode: 'grade_range', grades: ['middle_1', 'middle_2'] } }
    const plan = planProductBrief(group).plan
    expect(plan.units.every(unit => unit.grade_scope.grades.join(',') === 'middle_1,middle_2')).toBe(true)
    expect(() => planProductBrief({ ...group, grade_scope: { mode: 'grade_range', grades: ['middle_1', 'middle_3'] } })).toThrow()
    expect(() => planProductBrief({ ...brief(), difficulty: { start: 6, end: 3 } })).toThrow()
    expect(() => planProductBrief({ ...brief(), duration_days: 0 })).toThrow()
    expect(() => planProductBrief({ ...brief(), domain_weights: {} })).toThrow()
  })

  it('binds the structured plan to a sealed order without accepting another grade or target', () => {
    const target = JSON.parse(readFileSync(new URL('../../../../scripts/textbook/targets/knowledge-middle1.json', import.meta.url), 'utf8'))
    const shell = {
      schema: 'textbook-product-order/1' as const,
      product_order_id: 'planned-m2', order_revision: 1, series_id: 'relation-reading', edition_id: 'first',
      product_variant: 'relation', target: { ...target, age_band: 'middle_2', reasoning_band: 'middle_2', family: 'P09', skills: ['R3'] },
      exam_alignment: [],
      source_policy_version: 'source-v1', source_policy_hash: '1'.repeat(64),
      rights_policy_version: 'rights-v1', rights_policy_hash: '2'.repeat(64),
      adaptation_policy_version: 'adapt-v1', adaptation_policy_hash: '3'.repeat(64),
      unit_spec_version: 'unit-v1', chapter_spec_version: 'chapter-v1', volume_spec_version: 'volume-v1',
      layout_profile: 'reading-v1', benchmark_contract_version: 'benchmark-v1', benchmark_contract_hash: '4'.repeat(64),
      evidence_policy_version: 'evidence-v1', evidence_policy_hash: '5'.repeat(64),
      trust_policy_version: 'trust-v1', trust_policy_hash: '6'.repeat(64),
      created_at: '2026-10-09T00:00:00Z', sealed_at: '2026-10-09T00:01:00Z',
    }
    const result = buildProductOrderFromBrief(brief(), 'middle_2', shell)
    expect(result.order.planning_hash).toBe(planProductBrief(brief()).plan_hash)
    expect(result.order.domain_mix).toEqual({ science: 50, social: 50 })
    expect(result.order.item_types).toEqual(['order', 'insert', 'long_reference'])
    expect(result.order_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(() => buildProductOrderFromBrief(brief(), 'high_1', shell)).toThrow('GRADE_OUTSIDE_PLAN')
    expect(() => buildProductOrderFromBrief({ ...brief(), product_family: 'P13' }, 'middle_2', shell))
      .toThrow('PRODUCT_FAMILY_PRODUCTION_UNSUPPORTED')
    expect(() => buildProductOrderFromBrief({ ...brief(), product_family: 'P18' }, 'middle_2', shell))
      .toThrow('PRODUCT_FAMILY_PRODUCTION_UNSUPPORTED')
    expect(() => buildProductOrderFromBrief(brief(), 'middle_2', {
      ...shell, target: { ...shell.target, family: 'P03' },
    })).toThrow('TARGET_DIFFERS_FROM_PLAN')
  })
})
