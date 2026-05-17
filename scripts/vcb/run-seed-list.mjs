#!/usr/bin/env node
/**
 * VCB Method B — Detached runner for /vcb-seed-list.
 *
 * Spawned by apps/web Server Action `runSeedListCommand`. The Server Action
 * fire-and-forgets THIS script (detached); this script then spawns `claude`
 * with proper stdio and captures all output to the log file.
 *
 * Decoupling reasons:
 * - Windows shell-redirect (`>> log 2>&1`) under detached+stdio:'ignore' loses
 *   error messages and exits inconsistently. Doing the redirect in Node here
 *   gives us reliable capture.
 * - claude -p does NOT resolve slash commands; we feed the inlined prompt body
 *   via stdin pipe (no temp file quoting needed once we're in Node).
 *
 * Usage:
 *   node scripts/vcb/run-seed-list.mjs \
 *     --prompt-file <path> --log-file <path> --model <opus|sonnet|haiku> \
 *     --budget-usd <number> --marker-file <path>
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    'prompt-file': { type: 'string' },
    'log-file': { type: 'string' },
    'model': { type: 'string', default: 'opus' },
    'budget-usd': { type: 'string', default: '5' },
    'marker-file': { type: 'string' },
  },
})

const promptFile = values['prompt-file']
const logFile = values['log-file']
const markerFile = values['marker-file']
const model = values['model'] ?? 'opus'
const budget = values['budget-usd'] ?? '5'

if (!promptFile || !logFile) {
  console.error('--prompt-file and --log-file are required')
  process.exit(2)
}

function appendLog(msg) {
  fs.appendFileSync(logFile, msg.endsWith('\n') ? msg : msg + '\n', 'utf8')
}

function clearMarker() {
  if (!markerFile) return
  try { fs.unlinkSync(markerFile) } catch { /* ignore */ }
}

appendLog(`[run-seed-list ${new Date().toISOString()}] starting`)
appendLog(`prompt_file=${promptFile}`)
appendLog(`model=${model} budget=${budget}`)

if (!fs.existsSync(promptFile)) {
  appendLog(`[error] prompt file not found: ${promptFile}`)
  clearMarker()
  process.exit(2)
}

const promptBody = fs.readFileSync(promptFile, 'utf8')
appendLog(`prompt_bytes=${Buffer.byteLength(promptBody, 'utf8')}`)
appendLog('---')

// Spawn claude (non-detached) and pipe stdin from the prompt body.
// We're already detached at the server-action level, so this child can be
// regular (not detached) and we benefit from clean stdio handling.
const args = [
  '-p',
  '--model', model,
  '--allowed-tools', 'Read Write Bash(node:*)',
  '--max-budget-usd', budget,
]

appendLog(`claude args: ${JSON.stringify(args)}`)

const proc = spawn('claude', args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,           // Windows: resolves claude.cmd
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
  appendLog(`\n[run-seed-list ${new Date().toISOString()}] claude exit code=${code} signal=${signal ?? 'none'}`)
  clearMarker()
  process.exit(code ?? 0)
})

// Pipe prompt body via stdin
proc.stdin.write(promptBody)
proc.stdin.end()
