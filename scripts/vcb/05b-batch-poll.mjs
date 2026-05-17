#!/usr/bin/env node
/**
 * VCB Step 5b — Poll a submitted Anthropic Message Batch, fetch results when
 * done, and write the enriched JSONL in our schema.
 *
 * Usage:
 *   node scripts/vcb/05b-batch-poll.mjs --pending-file <path>
 *     [--watch]                      (poll every 60s until ended)
 *     [--interval-sec N]             (poll interval; default 60)
 *     [--force]                      (overwrite existing enriched file)
 *
 * Reads the .batch.json sidecar to find batch_id. Writes:
 *   <base>-enriched<suffix>.jsonl       enriched results (LF, no BOM)
 *   <base>-enriched<suffix>.batch.log   per-batch log (counts + errors)
 *   updates <base>-pending<suffix>.batch.json with final status
 *
 * Requires ANTHROPIC_API_KEY in env.
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    'pending-file': { type: 'string' },
    'watch': { type: 'boolean', default: false },
    'interval-sec': { type: 'string', default: '60' },
    'force': { type: 'boolean', default: false },
  },
})

const pendingFile = values['pending-file']
const watch = values['watch']
const intervalSec = Math.max(5, parseInt(values['interval-sec'], 10))
const force = values['force']

if (!pendingFile) {
  console.error('--pending-file is required')
  process.exit(2)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY env var not set')
  process.exit(2)
}

const sidecar = pendingFile.replace(/\.jsonl$/, '.batch.json')
if (!fs.existsSync(sidecar)) {
  console.error(`sidecar not found: ${path.basename(sidecar)}`)
  console.error('run 05b-batch-submit.mjs first')
  process.exit(2)
}
const sidecarData = JSON.parse(fs.readFileSync(sidecar, 'utf8'))
const batchId = sidecarData.batch_id
if (!batchId) {
  console.error(`sidecar missing batch_id: ${sidecar}`)
  process.exit(2)
}

const enrichedFile = pendingFile.replace(
  /-pending(-\d+of\d+)?\.jsonl$/,
  (_m, suffix) => `-enriched${suffix ?? ''}.jsonl`,
)
const logFile = enrichedFile.replace(/\.jsonl$/, '.batch.log')

if (fs.existsSync(enrichedFile) && !force) {
  console.error(`enriched file already exists: ${path.basename(enrichedFile)}`)
  console.error('use --force to overwrite')
  process.exit(3)
}

const client = new Anthropic()

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

let batch
while (true) {
  batch = await client.messages.batches.retrieve(batchId)
  const elapsedSec = Math.round(
    (Date.now() - new Date(sidecarData.submitted_at).getTime()) / 1000,
  )
  console.log(JSON.stringify({
    batch_id: batchId,
    status: batch.processing_status,
    counts: batch.request_counts,
    elapsed_sec: elapsedSec,
  }))
  if (batch.processing_status === 'ended') break
  if (!watch) {
    console.log('(use --watch to poll until done)')
    process.exit(0)
  }
  await sleep(intervalSec * 1000)
}

console.log('fetching results...')
const lines = []
let succeeded = 0
let skipped = 0
let errored = 0
let malformed = 0
const errors = []

function extractText(message) {
  if (!message?.content) return null
  for (const block of message.content) {
    if (block.type === 'text' && typeof block.text === 'string') {
      return block.text
    }
  }
  return null
}

function tryParseJson(raw) {
  let txt = raw.trim()
  if (txt.startsWith('```')) {
    txt = txt.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  return JSON.parse(txt)
}

for await (const result of await client.messages.batches.results(batchId)) {
  const customId = result.custom_id
  const queueId = parseInt(customId.replace(/^queue-/, ''), 10)
  const r = result.result
  if (r.type === 'succeeded') {
    const text = extractText(r.message)
    if (!text) {
      errors.push({ custom_id: customId, error: 'no text block in response' })
      errored += 1
      continue
    }
    let parsed
    try { parsed = tryParseJson(text) }
    catch (e) {
      errors.push({ custom_id: customId, error: `JSON parse: ${e.message}`, preview: text.slice(0, 200) })
      malformed += 1
      continue
    }
    if (parsed.queue_id !== queueId) {
      errors.push({ custom_id: customId, error: `queue_id mismatch: expected ${queueId}, got ${parsed.queue_id}` })
      malformed += 1
      continue
    }
    if (parsed.skip === true) skipped += 1
    else succeeded += 1
    lines.push(JSON.stringify(parsed))
  } else if (r.type === 'errored') {
    errors.push({ custom_id: customId, error: r.error?.message ?? 'unknown error', type: r.error?.type })
    errored += 1
  } else if (r.type === 'expired') {
    errors.push({ custom_id: customId, error: 'expired (24h timeout)' })
    errored += 1
  } else if (r.type === 'canceled') {
    errors.push({ custom_id: customId, error: 'canceled' })
    errored += 1
  } else {
    errors.push({ custom_id: customId, error: `unexpected result type: ${r.type}` })
    errored += 1
  }
}

fs.writeFileSync(enrichedFile, lines.join('\n') + '\n', { encoding: 'utf8' })

const report = {
  batch_id: batchId,
  request_counts: batch.request_counts,
  succeeded,
  skipped,
  errored,
  malformed,
  total: lines.length,
  errors: errors.slice(0, 100),
  errors_truncated: errors.length > 100,
}
fs.writeFileSync(logFile, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8' })

sidecarData.processing_status = batch.processing_status
sidecarData.completed_at = new Date().toISOString()
sidecarData.succeeded = succeeded
sidecarData.skipped = skipped
sidecarData.errored = errored
sidecarData.malformed = malformed
fs.writeFileSync(sidecar, JSON.stringify(sidecarData, null, 2) + '\n', { encoding: 'utf8' })

console.log(JSON.stringify({
  ok: errored === 0 && malformed === 0,
  enriched_file: path.basename(enrichedFile),
  log_file: path.basename(logFile),
  succeeded, skipped, errored, malformed,
  total: lines.length,
  next: `node scripts/vcb/05c-validate-output.mjs ${enrichedFile}`,
}, null, 2))

process.exit(errored === 0 && malformed === 0 ? 0 : 1)
