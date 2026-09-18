// scripts/textbook/source-policy-import.mjs
import { isDeepStrictEqual } from 'node:util'

// PostgreSQL revisions have microseconds; Date.parse alone silently loses them.
function timestamp(value, label) {
  const match = typeof value === 'string' && value.match(/^(\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?(Z|[+-]\d\d:\d\d)$/)
  const seconds = match && Date.parse(`${match[1]}${match[3]}`)
  if (!match || !Number.isFinite(seconds)) throw new Error(`Invalid ${label}`)
  return BigInt(seconds) * 1000n + BigInt((match[2] ?? '').padEnd(6, '0'))
}

export function preflightSourcePolicyBatch(rows, sources, previous, now = Date.now()) {
  if (!rows.length || rows.length > 500) throw new Error('Import batch must contain 1..500 rows')
  const current = new Map(sources.map(row => [row.id, row]))
  const before = new Map(previous.map(row => [row.article_id, row]))
  const ids = new Set()
  for (const row of rows) {
    if (ids.has(row.article_id)) throw new Error(`Duplicate projection: ${row.article_id}`)
    ids.add(row.article_id)
    const revision = timestamp(row.source_updated_at, 'source revision')
    const measured = timestamp(row.measured_at, 'measurement timestamp')
    const nowMicros = BigInt(now) * 1000n
    if (nowMicros - measured > 86400000000n) throw new Error('Projection older than 24 hours; re-audit')
    if (measured > nowMicros + 300000000n) throw new Error('Projection measurement is in the future')
    const source = current.get(row.article_id)
    if (!source || revision !== timestamp(source.updated_at, 'current source revision')) {
      throw new Error(`Source revision changed or missing: ${row.article_id}; re-audit`)
    }
    const old = before.get(row.article_id)
    if (old && revision === timestamp(old.source_updated_at, 'cached source revision') &&
      measured < timestamp(old.measured_at, 'cached measurement timestamp')) {
      throw new Error(`Newer cache measurement exists: ${row.article_id}; re-audit`)
    }
  }
  return rows.filter(row => {
    const old = before.get(row.article_id)
    return !old || Object.keys(row).some(key => {
      if (key === 'source_updated_at' || key === 'measured_at') {
        return timestamp(old[key], `cached ${key}`) !== timestamp(row[key], key)
      }
      return !isDeepStrictEqual(old[key], row[key])
    })
  })
}

/** Read and validate the whole batch before backup/write, including mixed 500-row batches.
 * The database freshness trigger must also enforce these checks atomically at write time.
 * Callbacks keep local regression tests independent of credentials or database mutations.
 */
export async function importSourcePolicyBatch({ rows, readSources, readPrevious, backup, write, now = Date.now() }) {
  const sources = []
  const previous = []
  for (let offset = 0; offset < rows.length; offset += 100) {
    const ids = rows.slice(offset, offset + 100).map(row => row.article_id)
    const [sourcePart, previousPart] = await Promise.all([readSources(ids), readPrevious(ids)])
    sources.push(...sourcePart)
    previous.push(...previousPart)
  }
  const changed = preflightSourcePolicyBatch(rows, sources, previous, now)
  const existingIds = new Set(previous.map(row => row.article_id))
  await backup({ previous, insertedIds: changed.filter(row => !existingIds.has(row.article_id)).map(row => row.article_id) })
  if (changed.length) {
    const verified = await write(changed)
    const returned = new Map(verified.map(row => [row.article_id, row]))
    if (returned.size !== changed.length || changed.some(row => {
      const actual = returned.get(row.article_id)
      return !actual || Object.keys(row).some(key => {
        if (key === 'source_updated_at' || key === 'measured_at') {
          return timestamp(actual[key], `written ${key}`) !== timestamp(row[key], key)
        }
        return !isDeepStrictEqual(actual[key], row[key])
      })
    })) throw new Error('Batch verification failed')
  }
  return { requested: rows.length, changed: changed.length, verified: rows.length }
}
