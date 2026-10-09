// packages/library-pipeline/src/textbook/product-planning.ts
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { PRODUCT_FAMILIES } from './academic-reading'
import { PRODUCT_CAPABILITIES, sealProductOrder, type ProductOrder } from './factory-order'
import { gradeScopeSchema, PRODUCT_GRADES } from './multi-grade-order'
import { canonicalJson } from './review-digest'

export const PRODUCT_PURPOSES = [
  'knowledge_reading', 'relation_reading', 'vocabulary_in_context',
  'academic_sentence', 'inference', 'exam_bridge',
] as const

const purposeFamily: Record<(typeof PRODUCT_PURPOSES)[number], keyof typeof PRODUCT_FAMILIES> = {
  knowledge_reading: 'P03', relation_reading: 'P09', vocabulary_in_context: 'P05',
  academic_sentence: 'P06', inference: 'P10', exam_bridge: 'P17',
}

const mix = z.record(z.number().finite().positive()).refine(value => Object.keys(value).length > 0)
export const productBriefSchema = z.object({
  schema: z.literal('textbook-product-brief/1'),
  grade_scope: gradeScopeSchema,
  purpose: z.enum(PRODUCT_PURPOSES),
  product_family: z.enum(Object.keys(PRODUCT_FAMILIES) as [keyof typeof PRODUCT_FAMILIES, ...(keyof typeof PRODUCT_FAMILIES)[]]).optional(),
  domain_weights: mix,
  genre_weights: mix,
  duration_days: z.number().int().min(1).max(180),
  units_per_chapter: z.number().int().min(1).max(20),
  difficulty: z.object({ start: z.number().int().min(0).max(11), end: z.number().int().min(0).max(11) }).strict(),
  passage_words: z.object({ start: z.number().int().min(40).max(1200), end: z.number().int().min(40).max(1200) }).strict(),
  source_strategy: z.enum(['direct_first', 'adaptation_first', 'balanced']),
}).strict().superRefine((value, ctx) => {
  if (value.difficulty.end < value.difficulty.start)
    ctx.addIssue({ code: 'custom', message: 'difficulty curve must not decrease' })
  if (value.passage_words.end < value.passage_words.start)
    ctx.addIssue({ code: 'custom', message: 'passage length curve must not decrease' })
})
export type ProductBrief = z.infer<typeof productBriefSchema>

function schedule(weights: Record<string, number>, length: number) {
  const keys = Object.keys(weights).sort()
  const total = keys.reduce((sum, key) => sum + weights[key]!, 0)
  const used = Object.fromEntries(keys.map(key => [key, 0])) as Record<string, number>
  return Array.from({ length }, (_, index) => {
    const day = index + 1
    const selected = [...keys].sort((a, b) => {
      const deficitA = day * weights[a]! / total - used[a]!
      const deficitB = day * weights[b]! / total - used[b]!
      return deficitB - deficitA || a.localeCompare(b)
    })[0]!
    used[selected]! += 1
    return selected
  })
}

const interpolate = (start: number, end: number, index: number, length: number) =>
  length === 1 ? start : Math.round(start + (end - start) * index / (length - 1))

/** Planning targets are proposals. Rights and source admission still decide actual routes. */
export function planProductBrief(input: unknown) {
  const brief = productBriefSchema.parse(input)
  const family = brief.product_family ?? purposeFamily[brief.purpose]
  const capability = PRODUCT_CAPABILITIES[family]
  const domains = schedule(brief.domain_weights, brief.duration_days)
  const genres = schedule(brief.genre_weights, brief.duration_days)
  const skills = PRODUCT_FAMILIES[family].skills
  const itemTypes = capability.items
  const units = Array.from({ length: brief.duration_days }, (_, index) => {
    const day = index + 1
    return {
      day,
      chapter: Math.floor(index / brief.units_per_chapter) + 1,
      grade_scope: brief.grade_scope,
      primary_skill: skills[index % skills.length]!,
      domain: domains[index]!, genre: genres[index]!,
      difficulty_level: interpolate(brief.difficulty.start, brief.difficulty.end, index, brief.duration_days),
      passage_words_target: interpolate(brief.passage_words.start, brief.passage_words.end, index, brief.duration_days),
      item_type_target: itemTypes.length ? itemTypes[index % itemTypes.length]! : null,
      revisit_prior_skill: day > 1 && day % brief.units_per_chapter === 0,
      cumulative_review: day === brief.duration_days,
    }
  })
  const chapters = Array.from({ length: Math.ceil(brief.duration_days / brief.units_per_chapter) }, (_, index) => ({
    chapter: index + 1,
    from_day: index * brief.units_per_chapter + 1,
    to_day: Math.min(brief.duration_days, (index + 1) * brief.units_per_chapter),
  }))
  const source_mix_target = brief.source_strategy === 'direct_first'
    ? { direct: 80, adaptation: 20 }
    : brief.source_strategy === 'adaptation_first'
      ? { direct: 20, adaptation: 80 }
      : { direct: 50, adaptation: 50 }
  const plan = {
    schema: 'textbook-product-plan/1' as const,
    brief, product_family: family,
    production_capability: capability.state,
    skill_mix: [...skills],
    source_mix_target,
    units, chapters,
    warning: 'Planning targets are not admission, grade validity or production evidence.',
  }
  return { plan, plan_hash: createHash('sha256').update(canonicalJson(plan)).digest('hex') }
}

type PlannedFields = 'planning_hash' | 'product_family' | 'grade_target' | 'grade_detail_target' |
  'reading_skill_targets' | 'purposes' | 'domain_mix' | 'genre_mix' | 'item_types' |
  'activity_types' | 'passage_difficulty_profile' | 'item_difficulty_profile'

const normalizedMix = (weights: Record<string, number>) => {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0)
  const keys = Object.keys(weights).sort()
  const floors = Object.fromEntries(keys.map(key => [key, Math.floor(weights[key]! / total * 100)])) as Record<string, number>
  const remaining = 100 - Object.values(floors).reduce((sum, value) => sum + value, 0)
  const remainders = [...keys].sort((a, b) =>
    (weights[b]! / total * 100 - floors[b]!) - (weights[a]! / total * 100 - floors[a]!) || a.localeCompare(b))
  for (const key of remainders.slice(0, remaining)) floors[key]! += 1
  return floors
}

/** Binds a planner result to an operator-supplied, versioned policy/target shell. */
export function buildProductOrderFromBrief(
  briefInput: unknown,
  grade: ProductBrief['grade_scope']['grades'][number],
  shell: Omit<ProductOrder, PlannedFields>,
) {
  const { plan, plan_hash } = planProductBrief(briefInput)
  if (['PLANNED', 'UNSUPPORTED'].includes(PRODUCT_CAPABILITIES[plan.product_family].state) ||
      !PRODUCT_CAPABILITIES[plan.product_family].items.length)
    throw new Error('PRODUCT_FAMILY_PRODUCTION_UNSUPPORTED')
  if (!plan.brief.grade_scope.grades.includes(grade)) throw new Error('GRADE_OUTSIDE_PLAN')
  const ageBand = grade.startsWith('elementary_') ? 'upper_elementary' : grade
  if (shell.target.age_band !== ageBand || shell.target.family !== plan.product_family ||
      canonicalJson([...shell.target.skills].sort()) !== canonicalJson([...plan.skill_mix].sort()))
    throw new Error('TARGET_DIFFERS_FROM_PLAN')
  const finalDifficulty = plan.brief.difficulty.end
  const order = {
    ...shell,
    planning_hash: plan_hash,
    product_family: plan.product_family,
    grade_target: ageBand,
    ...(grade.startsWith('elementary_') ? { grade_detail_target: grade } : {}),
    reading_skill_targets: plan.skill_mix,
    purposes: [plan.brief.purpose],
    domain_mix: normalizedMix(plan.brief.domain_weights),
    genre_mix: normalizedMix(plan.brief.genre_weights),
    item_types: [...new Set(plan.units.map(unit => unit.item_type_target))]
      .filter((value): value is string => value !== null),
    activity_types: [],
    passage_difficulty_profile: {
      lexical: finalDifficulty, syntax: finalDifficulty,
      information_density: finalDifficulty, discourse: finalDifficulty,
      inference: finalDifficulty, abstraction: finalDifficulty,
      background_knowledge: finalDifficulty,
    },
    item_difficulty_profile: { reasoning: finalDifficulty },
  }
  return { ...sealProductOrder(order), planning_hash: plan_hash }
}

const fulfilledUnitSchema = z.object({
  day: z.number().int().positive(), grade: z.enum(PRODUCT_GRADES),
  product_order_id: z.string().min(1), order_revision: z.number().int().positive(),
  order_hash: z.string().regex(/^[a-f0-9]{64}$/), planning_hash: z.string().regex(/^[a-f0-9]{64}$/),
  primary_skill: z.string().min(1), domain: z.string().min(1), genre: z.string().min(1),
  difficulty_level: z.number().int().min(0).max(11), passage: z.string().min(1),
  item_types: z.array(z.string().min(1)).min(1), source_mode: z.enum(['direct', 'adaptation']),
  revisit_prior_skill: z.boolean(), cumulative_review: z.boolean(),
  unit_id: z.string().min(1), unit_html: z.string().min(1),
}).strict()

function visibleSyntheticText(html: string) {
  // This ledger accepts a deliberately small, attribute-free HTML subset. It cannot
  // mistake comments, scripts, hidden attributes or stylesheet rules for rendered text.
  if (/<!--[\s\S]*?-->|<!/iu.test(html))
    throw new Error('PRODUCT_PLAN_UNIT_HTML_UNVERIFIABLE')
  const body = html.replace(/<\/?(?:section|p|div|span|strong|em|b|i|br)>/giu, ' ')
  if (/[<>]/u.test(body))
    throw new Error('PRODUCT_PLAN_UNIT_HTML_UNVERIFIABLE')
  return body.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/gu, entity => ({
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
  })[entity]!).replace(/\s+/gu, ' ').trim()
}

/** Checks a caller-supplied synthetic unit ledger against the brief, not item/DB/order evidence. */
export function verifyProductPlanFulfillment(input: {
  brief: unknown
  orders: Array<{ grade: string; product_order_id: string; order_revision: number; order_hash: string; planning_hash: string }>
  units: unknown
}) {
  const { plan, plan_hash } = planProductBrief(input.brief)
  const units = z.array(fulfilledUnitSchema).parse(input.units)
  const orders = new Map(input.orders.map(order => [order.grade, order]))
  const grades = plan.brief.grade_scope.grades
  if (orders.size !== grades.length || input.orders.length !== grades.length ||
      grades.some(grade => !orders.has(grade)) || units.length !== plan.units.length * grades.length)
    throw new Error('PRODUCT_PLAN_GRADE_OR_UNIT_COUNT_MISMATCH')
  if (new Set(input.orders.map(order => order.product_order_id)).size !== input.orders.length)
    throw new Error('PRODUCT_PLAN_ORDER_REUSED_ACROSS_GRADES')
  if (input.orders.some(order => order.planning_hash !== plan_hash ||
      !/^[a-f0-9]{64}$/.test(order.order_hash) || order.order_revision < 1))
    throw new Error('PRODUCT_PLAN_ORDER_STALE')
  const seen = new Set<string>()
  const seenUnitIds = new Set<string>()
  const sourceCounts = new Map(grades.map(grade => [grade, { direct: 0, adaptation: 0 }]))
  const receipts = []
  for (const unit of units) {
    const expected = plan.units[unit.day - 1]
    const order = orders.get(unit.grade)
    const key = `${unit.grade}:${unit.day}`
    if (seen.has(key) || seenUnitIds.has(unit.unit_id) || !expected || !order ||
        unit.product_order_id !== order.product_order_id ||
        unit.order_revision !== order.order_revision || unit.order_hash !== order.order_hash ||
        unit.planning_hash !== plan_hash || unit.primary_skill !== expected.primary_skill ||
        unit.domain !== expected.domain || unit.genre !== expected.genre ||
        unit.difficulty_level !== expected.difficulty_level ||
        !expected.item_type_target || unit.item_types[0] !== expected.item_type_target ||
        unit.item_types.some(type => !PRODUCT_CAPABILITIES[plan.product_family].items.includes(type)) ||
        unit.revisit_prior_skill !== expected.revisit_prior_skill ||
        unit.cumulative_review !== expected.cumulative_review)
      throw new Error('PRODUCT_PLAN_UNIT_STALE_OR_MIXED')
    const words = unit.passage.trim().split(/\s+/u).length
    const allowance = Math.max(10, Math.ceil(expected.passage_words_target * 0.15))
    if (Math.abs(words - expected.passage_words_target) > allowance)
      throw new Error('PRODUCT_PLAN_PASSAGE_LENGTH_OUTSIDE_BAND')
    if (!visibleSyntheticText(unit.unit_html).includes(unit.passage.replace(/\s+/gu, ' ').trim()))
      throw new Error('PRODUCT_PLAN_UNIT_PASSAGE_NOT_RENDERED')
    seen.add(key)
    seenUnitIds.add(unit.unit_id)
    sourceCounts.get(unit.grade)![unit.source_mode] += 1
    receipts.push({ grade: unit.grade, day: unit.day, unit_id: unit.unit_id,
      product_order_id: unit.product_order_id, order_revision: unit.order_revision,
      order_hash: unit.order_hash, passage_hash: createHash('sha256').update(unit.passage).digest('hex'),
      unit_hash: createHash('sha256').update(unit.unit_html).digest('hex'), words,
      source_mode: unit.source_mode, item_types: unit.item_types })
  }
  for (const grade of grades) {
    const actual = sourceCounts.get(grade)!
    const target = plan.units.length * plan.source_mix_target.direct / 100
    if (Math.abs(actual.direct - target) > 1 || actual.direct + actual.adaptation !== plan.units.length)
      throw new Error('PRODUCT_PLAN_SOURCE_MIX_MISMATCH')
  }
  const result = { schema: 'textbook-product-plan-fulfillment/1', synthetic_fixture: true,
    non_production: true, planning_hash: plan_hash, product_family: plan.product_family,
    grade_scope: plan.brief.grade_scope, unit_count: receipts.length,
    units: receipts.sort((a, b) => a.day - b.day || a.grade.localeCompare(b.grade)) }
  return { ...result, receipt_hash: createHash('sha256').update(canonicalJson(result)).digest('hex') }
}

/** Composes a non-production schedule volume after every planned day/grade cell is present. */
export function assemblePlannedVolumeSynthetic(input: Parameters<typeof verifyProductPlanFulfillment>[0]) {
  const receipt = verifyProductPlanFulfillment(input)
  const units = z.array(fulfilledUnitSchema).parse(input.units)
    .sort((a, b) => a.day - b.day || a.grade.localeCompare(b.grade))
  const html = `<!-- SYNTHETIC PLANNED VOLUME; NOT FOR PUBLICATION -->\n${units.map(unit => unit.unit_html).join('\n')}`
  const manifest = { schema: 'textbook-planned-volume-synthetic/1', synthetic_fixture: true,
    non_production: true, publish_eligible: false, planning_hash: receipt.planning_hash,
    fulfillment_receipt_hash: receipt.receipt_hash, unit_count: receipt.unit_count,
    html_sha256: createHash('sha256').update(html).digest('hex') }
  return { html, receipt, manifest: { ...manifest,
    manifest_hash: createHash('sha256').update(canonicalJson(manifest)).digest('hex') } }
}
