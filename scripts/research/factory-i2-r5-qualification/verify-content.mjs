// scripts/research/factory-i2-r5-qualification/verify-content.mjs
// Read-only source identity helpers. Unsupported numeric JSON fails closed instead of guessing PostgreSQL text.
import { createHash } from 'node:crypto'
export const norm = s => s.toLowerCase().replace(/[^a-z]+/g, '')
export function jsonbText(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('Unsupported numeric choice field')
    return String(value)
  }
  if (Array.isArray(value)) return '[' + value.map(jsonbText).join(', ') + ']'
  if (typeof value !== 'object') throw new Error('Unsupported choice field')
  const keys = Object.keys(value).sort((a, b) => Buffer.byteLength(a) - Buffer.byteLength(b) || Buffer.compare(Buffer.from(a), Buffer.from(b)))
  return '{' + keys.map(k => JSON.stringify(k) + ': ' + jsonbText(value[k])).join(', ') + '}'
}
export function itemRevision(row) {
  if (row.choices == null) throw new Error('Missing choices')
  return createHash('sha256').update([row.stem ?? '', row.passage ?? '', jsonbText(row.choices), row.answer ?? ''].join('|')).digest('hex')
}
export function orderedChoices(pageText, passage, choices) {
  let normalized = ''; const positions = []
  for (let i = 0; i < pageText.length; i++) {
    const c = pageText[i].toLowerCase()
    if (/^[a-z]$/.test(c)) { normalized += c; positions.push(i) }
  }
  const p = norm(passage), start = normalized.indexOf(p)
  if (!p || start < 0 || choices.length !== 5) return { matched: false, matchedCount: 0 }
  const tail = pageText.slice(positions[start + p.length - 1] + 1)
  const marks = [...tail.matchAll(/[①②③④⑤]/g)].slice(0, 5)
  if (marks.map(m => m[0]).join('') !== '①②③④⑤') return { matched: false, matchedCount: 0 }
  let matchedCount = 0
  for (let i = 0; i < 5; i++) {
    let text = tail.slice(marks[i].index + 1, i < 4 ? marks[i + 1].index : undefined)
    if (i === 4) text = text.split(/\b\d{1,2}\.\s/)[0]
    if (norm(choices[i]) && norm(text) === norm(choices[i])) matchedCount++
  }
  return { matched: matchedCount === 5, matchedCount }
}
