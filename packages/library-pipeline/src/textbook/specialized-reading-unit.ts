// packages/library-pipeline/src/textbook/specialized-reading-unit.ts
import { z } from 'zod'
import { PRODUCT_CAPABILITIES, productOrderSchema } from './factory-order'

const specialFamilies = ['P13', 'P14', 'P18', 'P20'] as const
const itemSchema = z.object({
  id: z.string().min(1),
  payload: z.object({
    passage: z.string().min(1),
    item_type: z.string().min(1),
    question: z.string().min(1),
    choices: z.array(z.string().min(1)).min(2).max(5),
    evidence_primary: z.string().min(1),
    evidence_resource: z.string().min(1).optional(),
    resource_url: z.string().url().optional(),
    time_limit_seconds: z.number().int().positive().optional(),
  }).passthrough(),
  answer_key: z.object({ answer: z.number().int().min(1).max(5) }).passthrough(),
}).passthrough()

const esc = (value: string) => value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;')
  .replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&#39;')

/** Builds four synthetic layouts from a sealed order and reviewed item. External resource freshness is not checked here. */
export function renderSpecializedReadingUnit(input: {
  order: unknown
  passage: string
  grade: string
  items: unknown
}): string {
  const order = productOrderSchema.parse(input.order)
  if (!specialFamilies.includes(order.product_family as typeof specialFamilies[number]))
    throw new Error('SPECIALIZED_READING_FAMILY_UNSUPPORTED')
  if ((order.grade_detail_target ?? order.grade_target) !== input.grade)
    throw new Error('SPECIALIZED_READING_GRADE_MIXED')
  const items = z.array(itemSchema).min(1).parse(input.items)
  const kind = order.product_family === 'P14' ? 'data' : 'text'
  const resource = order.product_family === 'P18' ? null : order.target.resources.find(row => row.kind === kind)
  if (order.product_family !== 'P18' && !resource)
    throw new Error('SPECIALIZED_READING_RESOURCE_MISSING')
  if (resource && order.target.resources.filter(row => row.kind === kind).length !== 1)
    throw new Error('SPECIALIZED_READING_RESOURCE_AMBIGUOUS')
  const questions = items.map(item => {
    const payload = item.payload
    if (payload.passage !== input.passage || !input.passage.includes(payload.evidence_primary) ||
        !order.item_types.includes(payload.item_type) ||
        !PRODUCT_CAPABILITIES[order.product_family].items.includes(payload.item_type) ||
        item.answer_key.answer > payload.choices.length)
      throw new Error('SPECIALIZED_READING_ITEM_UNGROUNDED')
    if (resource) {
      if (payload.resource_url !== resource.canonical_url || !payload.evidence_resource ||
          !resource.content.includes(payload.evidence_resource) || payload.time_limit_seconds !== undefined)
        throw new Error('SPECIALIZED_READING_RESOURCE_UNGROUNDED')
    } else if (!payload.time_limit_seconds || payload.resource_url || payload.evidence_resource) {
      throw new Error('SPECIALIZED_READING_TIMER_MISSING')
    }
    return `<div class="q" data-item-id="${esc(item.id)}"><p class="stem">${esc(payload.question)}</p>` +
      `<ol class="choices">${payload.choices.map(choice => `<li>${esc(choice)}</li>`).join('')}</ol>` +
      (payload.time_limit_seconds ? `<p class="timelimit">${payload.time_limit_seconds}s</p>` : '') + '</div>'
  })
  const resourceHtml = resource ? `<aside class="given" data-source="${esc(resource.canonical_url)}">` +
    `<h3>${resource.kind === 'data' ? 'Source data' : 'Text B'}</h3><pre>${esc(resource.content)}</pre>` +
    `<p class="src">${esc(resource.attribution)}</p></aside>` : ''
  return `<section class="unit" data-family="${order.product_family}" data-grade="${esc(input.grade)}">` +
    `<h2>${esc(order.product_variant)}</h2><div class="passage">${esc(input.passage)}</div>` +
    resourceHtml + questions.join('') + '</section>'
}
