#!/usr/bin/env node
/**
 * VCB Step 5b — Parallel orchestrator for run-enrich.mjs.
 *
 * Spawns multiple `claude -p` enrichment subprocesses in parallel, one per
 * pending JSONL chunk. Each subprocess is independent (its own log, its own
 * --max-budget-usd cap, its own marker). Designed for backfilling many chunks
 * via Claude Code headless mode without using the Anthropic SDK Batch API.
 *
 * Discovery:
 *   - Scans exports/vcb-jobs/ for *-pending-NNofMM.jsonl files matching --job
 *   - Skips chunks where the enriched file already exists (unless --force)
 *   - Skips chunks with a live running.json marker
 *
 * Usage:
 *   node scripts/vcb/05b-parallel.mjs --job 20260515-0737-cast-2000
 *     [--chunks 01,02,03]            (which chunks; default: all not-yet-enriched)
 *     [--max-parallel N]             (concurrent processes; default 3)
 *     [--model opus|sonnet|haiku]    (default: opus)
 *     [--budget-usd N]               (per-chunk; default: 30)
 *     [--dry-run]                    (show plan only)
 *     [--force]                      (re-enrich chunks with existing enriched files)
 *
 * Output: progress lines as each chunk completes. Exits 0 if all succeeded.
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')
const jobsDir = path.join(repoRoot, 'exports', 'vcb-jobs')
const slashCommand = path.join(repoRoot, '.claude', 'commands', 'vcb-enrich.md')
const runnerScript = path.join(__dirname, 'run-enrich.mjs')

const { values } = parseArgs({
  options: {
    job: { type: 'string' },
    chunks: { type: 'string' },
    'max-parallel': { type: 'string', default: '3' },
    model: { type: 'string', default: 'opus' },
    'budget-usd': { type: 'string', default: '30' },
    'dry-run': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
})

const jobSlug = values.job
const chunksFilter = values.chunks?.split(',').map((s) => s.trim()) ?? null
const maxParallel = Math.max(1, parseInt(values['max-parallel'], 10))
const model = values.model
const budget = values['budget-usd']
const dryRun = values['dry-run']
const force = values.force

if (!jobSlug) {
  console.error('--job is required (e.g. --job 20260515-0737-cast-2000)')
  process.exit(2)
}
if (!fs.existsSync(slashCommand)) {
  console.error(`slash command not found: ${slashCommand}`)
  process.exit(2)
}
if (!fs.existsSync(runnerScript)) {
  console.error(`runner not found: ${runnerScript}`)
  process.exit(2)
}

// ── Discover chunks ─────────────────────────────────────────────────────
const PENDING_RE = new RegExp(`^${jobSlug}-pending(-(\\d+)of\\d+)?\\.jsonl$`)
const all = fs.readdirSync(jobsDir).filter((f) => PENDING_RE.test(f))
if (all.length === 0) {
  console.error(`no pending files found for job: ${jobSlug}`)
  process.exit(2)
}

const tasks = []
for (const pendingBase of all) {
  const m = pendingBase.match(PENDING_RE)
  const suffix = m[1] ?? ''
  const chunkNum = m[2] ?? null
  if (chunksFilter && chunkNum && !chunksFilter.includes(chunkNum)) continue

  const enrichedBase = `${jobSlug}-enriched${suffix}.jsonl`
  const logBase = `${jobSlug}-enriched${suffix}.log`
  const markerBase = `${jobSlug}-enriched${suffix}.running.json`

  const pendingPath = path.join(jobsDir, pendingBase)
  const enrichedPath = path.join(jobsDir, enrichedBase)
  const logPath = path.join(jobsDir, logBase)
  const markerPath = path.join(jobsDir, markerBase)

  let skipReason = null
  if (fs.existsSync(enrichedPath) && !force) skipReason = 'enriched file exists'
  else if (fs.existsSync(markerPath)) skipReason = 'running.json marker exists (in progress?)'

  tasks.push({
    chunk: chunkNum,
    pendingBase, enrichedBase, logBase, markerBase,
    pendingPath, enrichedPath, logPath, markerPath,
    skipReason,
  })
}

tasks.sort((a, b) => (a.chunk ?? '').localeCompare(b.chunk ?? ''))

const todo = tasks.filter((t) => !t.skipReason)
const skipped = tasks.filter((t) => t.skipReason)

console.log(`job: ${jobSlug}`)
console.log(`discovered: ${tasks.length} chunk(s)`)
console.log(`  to run:  ${todo.length}`)
console.log(`  skipped: ${skipped.length}`)
for (const t of skipped) {
  console.log(`    ${t.pendingBase} → ${t.skipReason}`)
}
console.log(`model=${model} budget-usd=${budget} max-parallel=${maxParallel}`)

if (todo.length === 0) {
  console.log('nothing to do.')
  process.exit(0)
}

if (dryRun) {
  console.log('--dry-run: would spawn:')
  for (const t of todo) console.log(`  ${t.pendingBase} → ${t.enrichedBase}`)
  process.exit(0)
}

// ── Spawn loop ──────────────────────────────────────────────────────────
const inflight = new Map() // pendingBase → { proc, startedAt }
const finished = []

function spawnOne(t) {
  const args = [
    runnerScript,
    '--slash-command', slashCommand,
    '--pending-file', t.pendingPath,
    '--enriched-file', t.enrichedPath,
    '--log-file', t.logPath,
    '--marker-file', t.markerPath,
    '--model', model,
    '--budget-usd', budget,
  ]
  if (force) args.push('--force')

  // Write marker BEFORE spawn so concurrent invocations see it
  fs.writeFileSync(t.markerPath, JSON.stringify({
    pid: null,
    started_at: new Date().toISOString(),
    model,
    budget: Number(budget),
    runner: 'scripts/vcb/run-enrich.mjs',
    orchestrator: '05b-parallel',
    pending_file: t.pendingBase,
  }, null, 2) + '\n', { encoding: 'utf8' })

  const proc = spawn(process.execPath, args, {
    cwd: repoRoot,
    stdio: 'ignore',
    detached: false,  // tied to parent so Ctrl-C cascades
    windowsHide: true,
  })
  const startedAt = Date.now()
  inflight.set(t.pendingBase, { proc, startedAt, task: t })
  console.log(`[start] ${t.pendingBase} (pid=${proc.pid})`)

  proc.on('exit', (code, signal) => {
    inflight.delete(t.pendingBase)
    const elapsedSec = Math.round((Date.now() - startedAt) / 1000)
    const enrichedExists = fs.existsSync(t.enrichedPath)
    const status = code === 0 && enrichedExists ? 'OK' : 'FAIL'
    finished.push({ chunk: t.chunk, base: t.pendingBase, code, signal, elapsedSec, status, enrichedExists })
    console.log(`[done ] ${t.pendingBase} → ${status} (exit=${code} elapsed=${elapsedSec}s enriched=${enrichedExists})`)
    pump()
  })
}

let nextIdx = 0
function pump() {
  while (inflight.size < maxParallel && nextIdx < todo.length) {
    spawnOne(todo[nextIdx++])
  }
  if (inflight.size === 0 && nextIdx >= todo.length) {
    // All done
    const okCount = finished.filter((f) => f.status === 'OK').length
    const failCount = finished.length - okCount
    console.log(`\n──── orchestrator complete ────`)
    console.log(`OK: ${okCount}/${finished.length}, FAIL: ${failCount}`)
    for (const f of finished.filter((x) => x.status !== 'OK')) {
      console.log(`  FAIL ${f.base}: exit=${f.code} signal=${f.signal ?? '-'} enriched=${f.enrichedExists}`)
    }
    process.exit(failCount === 0 ? 0 : 1)
  }
}

process.on('SIGINT', () => {
  console.error('\nSIGINT received — killing inflight processes')
  for (const { proc, task } of inflight.values()) {
    try { proc.kill('SIGTERM') } catch { /* ignore */ }
    try { fs.unlinkSync(task.markerPath) } catch { /* ignore */ }
  }
  process.exit(130)
})

pump()
