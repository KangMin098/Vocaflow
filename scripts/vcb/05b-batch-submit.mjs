#!/usr/bin/env node
/**
 * VCB Step 5b — Submit a batch of enrichment requests via Anthropic Message
 * Batches API. Each request gets the same cached system prompt + one lemma in
 * the user message. Result: 50% batch discount + prompt-cache reads on the
 * system prefix (when prefix >= 4096 tokens on Opus 4.7).
 *
 * Usage:
 *   node scripts/vcb/05b-batch-submit.mjs --pending-file <path>
 *     [--effort low|medium|high|xhigh|max]   (default: medium)
 *     [--max-tokens N]                       (default: 3000)
 *     [--dry-run]                            (build requests, don't submit)
 *     [--force]                              (overwrite existing sidecar)
 *
 * Output:
 *   <pending-basename>.batch.json   sidecar with batch_id + metadata
 *
 * Requires ANTHROPIC_API_KEY in env.
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SYSTEM_PROMPT_PATH = path.join(__dirname, 'data', 'enrich-system-prompt.md')
const MODEL = 'claude-opus-4-7'

const { values } = parseArgs({
  options: {
    'pending-file': { type: 'string' },
    'effort': { type: 'string', default: 'medium' },
    'max-tokens': { type: 'string', default: '3000' },
    'dry-run': { type: 'boolean', default: false },
    'force': { type: 'boolean', default: false },
  },
})

const pendingFile = values['pending-file']
const effort = values['effort']
const maxTokens = parseInt(values['max-tokens'], 10)
const dryRun = values['dry-run']
const force = values['force']

if (!pendingFile) {
  console.error('--pending-file is required')
  process.exit(2)
}
if (!fs.existsSync(pendingFile)) {
  console.error(`pending file not found: ${pendingFile}`)
  process.exit(2)
}
if (!fs.existsSync(SYSTEM_PROMPT_PATH)) {
  console.error(`system prompt not found: ${SYSTEM_PROMPT_PATH}`)
  process.exit(2)
}
if (!['low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) {
  console.error(`invalid --effort: ${effort}`)
  process.exit(2)
}
if (!process.env.ANTHROPIC_API_KEY && !dryRun) {
  console.error('ANTHROPIC_API_KEY env var not set')
  console.error('Get a key at https://console.anthropic.com/settings/keys')
  console.error('Then: $env:ANTHROPIC_API_KEY = "sk-ant-..."  (PowerShell)')
  console.error('  or: export ANTHROPIC_API_KEY=sk-ant-...    (bash)')
  process.exit(2)
}

const sidecar = pendingFile.replace(/\.jsonl$/, '.batch.json')
if (fs.existsSync(sidecar) && !force) {
  const existing = JSON.parse(fs.readFileSync(sidecar, 'utf8'))
  console.error(`batch sidecar already exists: ${path.basename(sidecar)}`)
  console.error(`  batch_id: ${existing.batch_id}`)
  console.error(`  submitted_at: ${existing.submitted_at}`)
  console.error(`  status: ${existing.processing_status}`)
  console.error('  use --force to resubmit (LLM cost will be incurred again)')
  process.exit(3)
}

const systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8')

const text = fs.readFileSync(pendingFile, 'utf8')
const items = text
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((l, i) => {
    try { return JSON.parse(l) }
    catch (e) { throw new Error(`pending line ${i + 1}: ${e.message}`) }
  })

console.log(`parsed ${items.length} lemmas from ${path.basename(pendingFile)}`)
console.log(`model: ${MODEL}, effort: ${effort}, max_tokens: ${maxTokens}`)

const requests = items.map((item) => ({
  custom_id: `queue-${item.queue_id}`,
  params: {
    model: MODEL,
    max_tokens: maxTokens,
    output_config: { effort },
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Enrich this lemma. Output one JSON object only.\n\n${JSON.stringify(item)}`,
      },
    ],
  },
}))

if (dryRun) {
  console.log('--dry-run: not submitting.')
  console.log(`would submit ${requests.length} requests`)
  console.log('--- first request preview ---')
  console.log(JSON.stringify(requests[0], null, 2).slice(0, 2000))
  process.exit(0)
}

const client = new Anthropic()
const batch = await client.messages.batches.create({ requests })

const submittedAt = new Date().toISOString()
const sidecarData = {
  batch_id: batch.id,
  pending_file: path.basename(pendingFile),
  model: MODEL,
  effort,
  max_tokens: maxTokens,
  request_count: requests.length,
  submitted_at: submittedAt,
  processing_status: batch.processing_status,
}
fs.writeFileSync(sidecar, JSON.stringify(sidecarData, null, 2) + '\n', { encoding: 'utf8' })

console.log(JSON.stringify({
  ok: true,
  batch_id: batch.id,
  request_count: requests.length,
  processing_status: batch.processing_status,
  sidecar: path.basename(sidecar),
  next: `node scripts/vcb/05b-batch-poll.mjs --pending-file ${path.basename(pendingFile)} --watch`,
}, null, 2))
