// apps/web/src/lib/csat/dissect.ts
// Pure prediction/session rules. Passage text never belongs to this model.
import type { LearnerCatalog } from './session/catalog'
import type { CatalogItem } from './session/model'
import type { RevealAnchor } from './session/reveal'

export interface DissectionItem extends CatalogItem {
  answer: number
  topic: string
  format: string
  formula: string
  formulaTag: string
  wrapup: string
  intent: string
  intentOptions: string[]
  evidence: string
  distractor: { n: number; family: string; line: string }
  trapOptions: string[]
  skeleton: { sentences: number[]; anchors: (RevealAnchor & { spans?: { sentence: number; start: number; end: number }[] })[] }
  history: { id: string; topic: string; formula: string }[]
}
export interface DissectionCatalog extends LearnerCatalog {
  items: DissectionItem[]
  families: string[]
  audit: { total: number; fields: Record<string, number>; excluded: { id: string; missing: string[] }[] }
}
export interface Prediction { item: string; type: string; step: 1 | 2 | 3; hit: boolean; at: number; family?: string }
export interface DissectionDraft { phase: 'scan' | 'predict1' | 'compare1' | 'predict2' | 'compare2' | 'predict3' | 'compare3' | 'blueprint' | 'formula'; selection: string | null; answers: { step: number; hit: boolean; selection: string }[] }
export interface Formula { tag: string; text: string; type: string; sources: string[] }
export interface DissectionRecord {
  drafts?: Record<string, DissectionDraft>
  inspected?: string[]
  active?: { items: string[]; index: number; pairSeen: boolean; loci: Record<string, string> }
  version: 1
  seed: number
  onboarded: boolean
  predictions: Prediction[]
  formulas: Formula[]
  queue: { tag: string; source: string; due: number }[]
  completed: { id: string; at: number }[]
}
export function emptyDissectionRecord(seed: number): DissectionRecord {
  return { version: 1, seed, onboarded: false, predictions: [], formulas: [], queue: [], completed: [] }
}
export function hashTag(text: string): string {
  let h = 2166136261
  for (const c of text.normalize('NFC').trim()) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (h >>> 0).toString(36)
}
export function shuffled<T>(values: readonly T[], seed: number): T[] {
  const out = [...values]
  let state = seed >>> 0
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    const j = Math.floor((state / 4294967296) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
export function readyItem(i: DissectionItem): boolean {
  return i.answer >= 1 && i.answer <= 5 && Boolean(i.topic && i.format && i.formula && i.intent && i.evidence && i.wrapup) &&
    i.skeleton.anchors.some(a => a.id === 'answer' && a.sentences.length > 0) &&
    i.skeleton.anchors.some(a => a.id === `reject:${i.distractor.n}` && a.sentences.length > 0) &&
    i.trapOptions.length === 4 && new Set(i.trapOptions).size === 4 && i.trapOptions.includes(i.distractor.family) &&
    i.intentOptions.length === 3 && new Set(i.intentOptions).size === 3 && i.intentOptions.includes(i.intent) &&
    i.intentOptions.every(s => s.length >= i.intent.length * .8 && s.length <= i.intent.length * 1.2) && i.history.length > 0
}
export function composeDissection(catalog: DissectionCatalog, record: DissectionRecord, now: number, cached: string[] = [], tag?: string): DissectionItem[] {
  const pool = catalog.items.filter(readyItem)
  const types = [...new Set(pool.map(i => i.type_id))]
  const seen = new Map<string, Set<string>>()
  for (const p of record.predictions) if (p.family) {
    const set = seen.get(p.type) ?? new Set<string>(); set.add(p.family); seen.set(p.type, set)
  }
  const coverage = (type: string) => {
    const total = new Set(pool.filter(i => i.type_id === type).map(i => i.distractor.family))
    return [...total].filter(f => seen.get(type)?.has(f)).length / Math.max(1, total.size)
  }
  const due = record.queue.filter(q => q.due <= now).sort((a, b) => a.due - b.due)
  const last = (i: DissectionItem) => Math.max(0, ...record.completed.filter(c => c.id === i.id).map(c => c.at))
  types.sort((a, b) => coverage(a) - coverage(b) || a.localeCompare(b))
  for (const type of types) {
    const items = pool.filter(i => i.type_id === type).sort((a, b) =>
      last(a) - last(b) || Number(cached.includes(b.exam_id)) - Number(cached.includes(a.exam_id)) || b.exam_id.localeCompare(a.exam_id) || a.no - b.no)
    // Reserve a due sibling before picking the comparison pair; otherwise the pair can consume it.
    const reserved = due.flatMap(q => items.filter(i => i.formulaTag === q.tag && i.id !== q.source))[0]
    const available = items.filter(i => i.id !== reserved?.id)
    const candidates = tag ? available.filter(i => i.formulaTag === tag) : available
    for (const first of candidates) {
      for (const second of available.filter(i => i.id !== first.id && i.topic !== first.topic)) {
        const rest = items.filter(i => i.id !== first.id && i.id !== second.id)
        const transfer = reserved ?? rest[0]
        if (transfer) return [first, second, transfer]
      }
    }
  }
  return []
}
export function recordDecision(record: DissectionRecord, item: DissectionItem, decision: 'save' | 'unsure' | 'transfer', now: number, siblings: DissectionItem[]): DissectionRecord {
  const formulas = record.formulas.map(f => ({ ...f, sources: [...f.sources] }))
  if (decision === 'save') {
    const existing = formulas.find(f => f.tag === item.formulaTag)
    if (existing) existing.sources = [...new Set([...existing.sources, item.id])]
    else formulas.push({ tag: item.formulaTag, text: item.formula, type: item.type_id, sources: [item.id] })
  }
  let queue = record.queue.filter(q => !(q.tag === item.formulaTag && q.source !== item.id && q.due <= now))
  if (decision === 'unsure' && siblings.some(i => i.formulaTag === item.formulaTag && i.id !== item.id)) {
    queue = [...queue.filter(q => q.tag !== item.formulaTag), { tag: item.formulaTag, source: item.id, due: now + 3 * 86400000 }]
  }
  return { ...record, formulas, queue, completed: [...record.completed, { id: item.id, at: now }] }
}
export function predictionStats(record: DissectionRecord, families: string[]) {
  const recent = record.predictions.slice(-30)
  const seen = new Set(record.predictions.map(p => p.family).filter(Boolean))
  return { formulas: record.formulas.length, hit: recent.length ? Math.round(100 * recent.filter(p => p.hit).length / recent.length) : null, seen: families.filter(f => seen.has(f)).length, total: families.length }
}
