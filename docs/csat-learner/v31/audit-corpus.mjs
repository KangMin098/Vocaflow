// docs/csat-learner/v31/audit-corpus.mjs
// Committed-artifact structural audit only. Prints results; never changes files or reads a DB.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
const inquiry = read('apps/web/src/lib/csat/inquiry-data.json')
const compare = read('apps/web/src/lib/csat/compare-v3-data.json')
const catalog = new Map()
const dir = path.join(root, 'apps/web/src/lib/csat/skeleton-data')
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  for (const it of Array.isArray(d) ? d : d.items ?? []) catalog.set(it.id, it)
}
const records = Object.entries(inquiry.items)
const types = {}, keys = {}, scope = {}
let meanings = 0, linked = 0, missingIds = 0
for (const [id, r] of records) {
  const type = catalog.get(id)?.type_id ?? 'UNKNOWN'
  const t = types[type] ??= { items: 0, verified: 0, v3: 0, meanings: 0, choicesWithMeaningIds: 0 }
  t.items++; t.verified += r.review === 'verified' ? 1 : 0; t.v3 += r.v3 ? 1 : 0
  for (const m of r.v3?.meanings ?? []) {
    meanings++; t.meanings++
    for (const k of Object.keys(m)) keys[k] = (keys[k] ?? 0) + 1
    scope[m.scope.kind] = (scope[m.scope.kind] ?? 0) + 1
  }
  const mids = new Set(r.v3?.meanings.map((m) => m.id) ?? [])
  for (const c of r.v3?.choices ?? []) if (c.meaning_ids?.length) {
    linked++; t.choicesWithMeaningIds++
    missingIds += c.meaning_ids.filter((x) => !mids.has(x)).length
  }
}
console.log(JSON.stringify({
  basis: 'committed artifacts at main 521944f227c9cf5b957cb8b366fb27a6d81a3d42; NOT live DB counts or semantic certification',
  items: records.length, verified: records.filter(([, r]) => r.review === 'verified').length,
  v3: records.filter(([, r]) => r.v3).length, meanings, meaningFields: keys, scope,
  choicesWithMeaningIds: linked, missingMeaningReferences: missingIds, types,
  comparison: { pairs: Object.keys(compare.pairs).length, items: Object.keys(compare.items).length, principles: Object.values(compare.pairs).filter((x) => x.principle).length },
  proposedV31FieldsPresent: records.filter(([, r]) => r.readingSupport || r.v31 || r.v3?.readingSupport).length,
}, null, 2))
