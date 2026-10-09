// packages/library-pipeline/src/textbook/product-fulfillment.test.ts
import { describe, expect, it } from 'vitest'
import { assemblePlannedVolumeSynthetic, planProductBrief, verifyProductPlanFulfillment } from './product-planning'

const brief = {
  schema: 'textbook-product-brief/1', grade_scope: { mode: 'grade_range', grades: ['middle_1', 'middle_2'] },
  purpose: 'relation_reading', domain_weights: { science: 1, social: 1 },
  genre_weights: { explanation: 3, argument: 1 }, duration_days: 20, units_per_chapter: 5,
  difficulty: { start: 3, end: 6 }, passage_words: { start: 180, end: 260 }, source_strategy: 'balanced',
}
const hash = (char: string) => char.repeat(64)
function fixture() {
  const { plan, plan_hash } = planProductBrief(brief)
  const orders = plan.brief.grade_scope.grades.map((grade, index) => ({ grade,
    product_order_id: `order-${grade}`, order_revision: 1, order_hash: hash(index ? 'b' : 'a'),
    planning_hash: plan_hash }))
  const units = orders.flatMap(order => plan.units.map(unit => {
    const passage = Array.from({ length: unit.passage_words_target }, (_, index) => `word${index}`).join(' ')
    return { day: unit.day, grade: order.grade, product_order_id: order.product_order_id,
      order_revision: order.order_revision, order_hash: order.order_hash, planning_hash: plan_hash,
      primary_skill: unit.primary_skill, domain: unit.domain, genre: unit.genre,
      difficulty_level: unit.difficulty_level, passage, item_types: [unit.item_type_target!],
      source_mode: unit.day <= 10 ? 'direct' : 'adaptation',
      revisit_prior_skill: unit.revisit_prior_skill, cumulative_review: unit.cumulative_review,
      unit_id: `${order.grade}-${unit.day}`, unit_html: `<section><p>${passage}</p></section>`,
    }
  }))
  return { brief, orders, units }
}

describe('20-day planned volume fulfillment', () => {
  it('verifies skill, difficulty, domain, genre, item, source and grade balance from actual unit inputs', () => {
    const result = verifyProductPlanFulfillment(fixture())
    expect(result.unit_count).toBe(40)
    expect(result.units.filter(unit => unit.grade === 'middle_1')).toHaveLength(20)
    expect(result.synthetic_fixture && result.non_production).toBe(true)
    expect(result.receipt_hash).toMatch(/^[a-f0-9]{64}$/)
    const volume = assemblePlannedVolumeSynthetic(fixture())
    expect(volume.html.match(/<section>/g)).toHaveLength(40)
    expect(volume.manifest.fulfillment_receipt_hash).toBe(result.receipt_hash)
    expect(volume.manifest.publish_eligible).toBe(false)
  })

  it('rejects lost grades, stale orders and changed progression or rendered content', () => {
    const check = (edit: (value: ReturnType<typeof fixture>) => void, reason: string) => {
      const value = fixture()
      edit(value)
      expect(() => verifyProductPlanFulfillment(value)).toThrow(reason)
    }
    check(value => { value.units.pop() }, 'PRODUCT_PLAN_GRADE_OR_UNIT_COUNT_MISMATCH')
    check(value => { value.orders[0]!.planning_hash = hash('c') }, 'PRODUCT_PLAN_ORDER_STALE')
    check(value => { value.units[0]!.order_hash = hash('c') }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[0]!.domain = 'history' }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[0]!.genre = 'narrative' }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[0]!.primary_skill = 'other' }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[0]!.difficulty_level = 11 }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[0]!.item_types = ['other'] }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[0]!.item_types.push('other') }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[4]!.revisit_prior_skill = false }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[0]!.passage = 'short' }, 'PRODUCT_PLAN_PASSAGE_LENGTH_OUTSIDE_BAND')
    check(value => { value.units[0]!.unit_html = '<section>Different text</section>' }, 'PRODUCT_PLAN_UNIT_PASSAGE_NOT_RENDERED')
    check(value => { value.units[0]!.unit_html = `<!-- ${value.units[0]!.passage} -->` }, 'PRODUCT_PLAN_UNIT_HTML_UNVERIFIABLE')
    check(value => { value.units[0]!.unit_html = `<!-- ${value.units[0]!.passage}` }, 'PRODUCT_PLAN_UNIT_HTML_UNVERIFIABLE')
    check(value => { value.units[0]!.unit_html = `<script>${value.units[0]!.passage}</script>` }, 'PRODUCT_PLAN_UNIT_HTML_UNVERIFIABLE')
    check(value => { value.units[0]!.unit_html = `<p hidden>${value.units[0]!.passage}</p>` }, 'PRODUCT_PLAN_UNIT_HTML_UNVERIFIABLE')
    check(value => {
      value.orders[1]!.product_order_id = value.orders[0]!.product_order_id
      for (const unit of value.units.filter(unit => unit.grade === 'middle_2'))
        unit.product_order_id = value.orders[0]!.product_order_id
    }, 'PRODUCT_PLAN_ORDER_REUSED_ACROSS_GRADES')
    check(value => { for (const unit of value.units) unit.source_mode = 'direct' }, 'PRODUCT_PLAN_SOURCE_MIX_MISMATCH')
    check(value => { value.units[0]!.grade = 'middle_2' }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    check(value => { value.units[1]!.unit_id = value.units[0]!.unit_id }, 'PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
  })

  it('accepts visible passage text split by inline emphasis', () => {
    const value = fixture()
    const unit = value.units[0]!
    unit.unit_html = `<section><p>${unit.passage.replace('word1', '<em>word1</em>')}</p></section>`
    expect(verifyProductPlanFulfillment(value).unit_count).toBe(40)
  })
})
