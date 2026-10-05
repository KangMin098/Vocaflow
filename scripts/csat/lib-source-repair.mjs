// scripts/csat/lib-source-repair.mjs
import crypto from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'

const FIELDS = new Set(['passage', 'choices', 'stem'])
export const sourceDigest = value => crypto.createHash('sha256').update(value).digest('hex')
export const completeSource = item => [item.stem,item.passage].every(v=>typeof v==='string'&&v.trim()) &&
  Array.isArray(item.choices) && item.choices.length===5 && item.choices.every(v=>typeof v==='string'&&v.trim())

/** Retain the first parser input when a later inspection repairs another field. */
export function mergeSourceRepair(previous, repair) {
  if (!previous) return repair
  if (previous.item_id !== repair.item_id || previous.pdf_sha256 !== repair.pdf_sha256 || previous.pdf_file !== repair.pdf_file) throw new Error(`${repair.item_id}: 기존 수리와 정본이 다르다 — 재대조 필요`)
  const before = {...previous.before}, after = {...previous.after}
  for (const field of Object.keys(repair.after)) {
    if (Object.hasOwn(after, field) && !isDeepStrictEqual(repair.before[field], after[field]) && !isDeepStrictEqual(repair.after[field], after[field])) throw new Error(`${repair.item_id}: 수리 이력이 이어지지 않는다`)
    if (!Object.hasOwn(before, field)) before[field] = repair.before[field]
    after[field] = repair.after[field]
  }
  return {...previous, ...repair, before, after}
}

/** Apply an inspected PDF transcription only to its exact old or already repaired input. */
export function applySourceRepair(item, repair, pdfBytes) {
  if (item.id !== repair.item_id) throw new Error('원문 수리 문항 ID 불일치')
  if (!/^[a-f0-9]{64}$/.test(repair.pdf_sha256 ?? '') || sourceDigest(pdfBytes) !== repair.pdf_sha256) throw new Error(`${item.id}: PDF 정본 해시 불일치`)
  const fields = Object.keys(repair.after ?? {})
  if (!fields.length || fields.some(field => !FIELDS.has(field)) || !isDeepStrictEqual(Object.keys(repair.before ?? {}).sort(), fields.slice().sort())) throw new Error(`${item.id}: 수리는 passage/choices/stem의 동일 필드 사전·사후 값만 받는다`)
  // A parser upgrade can repair one approved field while another still needs the transcription.
  const approved = fields.every(field => isDeepStrictEqual(item[field] ?? null, repair.after[field]) || isDeepStrictEqual(item[field] ?? null, repair.before[field]))
  if (!approved) throw new Error(`${item.id}: 수리 전후 어디에도 맞지 않는 원문 — 재대조 필요`)
  if (fields.includes('passage') && (typeof repair.after.passage !== 'string' || !repair.after.passage.trim())) throw new Error(`${item.id}: 빈 지문 수리 금지`)
  if (fields.includes('stem') && (typeof repair.after.stem !== 'string' || !repair.after.stem.trim())) throw new Error(`${item.id}: 빈 발문 수리 금지`)
  if (fields.includes('choices') && (!Array.isArray(repair.after.choices) || repair.after.choices.length !== 5 || repair.after.choices.some(choice => typeof choice !== 'string' || !choice.trim()))) throw new Error(`${item.id}: 선지 5개가 모두 필요하다`)
  return {...item, ...repair.after}
}
