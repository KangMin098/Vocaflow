// packages/library-pipeline/src/textbook/order-production-run.ts
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { PRODUCT_CAPABILITIES } from './factory-order'
import { buildStructuredProductOrderDraft, planProductBrief, assemblePlannedVolumeSynthetic } from './product-planning'
import { renderReadingFamilyUnit } from './reading-family-unit'
import { canonicalJson } from './review-digest'

/**
 * Registered-order production run: the same structured drafts that the admin
 * `/api/admin/csat/product-order-draft` route seals and registers are re-sealed here,
 * exported as grade/day drain cells, filled by an agent drain, gated by the family
 * adapter and assembled into one student volume. Every cell carries its order revision
 * and hash, so stale or mixed evidence fails before any output is written.
 */
export const ORDER_RUN_STAGES = [
  'order_sealed', 'drain_exported', 'drain_filled', 'items_gated', 'units_built', 'volume_assembled',
] as const

const sha = (value: string) => createHash('sha256').update(value).digest('hex')
const runInputSchema = z.object({
  schema: z.literal('textbook-order-production-input/1'),
  sealed_at: z.string().datetime(),
  drafts: z.array(z.unknown()).min(1),
}).strict()

// P03 and the 15 generic reading families take a single sealed passage with no extra resource.
// P13/P14/P18/P20 need sealed resources or time budgets the brief planner does not produce yet.
const PLANNED_PATH_FAMILIES = new Set([
  'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10',
  'P11', 'P12', 'P15', 'P16', 'P17', 'P19',
])
const FAMILY_REQUIREMENT: Record<string, string> = {
  P05: 'focus_text must be a whole word/phrase inside evidence_primary (vocabulary in context).',
  P06: 'focus_text must be the target structure inside evidence_primary (academic sentence).',
  P19: 'focus_text must be a whole word/phrase inside evidence_primary (intervention scaffold).',
  P08: 'evidence_secondary is required and must not overlap evidence_primary (structure).',
  P09: 'evidence_secondary is required and must not overlap evidence_primary (relation).',
  P10: 'evidence_secondary is required and must not overlap evidence_primary (inference).',
  P12: 'evidence_secondary is required and must not overlap evidence_primary (argument).',
}

/** Re-seals each registered draft and checks that all drafts belong to one brief/plan. */
export function sealOrderProductionInput(input: unknown) {
  const run = runInputSchema.parse(input)
  const firstFamily = planProductBrief((run.drafts[0] as { brief?: unknown })?.brief).plan.product_family
  if (!PLANNED_PATH_FAMILIES.has(firstFamily)) throw Error(`ORDER_RUN_FAMILY_NOT_IN_PLANNED_PATH:${firstFamily}`)
  const sealed = run.drafts.map(draft => {
    const order = buildStructuredProductOrderDraft(draft, run.sealed_at)
    const grade = (draft as { grade: string }).grade
    return { grade, order: order.order, order_hash: order.order_hash, brief: (draft as { brief: unknown }).brief }
  })
  const briefs = new Set(sealed.map(entry => canonicalJson(entry.brief)))
  if (briefs.size !== 1) throw Error('ORDER_RUN_BRIEF_MIXED')
  const brief = sealed[0]!.brief
  const { plan, plan_hash } = planProductBrief(brief)
  const grades = plan.brief.grade_scope.grades
  if (sealed.length !== grades.length || grades.some(grade => !sealed.some(entry => entry.grade === grade)))
    throw Error('ORDER_RUN_GRADE_ORDER_MISMATCH')
  if (!PLANNED_PATH_FAMILIES.has(plan.product_family)) throw Error(`ORDER_RUN_FAMILY_NOT_IN_PLANNED_PATH:${plan.product_family}`)
  return { brief, plan, plan_hash, orders: sealed.map(({ grade, order, order_hash }) => ({ grade, order, order_hash })) }
}

function cellsFor(sealed: ReturnType<typeof sealOrderProductionInput>) {
  const directCount = Math.round(sealed.plan.units.length * sealed.plan.source_mix_target.direct / 100)
  return sealed.orders.flatMap(entry => sealed.plan.units.map(unit => {
    const cell = {
      cell_id: `${entry.order.product_order_id}:r${entry.order.order_revision}:d${unit.day}`,
      grade: entry.grade, day: unit.day, family: sealed.plan.product_family,
      product_order_id: entry.order.product_order_id, order_revision: entry.order.order_revision,
      order_hash: entry.order_hash, planning_hash: sealed.plan_hash,
      primary_skill: unit.primary_skill, domain: unit.domain, genre: unit.genre,
      difficulty_level: unit.difficulty_level, passage_words_target: unit.passage_words_target,
      item_type: unit.item_type_target!, revisit_prior_skill: unit.revisit_prior_skill,
      cumulative_review: unit.cumulative_review,
      source_mode: unit.day <= directCount ? 'direct' as const : 'adaptation' as const,
      family_requirement: FAMILY_REQUIREMENT[sealed.plan.product_family] ?? 'evidence_primary must be a unique exact span of the passage.',
    }
    return { ...cell, cell_hash: sha(canonicalJson(cell)) }
  }))
}

/** Drain export: one cell per grade/day, bound to order revision, order hash and plan hash. */
export function exportOrderProductionDrain(input: unknown) {
  const sealed = sealOrderProductionInput(input)
  const cells = cellsFor(sealed)
  const body = { schema: 'textbook-order-production-drain/1' as const, synthetic_or_drain: true,
    planning_hash: sealed.plan_hash, product_family: sealed.plan.product_family,
    grade_scope: sealed.plan.brief.grade_scope,
    orders: sealed.orders.map(entry => ({ grade: entry.grade, product_order_id: entry.order.product_order_id,
      order_revision: entry.order.order_revision, order_hash: entry.order_hash })),
    fill_contract: 'Write chunk.out.json: { cells: [{ cell_id, cell_hash, passage, items: [{ item_id, item_type, question, choices[2-5], answer(1-based), explanation, evidence_primary, evidence_secondary?, focus_text? }] }] }. passage word count must be within max(10, 15%) of passage_words_target; evidence spans must be exact unique substrings.',
    cells }
  return { ...body, drain_hash: sha(canonicalJson(body)) }
}

const filledItemSchema = z.object({
  item_id: z.string().trim().min(1), item_type: z.string().trim().min(1),
  question: z.string().trim().min(1), choices: z.array(z.string().trim().min(1)).min(2).max(5),
  answer: z.number().int().min(1).max(5), explanation: z.string().trim().min(1),
  evidence_primary: z.string().trim().min(1), evidence_secondary: z.string().trim().min(1).optional(),
  focus_text: z.string().trim().min(1).optional(),
}).strict()
const filledSchema = z.object({ cells: z.array(z.object({
  cell_id: z.string().min(1), cell_hash: z.string().regex(/^[a-f0-9]{64}$/),
  passage: z.string().trim().min(1), items: z.array(filledItemSchema).min(1),
}).strict()) }).strict()

const esc = (text: string) => text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;')
  .replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&#39;')

function gateP03(passage: string, items: z.infer<typeof filledItemSchema>[], itemTypes: string[]) {
  for (const item of items) {
    const at = passage.indexOf(item.evidence_primary)
    if (at < 0 || at !== passage.lastIndexOf(item.evidence_primary) || !itemTypes.includes(item.item_type) ||
        !PRODUCT_CAPABILITIES.P03.items.includes(item.item_type) || item.answer > item.choices.length)
      throw Error('READING_FAMILY_ITEM_UNGROUNDED')
  }
}

export type OrderRunBlocker = { stage: (typeof ORDER_RUN_STAGES)[number]; cell_id?: string; reason: string }

/**
 * Drain import: re-derives the export from the current registered drafts, rejects
 * stale/mixed cells, runs the family adapter on every cell and assembles the volume.
 * Returns blockers instead of partial output; never reports partial success.
 */
export function importOrderProductionDrain(input: unknown, filledInput: unknown) {
  const drain = exportOrderProductionDrain(input)
  const sealed = sealOrderProductionInput(input)
  const blockers: OrderRunBlocker[] = []
  const parsed = filledSchema.safeParse(filledInput)
  if (!parsed.success) return { status: 'blocked' as const, drain_hash: drain.drain_hash,
    blockers: [{ stage: 'drain_filled' as const, reason: 'ORDER_RUN_FILL_SHAPE_INVALID' }] }
  const filled = new Map<string, (typeof parsed.data.cells)[number]>()
  for (const cell of parsed.data.cells) {
    if (filled.has(cell.cell_id)) blockers.push({ stage: 'drain_filled', cell_id: cell.cell_id, reason: 'ORDER_RUN_CELL_DUPLICATE' })
    filled.set(cell.cell_id, cell)
  }
  const known = new Set(drain.cells.map(cell => cell.cell_id))
  for (const id of filled.keys()) if (!known.has(id))
    blockers.push({ stage: 'drain_filled', cell_id: id, reason: 'ORDER_RUN_CELL_STALE_OR_FOREIGN' })
  const orderByGrade = new Map(sealed.orders.map(entry => [entry.grade, entry]))
  const seenItems = new Set<string>()
  const units = []
  for (const cell of drain.cells) {
    const fill = filled.get(cell.cell_id)
    if (!fill) { blockers.push({ stage: 'drain_filled', cell_id: cell.cell_id, reason: 'ORDER_RUN_CELL_MISSING' }); continue }
    if (fill.cell_hash !== cell.cell_hash) {
      blockers.push({ stage: 'drain_filled', cell_id: cell.cell_id, reason: 'ORDER_RUN_CELL_HASH_STALE' }); continue
    }
    const entry = orderByGrade.get(cell.grade)!
    if (fill.items[0]!.item_type !== cell.item_type || fill.items.some(item => seenItems.has(item.item_id))) {
      blockers.push({ stage: 'items_gated', cell_id: cell.cell_id, reason: 'ORDER_RUN_ITEM_PLAN_OR_ID_MISMATCH' }); continue
    }
    try {
      if (cell.family === 'P03') gateP03(fill.passage, fill.items, entry.order.item_types)
      else renderReadingFamilyUnit({ order: entry.order, grade: entry.order.grade_detail_target ?? entry.order.grade_target,
        passage: fill.passage, items: fill.items.map(item => ({ id: item.item_id,
          payload: { passage: fill.passage, item_type: item.item_type, question: item.question, choices: item.choices,
            evidence_primary: item.evidence_primary, evidence_secondary: item.evidence_secondary, focus_text: item.focus_text },
          answer_key: { answer: item.answer } })) })
    } catch (error) {
      blockers.push({ stage: 'items_gated', cell_id: cell.cell_id, reason: (error as Error).message }); continue
    }
    fill.items.forEach(item => seenItems.add(item.item_id))
    const passageHash = sha(fill.passage)
    const questionText = (item: z.infer<typeof filledItemSchema>) =>
      `${item.question} ${item.choices.map((choice, index) => `(${index + 1}) ${choice}`).join(' ')}`
    units.push({
      day: cell.day, grade: cell.grade as never, product_order_id: cell.product_order_id,
      order_revision: cell.order_revision, order_hash: cell.order_hash, planning_hash: cell.planning_hash,
      primary_skill: cell.primary_skill, domain: cell.domain, genre: cell.genre,
      difficulty_level: cell.difficulty_level, passage: fill.passage,
      items: fill.items.map(item => ({ item_id: item.item_id, item_type: item.item_type,
        prompt: questionText(item), answer: item.choices[item.answer - 1]!, explanation: item.explanation,
        evidence_quote: item.evidence_primary, passage_hash: passageHash,
        product_order_id: cell.product_order_id, order_revision: cell.order_revision, order_hash: cell.order_hash })),
      source_mode: cell.source_mode, revisit_prior_skill: cell.revisit_prior_skill,
      cumulative_review: cell.cumulative_review, unit_id: cell.cell_id,
      unit_html: `<section><p>${esc(fill.passage)}</p>${fill.items.map(item => `<p>${esc(questionText(item))}</p>`).join('')}</section>`,
    })
  }
  if (blockers.length) return { status: 'blocked' as const, drain_hash: drain.drain_hash, blockers }
  const volumeInput = { brief: sealed.brief, orders: sealed.orders, units }
  try {
    const output = assemblePlannedVolumeSynthetic(volumeInput)
    // The adapter-level item fields (choices, secondary/focus evidence) feed downstream atomic production.
    const gatedItems = drain.cells.map(cell => ({ unit_id: cell.cell_id, items: filled.get(cell.cell_id)!.items }))
    return { status: 'assembled' as const, drain_hash: drain.drain_hash, volumeInput, output, gatedItems,
      lineage: output.receipt.units.map(unit => ({ grade: unit.grade, day: unit.day, unit_id: unit.unit_id,
        product_order_id: unit.product_order_id, order_revision: unit.order_revision, order_hash: unit.order_hash,
        passage_hash: unit.passage_hash, unit_hash: unit.unit_hash, item_ids: unit.items.map(item => item.item_id) })) }
  } catch (error) {
    return { status: 'blocked' as const, drain_hash: drain.drain_hash,
      blockers: [{ stage: 'volume_assembled' as const, reason: (error as Error).message }] }
  }
}

/** Status for one run directory, derived only from the files the CLI wrote. */
export function summarizeOrderRun(files: { drain?: { drain_hash: string; cells: unknown[]; orders: unknown[] };
  result?: { status: string; drain_hash: string; blockers?: OrderRunBlocker[] }; complete?: { manifest_hash: string } }) {
  const stage = !files.drain ? 'order_sealed' : !files.result ? 'drain_exported'
    : files.result.status === 'blocked' ? (files.result.blockers?.[0]?.stage ?? 'drain_filled')
      : files.complete ? 'volume_assembled' : 'units_built'
  return {
    current_stage: stage,
    status: files.complete ? 'complete' : files.result?.status === 'blocked' ? 'blocked' : 'in_progress',
    stale: Boolean(files.result && files.drain && files.result.drain_hash !== files.drain.drain_hash),
    blockers: files.result?.blockers ?? [],
    orders: files.drain?.orders ?? [],
    cell_count: files.drain?.cells.length ?? 0,
    manifest_hash: files.complete?.manifest_hash ?? null,
  }
}

