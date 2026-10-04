// scripts/textbook/frym-pairs-export.mjs
// Read-only inspection of publisher-declared research origins. Never updates the corpus.
import fs from 'node:fs'
import path from 'node:path'
import { createScriptClient } from '../lib/supabase-client.mjs'
import { loadEnv } from './volume-pool.mjs'
import { fetchWithTimeout } from '../../packages/library-pipeline/src/ingest-article/_helpers.ts'
import { frymFullTextContainer, frymFullTextContent } from '../../packages/library-pipeline/src/ingest-article/frontiers-young-minds.ts'
import { extractFrymResearchOrigin, frymStudentDoi, researchBodyHash } from '@vocaflow/library-pipeline/research-origin'

const arg = (name) => {
  const index = process.argv.indexOf(`--${name}`)
  return index < 0 ? null : process.argv[index + 1]
}
if (process.argv.includes('--commit')) throw new Error('This command is read-only; --commit is not supported')
const limit = Number(arg('limit') ?? 3)
if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('--limit must be 1..100')
const output = arg('output')
if (!output || output.startsWith('--')) throw new Error('--output <new.json> is required')
if (fs.existsSync(output)) throw new Error(`Output already exists: ${output}`)
const idsFile = arg('ids-file')
const ids = idsFile ? [...new Set(fs.readFileSync(idsFile, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean))] : null
if (ids && (!ids.length || ids.length > 100 || ids.some((id) => !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))))
  throw new Error('--ids-file must contain 1..100 UUIDs')

loadEnv()
const db = createScriptClient()
let query = db.from('library_articles')
  .select('id,source_id,source_url,title,content,updated_at')
  .eq('source', 'frym').like('source_id', 'frym-full:%').is('adapted_from_id', null)
  .order('source_id').limit(limit)
if (ids) query = query.in('id', ids)
const { data, error } = await query
if (error) throw new Error(`FYM query failed: ${error.message}`)
if (!data?.length) throw new Error('No complete FYM originals matched this scope')
const rows = []
const counts = {}
for (const article of data) {
  let result
  try {
    // Validate before fetching: the DB URL cannot redirect this command to an unrelated host.
    if (!frymStudentDoi(article.source_url)) throw new Error('Unsupported FYM source URL')
    const page = await fetchWithTimeout(article.source_url, { accept: 'text/html' })
    if (!page.ok) throw new Error(`Page GET failed: ${page.status}`)
    if (frymStudentDoi(page.url) !== frymStudentDoi(article.source_url)) throw new Error('Page redirected to a different article')
    const html = await page.text()
    const body = frymFullTextContent(html)
    const origin = extractFrymResearchOrigin({ html, container: frymFullTextContainer(html), studentUrl: article.source_url, body, checkedAt: new Date().toISOString() })
    if (origin.body_hash !== researchBodyHash(article.content ?? '')) throw new Error('Page body differs from current DB original; preserve both and investigate')
    result = { status: origin.status, research_origin: origin }
  } catch (error) {
    result = { status: 'held', reason: error instanceof Error ? error.message : String(error) }
  }
  counts[result.status] = (counts[result.status] ?? 0) + 1
  rows.push({ id: article.id, source_id: article.source_id, source_url: article.source_url, title: article.title, source_revision: article.updated_at, source_hash: researchBodyHash(article.content ?? ''), ...result })
}
// Re-query the exported scope after network I/O. Never present old rows as current evidence.
const latest = await db.from('library_articles').select('id,content,updated_at,source_url').in('id', rows.map((r) => r.id))
if (latest.error) throw new Error(`FYM revision recheck failed: ${latest.error.message}`)
for (const row of rows) {
  const current = latest.data?.find((r) => r.id === row.id)
  if (!current || current.updated_at !== row.source_revision || current.source_url !== row.source_url || researchBodyHash(current.content ?? '') !== row.source_hash)
    throw new Error(`Source changed during export: ${row.id}; rerun with a new output path`)
}
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify({ version: 1, mode: 'read_only', rows, counts }, null, 2)}\n`, { flag: 'wx' })
console.log(JSON.stringify({ output, scanned: rows.length, counts, database_writes: 0 }))
