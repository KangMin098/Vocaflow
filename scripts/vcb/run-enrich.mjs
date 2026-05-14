#!/usr/bin/env node
/**
 * VCB Step 5 — Detached runner for /vcb-enrich.
 *
 * Mirrors scripts/vcb/run-seed-list.mjs. Spawned by Server Action
 * `runEnrichmentCommand`. Reads the slash command body, inlines it,
 * pipes the pending JSONL contents via stdin to claude -p, and captures
 * everything to the log file.
 *
 * Why a separate Node script:
 * - claude -p does NOT resolve slash commands — we inline the .md body
 * - Windows detached + stdio:'ignore' + shell redirect loses errors;
 *   doing redirect inside Node here gives reliable capture.
 *
 * Usage:
 *   node scripts/vcb/run-enrich.mjs \
 *     --slash-command .claude/commands/vcb-enrich.md \
 *     --pending-file <path> \
 *     --enriched-file <path> \
 *     --log-file <path> \
 *     --marker-file <path> \
 *     --model <opus|sonnet|haiku> \
 *     --budget-usd <number>
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    'slash-command': { type: 'string' },
    'pending-file': { type: 'string' },
    'enriched-file': { type: 'string' },
    'log-file': { type: 'string' },
    'marker-file': { type: 'string' },
    'model': { type: 'string', default: 'sonnet' },
    'budget-usd': { type: 'string', default: '10' },
  },
})

const slashCommandPath = values['slash-command']
const pendingFile = values['pending-file']
const enrichedFile = values['enriched-file']
const logFile = values['log-file']
const markerFile = values['marker-file']
const model = values['model'] ?? 'sonnet'
const budget = values['budget-usd'] ?? '10'

if (!slashCommandPath || !pendingFile || !enrichedFile || !logFile) {
  console.error('--slash-command, --pending-file, --enriched-file, --log-file are required')
  process.exit(2)
}

function appendLog(msg) {
  fs.appendFileSync(logFile, msg.endsWith('\n') ? msg : msg + '\n', 'utf8')
}

function clearMarker() {
  if (!markerFile) return
  try { fs.unlinkSync(markerFile) } catch { /* ignore */ }
}

appendLog(`[run-enrich ${new Date().toISOString()}] starting`)
appendLog(`slash_command=${slashCommandPath}`)
appendLog(`pending=${pendingFile}`)
appendLog(`enriched=${enrichedFile}`)
appendLog(`model=${model} budget=${budget}`)

if (!fs.existsSync(slashCommandPath)) {
  appendLog(`[error] slash command file not found: ${slashCommandPath}`)
  clearMarker()
  process.exit(2)
}
if (!fs.existsSync(pendingFile)) {
  appendLog(`[error] pending file not found: ${pendingFile}`)
  clearMarker()
  process.exit(2)
}

// Read slash command body, strip frontmatter, substitute $ARGUMENTS
let md = fs.readFileSync(slashCommandPath, 'utf8')
md = md.replace(/^---\n[\s\S]*?\n---\n/, '')
// /vcb-enrich uses $ARGUMENTS = pending file path
const promptBody = md.replace(/\$ARGUMENTS/g, pendingFile)

appendLog(`prompt_bytes=${Buffer.byteLength(promptBody, 'utf8')}`)
appendLog('---')

const args = [
  '-p',
  '--model', model,
  '--allowed-tools', 'Read Write Bash(node:*)',
  '--max-budget-usd', budget,
]

appendLog(`claude args: ${JSON.stringify(args)}`)

const proc = spawn('claude', args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
  windowsHide: true,
})

proc.stdout.on('data', (chunk) => fs.appendFileSync(logFile, chunk))
proc.stderr.on('data', (chunk) => fs.appendFileSync(logFile, chunk))

proc.on('error', (err) => {
  appendLog(`\n[spawn error] ${err.message}`)
  clearMarker()
  process.exit(1)
})

proc.on('exit', (code, signal) => {
  appendLog(`\n[run-enrich ${new Date().toISOString()}] claude exit code=${code} signal=${signal ?? 'none'}`)
  if (fs.existsSync(enrichedFile)) {
    appendLog(`enriched file present: ${path.basename(enrichedFile)}`)
  } else {
    appendLog(`[warn] enriched file NOT produced at expected path`)
  }
  clearMarker()
  process.exit(code ?? 0)
})

// Pipe prompt body (slash command body w/ $ARGUMENTS substituted) via stdin
proc.stdin.write(promptBody)
proc.stdin.end()
