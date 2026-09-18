// scripts/textbook/source-policy-refresh.mjs
// Default: read-only full audit + local JSONL projection. Never rewrites source text.
// pnpm exec tsx scripts/textbook/source-policy-refresh.mjs --item-counts <json>
// After migration approval/checkpoint: --commit <jsonl> --limit 100 [--offset 0]
// Verified full import: --commit <jsonl> --all (500-row batches with backups).
// Narrow quality rules: --refresh-quality-from <before.jsonl> --output <after.jsonl>.
import fs from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { createInterface } from 'node:readline'
import { createScriptClient } from '../lib/supabase-client.mjs'
import { evaluateSource, ELIGIBILITY_SPEC_VERSION } from '../../packages/library-pipeline/src/textbook/source-eligibility.ts'
import { SOURCE_POLICY_SELECT, sourceEligibilityInput } from '../../packages/library-pipeline/src/textbook/source-eligibility-row.ts'
import { allDefects } from '../../packages/library-pipeline/src/textbook/extraction-defect.ts'
import { splitSentences } from '../csat/lib-fit.mjs'
import { importSourcePolicyBatch } from './source-policy-import.mjs'

const arg = name => { const n = process.argv.indexOf(`--${name}`); return n < 0 ? null : process.argv[n + 1] }
for (const line of fs.readFileSync('apps/web/.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const db = createScriptClient({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY })
const check = r => { if (r.error) throw new Error(r.error.message); return r.data }
const output = arg('output') ?? '.agent-logs/csat-source-policy.jsonl'
const commit = arg('commit')
const refreshQuality = arg('refresh-quality-from')
if (refreshQuality) {
  if (path.resolve(refreshQuality) === path.resolve(output)) throw new Error('Preserve the before file; use a different --output')
  fs.writeFileSync(output, '')
  let batch = []; let checked = 0; let changed = 0
  async function flush() {
    const affected = batch.filter(row => row.quality_flags.some(x => ['html-attr','wiki-markup','dup-paragraph','dropped-math'].includes(x)))
    if (affected.length) {
      const rows = check(await db.from('library_articles').select('id,source,content,updated_at').in('id', affected.map(x => x.article_id)))
      if (rows.length !== affected.length) throw new Error('Missing source during quality recheck')
      for (const r of rows) {
        const old = affected.find(x => x.article_id === r.id)
        if (Date.parse(old.source_updated_at) !== Date.parse(r.updated_at)) throw new Error(`Source revision changed: ${r.id}; run full refresh`)
        const flags = allDefects(r.content ?? '').map(x => x.id)
        if (r.source === 'voa' && (r.content ?? '').includes('We have a new comment system')) flags.push('voa-comment-system')
        checked++
        if (!isDeepStrictEqual(flags, old.quality_flags)) { old.quality_flags = flags; old.measured_at = new Date().toISOString(); changed++ }
      }
    }
    fs.appendFileSync(output, batch.map(x => JSON.stringify(x)).join('\n') + '\n')
    batch = []
  }
  for await (const line of createInterface({ input: fs.createReadStream(refreshQuality), crlfDelay: Infinity })) {
    if (!line.trim()) continue
    batch.push(JSON.parse(line))
    if (batch.length === 100) await flush()
  }
  if (batch.length) await flush()
  console.log(JSON.stringify({ checked, changed, output }))
} else if (commit) {
  const all = process.argv.includes('--all')
  const limit = Number(arg('limit'))
  const offset = Number(arg('offset') ?? 0)
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !Number.isInteger(offset) || offset < 0) throw new Error('Explicit --limit 1..500 and nonnegative --offset required')
  let rows = []; let index = 0; let processed = 0
  async function writeBatch(rows, batchOffset) {
    const backup = `${commit}.batch-${batchOffset}-${Date.now()}.before.json`
    const result = await importSourcePolicyBatch({
      rows,
      readSources: async ids => check(await db.from('library_articles').select('id,updated_at').in('id', ids)),
      readPrevious: async ids => check(await db.from('csat_source_eligibility').select('*').in('article_id', ids)),
      backup: before => fs.writeFileSync(backup, JSON.stringify(before, null, 2)),
      write: async changed => check(await db.from('csat_source_eligibility').upsert(changed, { onConflict: 'article_id' }).select('*')),
    })
    console.log(JSON.stringify({ offset: batchOffset, ...result, backup, nextOffset: batchOffset + rows.length }))
  }
  for await (const line of createInterface({ input: fs.createReadStream(commit), crlfDelay: Infinity })) {
    if (!line.trim()) continue
    if (index++ < offset) continue
    const row = JSON.parse(line)
    if (row.policy_version !== ELIGIBILITY_SPEC_VERSION || !isDeepStrictEqual(row.result, evaluateSource(row.input))) throw new Error('Projection does not match canonical policy')
    rows.push(row)
    if (rows.length === limit) {
      await writeBatch(rows, offset + processed)
      processed += rows.length; rows = []
      if (!all) break
    }
  }
  if (rows.length) { await writeBatch(rows, offset + processed); processed += rows.length }
  if (!processed) throw new Error('No rows in the requested batch')
} else {
  const countFile = arg('item-counts')
  if (!countFile) throw new Error('--item-counts is required: fresh SQL GROUP BY ref_id for kind=article')
  const counts = new Map(JSON.parse(fs.readFileSync(countFile, 'utf8')).map(x => [x.ref_id, x.items]))
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, '')
  const summary = { startedAt: new Date().toISOString(), completedAt: null, policyVersion: ELIGIBILITY_SPEC_VERSION,
    scanned: 0, grades: {}, blockers: {}, quality: {}, excerpts: {}, sourceQuality: {}, samples: {}, unjudged: {}, linkedByBlocker: {} }
  let cursor = null
  for (;;) {
    let query = db.from('library_articles').select(`${SOURCE_POLICY_SELECT},source,updated_at,content,make:csat_fit->make`)
      .in('status', ['ready', 'published']).order('id').limit(200)
    if (cursor) query = query.gt('id', cursor)
    const rows = check(await query)
    if (!rows.length) break
    const lines = []
    for (const row of rows) {
      const input = sourceEligibilityInput(row, counts.has(row.id))
      const result = evaluateSource(input)
      const body = row.content ?? ''
      const defects = allDefects(body)
      if (row.source === 'voa' && body.includes('We have a new comment system')) defects.push({ id: 'voa-comment-system', evidence: 'We have a new comment system' })
      const windows = Array.isArray(row.windows) ? row.windows : []
      const sentences = windows.length ? splitSentences(body).length : 0
      // windowsOf uses slice(s,e): e is exclusive and may equal sentence count.
      const invalid = windows.filter(w => !Number.isInteger(w.s) || !Number.isInteger(w.e) || w.s < 0 || w.e <= w.s || w.e > sentences).length
      const excerpt = { windows: windows.length, invalidRanges: invalid, currentSentences: sentences,
        recordedSentences: row.make?.sents ?? null, contentRevisionRecorded: false, approved: false }
      const projected = { article_id: row.id, source: row.source, source_updated_at: row.updated_at,
        policy_version: ELIGIBILITY_SPEC_VERSION, input, result, quality_flags: defects.map(x => x.id),
        excerpt_evidence: excerpt, linked_items: counts.get(row.id) ?? 0, measured_at: new Date().toISOString() }
      lines.push(JSON.stringify(projected))
      summary.scanned++
      summary.grades[result.grade] = (summary.grades[result.grade] ?? 0) + 1
      summary.excerpts[result.excerptStatus] = (summary.excerpts[result.excerptStatus] ?? 0) + 1
      for (const reason of result.blockers) {
        summary.blockers[reason] = (summary.blockers[reason] ?? 0) + 1
        summary.linkedByBlocker[reason] = (summary.linkedByBlocker[reason] ?? 0) + projected.linked_items
      }
      if (result.contentStatus === 'unjudged') {
        const cause = row.gate?.purpose === 'raw' ? 'raw_extraction_required' : row.gate?.by === 'rule' ? 'rule_only_content_review_required' : !row.gate ? 'gate_missing' : 'review_not_recorded'
        const k = `${cause}/${row.source}`
        summary.unjudged[k] = (summary.unjudged[k] ?? 0) + 1
      }
      for (const d of defects) {
        summary.quality[d.id] = (summary.quality[d.id] ?? 0) + 1
        const key = `${d.id}/${row.source}`
        summary.sourceQuality[key] = (summary.sourceQuality[key] ?? 0) + 1
        const samples = summary.samples[key] ??= []
        if (samples.length < 3) {
          const pos = body.indexOf(d.evidence)
          samples.push({ id: row.id, title: row.title, evidence: d.evidence,
            context: pos < 0 ? body.slice(0, 700) : body.slice(Math.max(0, pos - 200), pos + 500), verdict: 'unreviewed' })
        }
      }
    }
    fs.appendFileSync(output, lines.join('\n') + '\n')
    cursor = rows.at(-1).id
    process.stderr.write(`source policy ${summary.scanned}\n`)
    if (rows.length < 200) break
  }
  summary.completedAt = new Date().toISOString()
  fs.writeFileSync(`${output}.summary.json`, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify({ scanned: summary.scanned, grades: summary.grades, quality: summary.quality, output }))
}
