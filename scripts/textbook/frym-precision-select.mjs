// scripts/textbook/frym-precision-select.mjs
// Merge disjoint read-only origin manifests without hiding negatives or access holds.
import fs from 'node:fs'
import path from 'node:path'
import { researchBodyHash, researchOriginSchema } from '@vocaflow/library-pipeline/research-origin'
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? null : process.argv[i + 1] }
const files = process.argv.flatMap((value, i) => value === '--origins' ? [process.argv[i + 1]] : [])
const size = Number(arg('sample-size') ?? 20), expected = Number(arg('expected-count'))
const output = arg('output')
if (process.argv.includes('--commit')) throw new Error('Local selection has no --commit mode')
if (!files.length || !output || !Number.isInteger(size) || size < 20 || size > 50 || !Number.isInteger(expected) || expected < size)
  throw new Error('--origins <export.json> (repeatable) --expected-count <measured population> --sample-size <20..50> --output <new.json> required')
const manifests = files.map((file) => {
  const text = fs.readFileSync(file, 'utf8'), value = JSON.parse(text)
  if (value.version !== 1 || value.mode !== 'read_only' || !Array.isArray(value.rows)) throw new Error(`Not a read-only origin manifest: ${file}`)
  return { file, sha256: researchBodyHash(text), rows: value.rows }
})
const all = manifests.flatMap((m) => m.rows).sort((a, b) => a.source_id.localeCompare(b.source_id))
if (all.length !== expected || new Set(all.map((r) => r.id)).size !== all.length || new Set(all.map((r) => r.source_id)).size !== all.length)
  throw new Error('Population count disagrees or origin batches overlap; preserve all batches and resolve the scope')
const counts = {}
for (const row of all) {
  if (!['declared_original_source', 'no_explicit_original_source', 'original_source_without_doi', 'held'].includes(row.status)) throw new Error(`Unknown screening status: ${row.id}`)
  if (row.status !== 'held') {
    const origin = researchOriginSchema.parse(row.research_origin)
    if (row.status !== origin.status || row.source_hash !== origin.body_hash || row.source_url !== origin.student_url || row.source_id !== `frym-full:${origin.student_doi}`) throw new Error(`Origin identity mismatch: ${row.id}`)
  }
  counts[row.status] = (counts[row.status] ?? 0) + 1
}
const rows = all.filter((r) => r.status === 'declared_original_source').slice(0, size)
if (rows.length < size) throw new Error(`Only ${rows.length} declared pairs available; need ${size}. Do not invent missing pairs.`)
const screening = { population: all.length, selection: `first_${size}_declared_original_source_in_source_id_order`, counts, files: manifests.map(({ rows, ...manifest }) => manifest), rows: all.map(({ research_origin, ...row }) => ({ ...row, declared_dois: research_origin?.relations.map((r) => r.original_work_id) ?? [] })) }
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify({ version: 1, mode: 'read_only', rows, counts: { declared_original_source: rows.length }, screening }, null, 2)}\n`, { flag: 'wx' })
console.log(JSON.stringify({ selected_articles: rows.length, screening: counts, database_writes: 0, output }))
