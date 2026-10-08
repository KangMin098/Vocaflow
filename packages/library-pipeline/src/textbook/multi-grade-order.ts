// packages/library-pipeline/src/textbook/multi-grade-order.ts
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { productOrderSchema, sealProductOrder } from './factory-order'
import { canonicalJson } from './review-digest'

const digest = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex')
const id = z.string().trim().min(1)
const hex = z.string().regex(/^[a-f0-9]{64}$/)
export const PRODUCT_GRADES = [
  'elementary_5', 'elementary_6', 'middle_1', 'middle_2', 'middle_3', 'high_1', 'high_2', 'high_3',
] as const
const grade = z.enum(PRODUCT_GRADES)
const gradeOrder = new Map<string, number>(PRODUCT_GRADES.map((value, index) => [value, index]))
const targetBand = (value: (typeof PRODUCT_GRADES)[number]) =>
  value === 'elementary_5' || value === 'elementary_6' ? 'upper_elementary' : value

export const gradeScopeSchema = z.object({
  mode: z.enum(['single_grade', 'grade_range', 'multi_grade']),
  grades: z.array(grade).min(1),
}).strict().superRefine((scope, ctx) => {
  const ranks = scope.grades.map(value => gradeOrder.get(value)!)
  if (ranks.some((rank, index) => index > 0 && rank <= ranks[index - 1]!))
    ctx.addIssue({ code: 'custom', message: 'grades must be unique and in school order' })
  if ((scope.mode === 'single_grade') !== (scope.grades.length === 1))
    ctx.addIssue({ code: 'custom', message: 'single-grade scope must contain exactly one grade' })
  if (scope.mode === 'grade_range' && ranks.some((rank, index) => index > 0 && rank !== ranks[index - 1]! + 1))
    ctx.addIssue({ code: 'custom', message: 'grade range must be contiguous' })
})

export const multiGradeProductOrderSchema = z.object({
  schema: z.literal('textbook-product-order-group/1'),
  group_id: id,
  group_revision: z.number().int().positive(),
  grade_scope: gradeScopeSchema,
  delivery_mode: z.enum([
    'single_grade',
    'shared_passage_grade_specific_items',
    'grade_specific_adaptations',
    'grade_specific_units',
  ]),
  orders: z.array(z.object({ grade, order: productOrderSchema }).strict()).min(1),
}).strict().superRefine((group, ctx) => {
  if ((group.grade_scope.mode === 'single_grade') !== (group.delivery_mode === 'single_grade'))
    ctx.addIssue({ code: 'custom', message: 'delivery mode differs from grade scope' })
  if (group.orders.length !== group.grade_scope.grades.length ||
      group.orders.some((entry, index) => entry.grade !== group.grade_scope.grades[index] ||
        entry.order.grade_target !== targetBand(entry.grade) ||
        entry.order.target.age_band !== targetBand(entry.grade) ||
        ((entry.grade === 'elementary_5' || entry.grade === 'elementary_6') &&
          entry.order.grade_detail_target !== entry.grade)))
    ctx.addIssue({ code: 'custom', message: 'one distinct child order per grade is required' })
  if (new Set(group.orders.map(entry => entry.order.product_order_id)).size !== group.orders.length)
    ctx.addIssue({ code: 'custom', message: 'child order IDs must differ' })
  const first = group.orders[0]?.order
  if (first && group.orders.some(({ order }) =>
    order.series_id !== first.series_id || order.edition_id !== first.edition_id ||
    order.product_family !== first.product_family ||
    order.source_policy_hash !== first.source_policy_hash ||
    order.rights_policy_hash !== first.rights_policy_hash ||
    order.trust_policy_hash !== first.trust_policy_hash ||
    order.benchmark_contract_hash !== first.benchmark_contract_hash ||
    order.evidence_policy_hash !== first.evidence_policy_hash))
    ctx.addIssue({ code: 'custom', message: 'child orders must share edition and policy revision' })
})
export type MultiGradeProductOrder = z.infer<typeof multiGradeProductOrderSchema>

export function sealMultiGradeProductOrder(input: unknown) {
  const group = multiGradeProductOrderSchema.parse(input)
  const child_order_hashes = Object.fromEntries(group.orders.map(({ grade, order }) =>
    [grade, sealProductOrder(order).order_hash]))
  return { group, group_hash: digest(group), child_order_hashes }
}

const variantEvidenceSchema = z.object({
  grade, product_order_id: id, order_revision: z.number().int().positive(), order_hash: hex,
  passage_hash: hex, adaptation_hash: hex.nullable(), item_set_hash: hex,
  activity_hash: hex.nullable(), benchmark_version: id, benchmark_snapshot_hash: hex,
  gold_s_candidate_hash: hex.nullable(), unit_set_hash: hex, analysis_hash: hex,
}).strict()
export const multiGradeEvidenceSchema = z.object({
  schema: z.literal('textbook-multi-grade-evidence/1'),
  group_id: id, group_revision: z.number().int().positive(), group_hash: hex,
  source_id: id, source_hash: hex, rights_hash: hex, variants: z.array(variantEvidenceSchema).min(1),
}).strict()
export type MultiGradeEvidence = z.infer<typeof multiGradeEvidenceSchema>

export function bindMultiGradeEvidence(groupInput: unknown, evidenceInput: unknown) {
  const sealed = sealMultiGradeProductOrder(groupInput)
  const evidence = multiGradeEvidenceSchema.parse(evidenceInput)
  if (evidence.group_id !== sealed.group.group_id || evidence.group_revision !== sealed.group.group_revision ||
      evidence.group_hash !== sealed.group_hash || evidence.variants.length !== sealed.group.orders.length)
    throw new Error('MULTI_GRADE_GROUP_STALE')
  for (const [index, variant] of evidence.variants.entries()) {
    const { grade: childGrade, order } = sealed.group.orders[index]!
    if (variant.grade !== childGrade || variant.product_order_id !== order.product_order_id ||
        variant.order_revision !== order.order_revision || variant.order_hash !== sealed.child_order_hashes[variant.grade])
      throw new Error('MULTI_GRADE_CHILD_ORDER_STALE_OR_MIXED')
  }
  const passages = evidence.variants.map(variant => variant.passage_hash)
  const adaptations = evidence.variants.map(variant => variant.adaptation_hash)
  if (sealed.group.delivery_mode === 'shared_passage_grade_specific_items' &&
      (new Set(passages).size !== 1 || new Set(adaptations).size !== 1 ||
        new Set(evidence.variants.map(variant => variant.item_set_hash)).size !== evidence.variants.length))
    throw new Error('SHARED_PASSAGE_VARIANT_MISMATCH')
  if (sealed.group.delivery_mode === 'grade_specific_adaptations' &&
      (new Set(passages).size !== passages.length || adaptations.some(value => value === null)))
    throw new Error('GRADE_ADAPTATION_MISSING_OR_REUSED')
  if (sealed.group.delivery_mode === 'grade_specific_units' &&
      new Set(evidence.variants.map(variant => variant.unit_set_hash)).size !== evidence.variants.length)
    throw new Error('GRADE_UNIT_SET_REUSED')
  return { evidence, evidence_hash: digest(evidence) }
}

export function assessMultiGradeEvidence(groupInput: unknown, recorded: MultiGradeEvidence, current: MultiGradeEvidence, rightsAllowed = true) {
  if (!rightsAllowed) return { state: 'invalidated' as const, reason: 'rights revoked' }
  const before = multiGradeEvidenceSchema.parse(recorded)
  const after = multiGradeEvidenceSchema.parse(current)
  try { bindMultiGradeEvidence(groupInput, after) }
  catch { return { state: 'stale' as const, reason: 'current group or grade evidence changed' } }
  return digest(before) === digest(after)
    ? { state: 'current' as const, reason: null }
    : { state: 'stale' as const, reason: 'group or grade evidence changed' }
}

const productionUnitSchema = z.object({
  unit_id: id, grade, product_order_id: id, order_revision: z.number().int().positive(),
  order_hash: hex, source_id: id, source_hash: hex, rights_hash: hex, passage_hash: hex,
  adaptation_hash: hex.nullable(), item_set_hash: hex, activity_hash: hex.nullable(), benchmark_snapshot_hash: hex,
  unit_content_hash: hex,
}).strict()

export function planMultiGradeVolume(groupInput: unknown, evidenceInput: unknown, unitsInput: unknown) {
  const group = multiGradeProductOrderSchema.parse(groupInput)
  const { evidence, evidence_hash } = bindMultiGradeEvidence(group, evidenceInput)
  const units = z.array(productionUnitSchema).min(1).parse(unitsInput)
  if (new Set(units.map(unit => unit.unit_id)).size !== units.length) throw new Error('MULTI_GRADE_UNIT_DUPLICATE')
  if (group.grade_scope.grades.some(gradeValue => !units.some(unit => unit.grade === gradeValue)))
    throw new Error('MULTI_GRADE_UNIT_MISSING')
  for (const unit of units) {
    const variant = evidence.variants.find(row => row.grade === unit.grade)
    if (!variant || unit.product_order_id !== variant.product_order_id ||
        unit.order_revision !== variant.order_revision || unit.order_hash !== variant.order_hash ||
        unit.source_id !== evidence.source_id || unit.source_hash !== evidence.source_hash ||
        unit.rights_hash !== evidence.rights_hash ||
        unit.passage_hash !== variant.passage_hash || unit.adaptation_hash !== variant.adaptation_hash ||
        unit.item_set_hash !== variant.item_set_hash ||
        unit.activity_hash !== variant.activity_hash ||
        unit.benchmark_snapshot_hash !== variant.benchmark_snapshot_hash)
      throw new Error('MULTI_GRADE_UNIT_LINEAGE_STALE_OR_MIXED')
  }
  for (const variant of evidence.variants) {
    const unitSet = units.filter(unit => unit.grade === variant.grade)
      .map(unit => [unit.unit_id, unit.unit_content_hash])
    if (digest(unitSet) !== variant.unit_set_hash) throw new Error('MULTI_GRADE_UNIT_SET_STALE')
  }
  const plan = { schema: 'textbook-multi-grade-volume-plan/1', status: 'contract_only',
    render_eligible: false, seed_eligible: false, group_id: group.group_id,
    group_revision: group.group_revision, group_hash: digest(group), evidence_hash, units }
  return { ...plan, plan_hash: digest(plan) }
}
