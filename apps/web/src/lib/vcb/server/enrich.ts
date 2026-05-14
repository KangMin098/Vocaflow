// apps/web/src/lib/vcb/server/enrich.ts
// VCB Step 5 — Enrichment server actions.
// 5a (export) + 5b (claude -p runner) + 5d (import) + status check.

'use server'

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  getVcbJobsDir,
  findMonorepoRoot,
} from '@vocaflow/vcb-core'
import {
  exportEnrichmentJob,
  importEnrichmentResult,
  listExportedPendingFiles,
  type ExportedFile,
  type ImportEnrichmentResult,
  type ExportJobOptions,
} from '@vocaflow/vcb-curate-core'

interface ServerActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

// ── 1. Export ─────────────────────────────────────

export interface ExportJobServerResult {
  pending_count: number
  files: ExportedFile[]
}

export async function exportEnrichmentPending(
  run_id: number,
  opts?: ExportJobOptions,
): Promise<ServerActionResult<ExportJobServerResult>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()
    const result = await exportEnrichmentJob(client, run_id, opts ?? {})
    if (!result.ok || !result.files) {
      return { ok: false, error: result.error ?? 'export failed' }
    }
    revalidatePath(`/admin/vocab/runs/${run_id}`)
    return {
      ok: true,
      data: {
        pending_count: result.pending_count ?? 0,
        files: result.files,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ── 2. Status of enrichment runner + files ────────

export interface EnrichmentJobFile {
  pending_file: string
  pending_path: string
  pending_lines: number
  exists: boolean
  enriched_file: string
  enriched_path: string
  enriched_exists: boolean
  enriched_lines: number
  validation_file: string
  validation_exists: boolean
  validation_ok: boolean | null
  validation_summary: string | null
  log_file: string
  log_tail: string | null
  marker_file: string
  running: boolean
  running_pid: number | null
  running_started_at: string | null
  running_elapsed_seconds: number | null
}

function countLines(p: string): number {
  if (!fs.existsSync(p)) return 0
  const content = fs.readFileSync(p, 'utf8')
  return content.split('\n').filter((l) => l.trim().length > 0).length
}

export async function checkEnrichmentStatus(
  run_id: number,
): Promise<ServerActionResult<{ jobs: EnrichmentJobFile[] }>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()

    const exportedPaths = await listExportedPendingFiles(client, run_id)
    const jobsDir = getVcbJobsDir()

    const jobs: EnrichmentJobFile[] = []
    for (const fullPath of exportedPaths) {
      const pendingPath = path.isAbsolute(fullPath)
        ? fullPath
        : path.join(jobsDir, path.basename(fullPath))
      const pendingFile = path.basename(pendingPath)
      const base = pendingFile.replace(/-pending(?:-\d+of\d+)?\.jsonl$/, '')
      const matchSuffix = pendingFile.match(/-pending(-\d+of\d+)?\.jsonl$/)
      const suffix = matchSuffix?.[1] ?? ''
      const enrichedFile = `${base}-enriched${suffix}.jsonl`
      const validationFile = `${base}-enriched${suffix}.validation.json`
      const logFile = `${base}-enriched${suffix}.log`
      const markerFile = `${base}-enriched${suffix}.running.json`

      const enrichedPath = path.join(jobsDir, enrichedFile)
      const validationPath = path.join(jobsDir, validationFile)
      const logPath = path.join(jobsDir, logFile)
      const markerPath = path.join(jobsDir, markerFile)

      let validationOk: boolean | null = null
      let validationSummary: string | null = null
      if (fs.existsSync(validationPath)) {
        try {
          const v = JSON.parse(fs.readFileSync(validationPath, 'utf8')) as {
            ok?: boolean
            summary?: string
            total_failed?: number
            total_passed?: number
          }
          validationOk = typeof v.ok === 'boolean' ? v.ok : null
          validationSummary =
            typeof v.summary === 'string'
              ? v.summary
              : v.total_passed !== undefined
                ? `passed ${v.total_passed} / failed ${v.total_failed ?? 0}`
                : null
        } catch {
          validationOk = false
          validationSummary = 'validation file unparseable'
        }
      }

      let logTail: string | null = null
      if (fs.existsSync(logPath)) {
        try {
          const fd = fs.openSync(logPath, 'r')
          const stat = fs.fstatSync(fd)
          const TAIL = 2048
          const len = Math.min(TAIL, stat.size)
          const buf = Buffer.alloc(len)
          fs.readSync(fd, buf, 0, len, Math.max(0, stat.size - len))
          fs.closeSync(fd)
          logTail = buf.toString('utf8')
        } catch {
          /* ignore */
        }
      }

      let running = false
      let runningPid: number | null = null
      let runningStartedAt: string | null = null
      let runningElapsed: number | null = null
      if (fs.existsSync(markerPath)) {
        if (fs.existsSync(enrichedPath)) {
          // Stale marker — runner produced output but didn't clean up
          try { fs.unlinkSync(markerPath) } catch { /* ignore */ }
        } else {
          try {
            const m = JSON.parse(fs.readFileSync(markerPath, 'utf8')) as {
              pid?: number
              started_at?: string
            }
            running = true
            runningPid = typeof m.pid === 'number' ? m.pid : null
            runningStartedAt = typeof m.started_at === 'string' ? m.started_at : null
            if (runningStartedAt) {
              const ms = new Date(runningStartedAt).getTime()
              if (!Number.isNaN(ms)) {
                runningElapsed = Math.floor((Date.now() - ms) / 1000)
              }
            }
          } catch {
            /* malformed */
          }
        }
      }

      jobs.push({
        pending_file: pendingFile,
        pending_path: pendingPath,
        pending_lines: countLines(pendingPath),
        exists: fs.existsSync(pendingPath),
        enriched_file: enrichedFile,
        enriched_path: enrichedPath,
        enriched_exists: fs.existsSync(enrichedPath),
        enriched_lines: countLines(enrichedPath),
        validation_file: validationFile,
        validation_exists: fs.existsSync(validationPath),
        validation_ok: validationOk,
        validation_summary: validationSummary,
        log_file: logFile,
        log_tail: logTail,
        marker_file: markerFile,
        running,
        running_pid: runningPid,
        running_started_at: runningStartedAt,
        running_elapsed_seconds: runningElapsed,
      })
    }

    return { ok: true, data: { jobs } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ── 3. Run /vcb-enrich (detached, like seed runner) ─

export interface RunEnrichmentResult {
  pid: number | null
  pending_file: string
  enriched_file: string
  log_file: string
  started_at: string
}

export async function runEnrichmentCommand(
  pending_file_basename: string,
  opts?: { model?: 'opus' | 'sonnet' | 'haiku'; maxBudgetUsd?: number },
): Promise<ServerActionResult<RunEnrichmentResult>> {
  try {
    await requireAdmin('/admin/vocab')

    const jobsDir = getVcbJobsDir()
    const monorepoRoot = findMonorepoRoot()
    const pendingPath = path.join(jobsDir, pending_file_basename)

    if (!fs.existsSync(pendingPath)) {
      return { ok: false, error: `pending file not found: ${pending_file_basename}` }
    }

    const matchSuffix = pending_file_basename.match(/-pending(-\d+of\d+)?\.jsonl$/)
    if (!matchSuffix) {
      return {
        ok: false,
        error: `unexpected pending filename format: ${pending_file_basename}`,
      }
    }
    const suffix = matchSuffix[1] ?? ''
    const base = pending_file_basename.replace(/-pending(?:-\d+of\d+)?\.jsonl$/, '')
    const enrichedFile = `${base}-enriched${suffix}.jsonl`
    const enrichedPath = path.join(jobsDir, enrichedFile)
    const logPath = path.join(jobsDir, `${base}-enriched${suffix}.log`)
    const markerPath = path.join(jobsDir, `${base}-enriched${suffix}.running.json`)

    if (fs.existsSync(enrichedPath)) {
      return {
        ok: false,
        error: `enriched file already exists: ${enrichedFile}. Delete to regenerate.`,
      }
    }
    if (fs.existsSync(markerPath)) {
      return { ok: false, error: 'a runner is already in progress for this chunk' }
    }

    const startedAt = new Date().toISOString()
    fs.writeFileSync(
      logPath,
      [
        `[runEnrichmentCommand ${startedAt}]`,
        `pending=${pending_file_basename}`,
        `enriched=${enrichedFile}`,
        `cwd=${monorepoRoot}`,
        '---',
        '',
      ].join('\n'),
      'utf8',
    )

    const slashCommand = path.join(monorepoRoot, '.claude', 'commands', 'vcb-enrich.md')
    if (!fs.existsSync(slashCommand)) {
      return { ok: false, error: '.claude/commands/vcb-enrich.md missing' }
    }

    const runnerScript = path.join(monorepoRoot, 'scripts', 'vcb', 'run-enrich.mjs')
    const model = opts?.model ?? 'sonnet'
    const budget = opts?.maxBudgetUsd ?? 10

    const proc = spawn(
      process.execPath,
      [
        runnerScript,
        '--slash-command', slashCommand,
        '--pending-file', pendingPath,
        '--enriched-file', enrichedPath,
        '--log-file', logPath,
        '--marker-file', markerPath,
        '--model', model,
        '--budget-usd', String(budget),
      ],
      {
        cwd: monorepoRoot,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      },
    )

    const pid = proc.pid ?? null
    fs.writeFileSync(
      markerPath,
      JSON.stringify(
        {
          pid,
          started_at: startedAt,
          model,
          budget,
          runner: 'scripts/vcb/run-enrich.mjs',
          pending_file: pending_file_basename,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    )

    proc.on('error', (err) => {
      try {
        fs.appendFileSync(logPath, `\n[spawn error] ${err.message}\n`, 'utf8')
        fs.unlinkSync(markerPath)
      } catch {
        /* ignore */
      }
    })

    proc.unref()

    return {
      ok: true,
      data: {
        pid,
        pending_file: pending_file_basename,
        enriched_file: enrichedFile,
        log_file: path.basename(logPath),
        started_at: startedAt,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ── 4. Import enriched JSONL ─────────────────────

export async function importEnrichmentFile(
  run_id: number,
  enriched_file_basename: string,
  opts?: { skipValidation?: boolean },
): Promise<ServerActionResult<ImportEnrichmentResult>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()
    const jobsDir = getVcbJobsDir()
    const filePath = path.join(jobsDir, enriched_file_basename)

    const result = await importEnrichmentResult(client, filePath, opts)
    if (!result.ok) {
      return { ok: false, error: result.error ?? 'import failed' }
    }

    revalidatePath(`/admin/vocab/runs/${run_id}`)
    return { ok: true, data: result }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
