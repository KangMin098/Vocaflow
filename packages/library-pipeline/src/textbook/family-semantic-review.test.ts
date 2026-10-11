// packages/library-pipeline/src/textbook/family-semantic-review.test.ts
import { describe, expect, it } from 'vitest'
import { PRODUCT_FAMILIES } from './academic-reading'
import { exportOrderProductionDrain, importOrderProductionDrain } from './order-production-run'
import { planProductBrief } from './product-planning'
import { exportFamilyReview, FAMILY_CRITERIA, importFamilyReview } from './family-semantic-review'

const h = (c: string) => c.repeat(64)
const policy = (n: string) => ({ version: `p${n}`, hash: h(n) })
const brief = { schema: 'textbook-product-brief/1', grade_scope: { mode: 'multi_grade', grades: ['middle_1', 'high_3'] },
  purpose: 'relation_reading', domain_weights: { science: 1 }, genre_weights: { explanation: 1 }, duration_days: 2,
  units_per_chapter: 2, difficulty: { start: 2, end: 3 }, passage_words: { start: 60, end: 70 }, source_strategy: 'balanced' }
const input = { schema: 'textbook-order-production-input/1', sealed_at: '2026-10-07T00:00:00Z',
  drafts: brief.grade_scope.grades.map(grade => ({ brief, plan_hash: planProductBrief(brief).plan_hash, grade,
    product_order_id: `order-${grade}`, order_revision: 1, series_id: 's', edition_id: 'e', product_variant: 'student',
    language_band: grade.startsWith('high') ? 'high' : 'middle', passage_v_level: grade.startsWith('high') ? 7 : 5,
    share_alike: false, unit_spec_version: 'u1', chapter_spec_version: 'c1', volume_spec_version: 'v1',
    layout_profile: 'reading-v1', policies: { source: policy('1'), rights: policy('2'), adaptation: policy('3'),
      benchmark: policy('4'), evidence: policy('5'), trust: policy('6') } })) }
const drain = exportOrderProductionDrain(input)
const run = importOrderProductionDrain(input, { cells: drain.cells.map(cell => {
  const primary = `Heavy rain on day ${cell.day} raised the river for ${cell.grade}.`
  const filler = Array.from({ length: cell.passage_words_target - 20 }, (_, i) => `w${i}`).join(' ')
  return { cell_id: cell.cell_id, cell_hash: cell.cell_hash,
    passage: `${primary} ${filler} Because the river rose, the farmers moved their animals uphill.`,
    items: [{ item_id: `${cell.cell_id}:i1`, item_type: cell.item_type, question: 'Why did the farmers move their animals?',
      choices: ['The river rose after the rain.', 'The animals were sold.'], answer: 1, explanation: '두 번째 근거 문장이 원인을 말한다.',
      evidence_primary: primary, evidence_secondary: 'Because the river rose, the farmers moved their animals uphill.' }] }
}) })
if (run.status !== 'assembled') throw Error('fixture run not assembled')
const approveAll = (review = exportFamilyReview(run)) => ({ reviewer_id: 'claude-family-reviewer',
  units: review.units.map(unit => ({ unit_id: unit.unit_id, unit_hash: unit.unit_hash, verdict: 'pass' as 'pass' | 'fail',
    criteria: Object.fromEntries(review.criteria.map(c => [c.id, true])), quote: 'Because the river rose',
    rationale: '두 번째 근거가 원인-결과 관계를 명시한다.' })) })

describe('family semantic review', () => {
  it('defines family criteria for all 20 families and exports them with every unit', () => {
    expect(Object.keys(FAMILY_CRITERIA).sort()).toEqual(Object.keys(PRODUCT_FAMILIES).sort())
    const review = exportFamilyReview(run)
    expect(review.family).toBe('P09')
    expect(review.criteria.map(c => c.id)).toEqual(expect.arrayContaining(['explicit_relation', 'relation_item', 'answer_unique']))
    expect(review.units).toHaveLength(4)
  })

  it('passes only when every unit passes every criterion with a quote from its own passage', () => {
    const passed = importFamilyReview(run, approveAll())
    expect(passed.status).toBe('passed')
    const fail = approveAll(); fail.units[0]!.criteria.relation_item = false; fail.units[0]!.verdict = 'fail'
    expect(JSON.stringify(importFamilyReview(run, fail))).toContain('FAMILY_REVIEW_FAILED:relation_item')
    const inconsistent = approveAll(); inconsistent.units[1]!.criteria.answer_unique = false
    expect(JSON.stringify(importFamilyReview(run, inconsistent))).toContain('FAMILY_REVIEW_VERDICT_INCONSISTENT')
    const missing = approveAll(); missing.units.pop()
    expect(JSON.stringify(importFamilyReview(run, missing))).toContain('FAMILY_REVIEW_UNIT_MISSING')
    const stale = approveAll(); stale.units[0]!.unit_hash = h('0')
    expect(JSON.stringify(importFamilyReview(run, stale))).toContain('FAMILY_REVIEW_UNIT_STALE')
    const invented = approveAll(); invented.units[0]!.quote = 'This sentence is not in the passage'
    expect(JSON.stringify(importFamilyReview(run, invented))).toContain('FAMILY_REVIEW_QUOTE_NOT_IN_PASSAGE')
    const extra = approveAll(); extra.units[0]!.criteria.made_up = true
    expect(JSON.stringify(importFamilyReview(run, extra))).toContain('FAMILY_REVIEW_CRITERIA_MISMATCH')
  })
})

describe('planning guard found by the live drain', () => {
  it('rejects a diagnostic companion for a single-skill family at planning time', () => {
    expect(() => planProductBrief({ ...brief, companion_activities: ['diagnostic_check'] })).toThrow('COMPANION_DIAGNOSTIC_NEEDS_TWO_SKILLS')
    expect(() => planProductBrief({ ...brief, product_family: 'P03', companion_activities: ['diagnostic_check'] })).not.toThrow()
  })
})
