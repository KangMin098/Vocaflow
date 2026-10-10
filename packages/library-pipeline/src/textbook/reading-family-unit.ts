// packages/library-pipeline/src/textbook/reading-family-unit.ts
import { z } from 'zod'
import { PRODUCT_CAPABILITIES, productOrderSchema } from './factory-order'

const readingFamilies = [
  'P01', 'P02', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09',
  'P10', 'P11', 'P12', 'P15', 'P16', 'P17', 'P19',
] as const
const focusedFamilies = new Set(['P05', 'P06', 'P19'])
const pairedFamilies = new Set(['P08', 'P09', 'P10', 'P12'])
const itemSchema = z.object({
  id: z.string().trim().min(1),
  payload: z.object({
    passage: z.string().min(1), item_type: z.string().min(1), question: z.string().min(1),
    choices: z.array(z.string().min(1)).min(2).max(5), evidence_primary: z.string().trim().min(1),
    evidence_secondary: z.string().trim().min(1).optional(), focus_text: z.string().trim().min(1).optional(),
  }).passthrough(),
  answer_key: z.object({ answer: z.number().int().min(1).max(5) }).passthrough(),
}).passthrough()
const esc = (text: string) => text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;')
  .replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&#39;')
const exactSpan = (passage: string, quote: string) => {
  const start = passage.indexOf(quote)
  return start >= 0 && start === passage.lastIndexOf(quote) ? { start, end: start + quote.length } : null
}
const tokenBoundFocus = (quote: string, focus: string) => {
  const escaped = focus.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(quote)
}

/** Synthetic reading-family unit built only from a sealed order and reviewed item payloads. */
export function renderReadingFamilyUnit(input: { order: unknown; grade: string; passage: string; items: unknown }): string {
  const order = productOrderSchema.parse(input.order)
  if (!readingFamilies.includes(order.product_family as typeof readingFamilies[number]))
    throw Error('READING_FAMILY_UNSUPPORTED')
  if ((order.grade_detail_target ?? order.grade_target) !== input.grade)
    throw Error('READING_FAMILY_GRADE_MIXED')
  if (!input.passage.trim() || order.target.resources.length)
    throw Error('READING_FAMILY_RESOURCE_OR_PASSAGE_UNSUPPORTED')
  const items = z.array(itemSchema).min(1).parse(input.items)
  if (new Set(items.map(item => item.id)).size !== items.length) throw Error('READING_FAMILY_ITEM_DUPLICATE')
  const questions = items.map(item => {
    const payload = item.payload
    const primary = exactSpan(input.passage, payload.evidence_primary)
    if (payload.passage !== input.passage || !order.item_types.includes(payload.item_type) ||
      !PRODUCT_CAPABILITIES[order.product_family].items.includes(payload.item_type) ||
      !primary || item.answer_key.answer > payload.choices.length)
      throw Error('READING_FAMILY_ITEM_UNGROUNDED')
    if (focusedFamilies.has(order.product_family) &&
      (!payload.focus_text || !tokenBoundFocus(payload.evidence_primary, payload.focus_text)))
      throw Error('READING_FAMILY_FOCUS_UNGROUNDED')
    const secondary = payload.evidence_secondary ? exactSpan(input.passage, payload.evidence_secondary) : null
    if (pairedFamilies.has(order.product_family) &&
      (!secondary || secondary.start < primary.end && primary.start < secondary.end))
      throw Error('READING_FAMILY_SECONDARY_EVIDENCE_MISSING')
    if (payload.evidence_secondary && !secondary)
      throw Error('READING_FAMILY_SECONDARY_EVIDENCE_UNGROUNDED')
    return `<div class="q" data-item-id="${esc(item.id)}" data-item-type="${esc(payload.item_type)}">` +
      `<p class="stem">${esc(payload.question)}</p><ol class="choices">` +
      payload.choices.map(choice => `<li>${esc(choice)}</li>`).join('') + '</ol></div>'
  })
  return `<section class="unit" data-family="${order.product_family}" data-grade="${esc(input.grade)}">` +
    `<h2>${esc(order.product_variant)}</h2><div class="passage">${esc(input.passage)}</div>` +
    questions.join('') + '</section>'
}
