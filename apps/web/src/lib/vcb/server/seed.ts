// apps/web/src/lib/vcb/server/seed.ts
// Server Actions — VCB Method B Seed flow.
// 정합: CLAUDE.md §19.4b

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
  timestampPrefix,
  jobFileName,
  checkEncoding,
} from '@vocaflow/vcb-core'
import {
  buildSeedSpec,
  parseSeedListJsonl,
  detectDuplicates,
  createAiGeneratedSource,
  insertAiSeedCandidates,
  updateRunStatus,
  fetchRunForSeed,
  updateRunConfig,
  extractSpecFromRunConfig,
  type SeedSpecInput,
} from '@vocaflow/vcb-curate-core'

interface ServerActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

// ── 1. Generate seed-spec.json ────────────────────

export interface GenerateSpecInput {
  run_id: number
  target_count: number
  domain_hints: string
  must_include_keywords: string
  must_exclude_keywords: string
  reference_seeds: string
  license_constraint: string
}

export async function generateSeedSpec(
  input: GenerateSpecInput,
): Promise<ServerActionResult<{ spec_file: string; slash_command: string }>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()

    const runResult = await fetchRunForSeed(client, input.run_id)
    if (!runResult.ok || !runResult.row) {
      return { ok: false, error: runResult.error ?? `run #${input.run_id} not found` }
    }
    const r = runResult.row

    const cfg = r.config ?? {}
    const cefr = Array.isArray(cfg.target_cefr_range) ? (cfg.target_cefr_range as string[]) : []
    const segment = typeof cfg.target_segment === 'string' ? cfg.target_segment : 'general'

    const specInput: SeedSpecInput = {
      spec_id: r.id,
      collection_slug: r.collection_slug,
      collection_title: r.collection_title,
      target_count: input.target_count,
      target_cefr_range: cefr as SeedSpecInput['target_cefr_range'],
      target_segment: segment as SeedSpecInput['target_segment'],
      domain_hints: input.domain_hints.split('\n').map((s) => s.trim()).filter(Boolean),
      must_include_keywords: input.must_include_keywords
        .split(',').map((s) => s.trim()).filter(Boolean),
      must_exclude_keywords: input.must_exclude_keywords
        .split(',').map((s) => s.trim()).filter(Boolean),
      reference_seeds: input.reference_seeds,
      license_constraint: input.license_constraint || undefined,
    }

    const spec = buildSeedSpec(specInput)
    const ts = timestampPrefix()
    const specFileName = jobFileName.seedSpec(r.collection_slug, ts)
    const specPath = path.join(getVcbJobsDir(), specFileName)

    fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n', 'utf8')

    const newConfig = {
      ...cfg,
      seed_spec_id: r.id,
      seed_spec_file: specFileName,
      target_count: input.target_count,
      domain_hints: specInput.domain_hints,
      must_include_keywords: specInput.must_include_keywords,
      must_exclude_keywords: specInput.must_exclude_keywords,
      reference_seeds: specInput.reference_seeds,
    }
    const upd = await updateRunConfig(client, r.id, newConfig)
    if (!upd.ok) return { ok: false, error: upd.error }

    const slashCmd = `/vcb-seed-list exports/vcb-jobs/${specFileName}`

    revalidatePath(`/admin/vocab/runs/${r.id}`)
    revalidatePath(`/admin/vocab/runs/${r.id}/seed`)
    return { ok: true, data: { spec_file: specFileName, slash_command: slashCmd } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ── 2. Check seed job status ──────────────────────

export interface SeedJobStatus {
  spec_file: string | null
  spec_exists: boolean
  seed_list_file: string | null
  seed_list_exists: boolean
  seed_list_line_count: number
  validation_file: string | null
  validation_exists: boolean
  validation_ok: boolean | null
  validation_summary: string | null
  error_file: string | null
  error_exists: boolean
  error_summary: string | null
  // Runner state — claude -p detached process tracking
  running: boolean
  running_pid: number | null
  running_started_at: string | null
  running_elapsed_seconds: number | null
  log_file: string | null
  log_tail: string | null
  jobs_dir: string
}

export async function checkSeedJobStatus(
  run_id: number,
): Promise<ServerActionResult<SeedJobStatus>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()

    const runResult = await fetchRunForSeed(client, run_id)
    if (!runResult.ok || !runResult.row) {
      return { ok: false, error: runResult.error ?? `run #${run_id} not found` }
    }

    const cfg = runResult.row.config ?? {}
    const specFile = typeof cfg.seed_spec_file === 'string' ? cfg.seed_spec_file : null

    const jobsDir = getVcbJobsDir()

    const status: SeedJobStatus = {
      spec_file: specFile,
      spec_exists: false,
      seed_list_file: null,
      seed_list_exists: false,
      seed_list_line_count: 0,
      validation_file: null,
      validation_exists: false,
      validation_ok: null,
      validation_summary: null,
      error_file: null,
      error_exists: false,
      error_summary: null,
      running: false,
      running_pid: null,
      running_started_at: null,
      running_elapsed_seconds: null,
      log_file: null,
      log_tail: null,
      jobs_dir: jobsDir,
    }

    if (!specFile) {
      return { ok: true, data: status }
    }

    status.spec_exists = fs.existsSync(path.join(jobsDir, specFile))

    const base = specFile.replace(/-seed-spec\.json$/, '')
    const seedListFile = `${base}-seed-list.jsonl`
    const validationFile = `${base}-seed-list.validation.json`
    const errorFile = `${base}-seed-list.error.json`

    status.seed_list_file = seedListFile
    status.validation_file = validationFile
    status.error_file = errorFile

    const seedListPath = path.join(jobsDir, seedListFile)
    if (fs.existsSync(seedListPath)) {
      status.seed_list_exists = true
      const content = fs.readFileSync(seedListPath, 'utf8')
      status.seed_list_line_count = content.split('\n').filter((l) => l.trim().length > 0).length
    }

    const validationPath = path.join(jobsDir, validationFile)
    if (fs.existsSync(validationPath)) {
      status.validation_exists = true
      try {
        const v = JSON.parse(fs.readFileSync(validationPath, 'utf8')) as {
          ok?: boolean
          summary?: string
          errors?: unknown[]
        }
        status.validation_ok = typeof v.ok === 'boolean' ? v.ok : null
        status.validation_summary =
          typeof v.summary === 'string'
            ? v.summary
            : v.errors && Array.isArray(v.errors)
              ? `${v.errors.length} error(s)`
              : null
      } catch {
        status.validation_ok = false
        status.validation_summary = 'validation file is not valid JSON'
      }
    }

    const errorPath = path.join(jobsDir, errorFile)
    if (fs.existsSync(errorPath)) {
      status.error_exists = true
      try {
        const e = JSON.parse(fs.readFileSync(errorPath, 'utf8')) as { message?: string }
        status.error_summary = typeof e.message === 'string' ? e.message : 'error file present'
      } catch {
        status.error_summary = 'error file (unparseable)'
      }
    }

    // Runner state — claude -p marker + log
    const markerPath = path.join(jobsDir, `${base}-seed-list.running.json`)
    const logFileName = `${base}-seed-list.log`
    const logPath = path.join(jobsDir, logFileName)
    status.log_file = logFileName

    if (fs.existsSync(markerPath)) {
      // If seed-list.jsonl now exists, the run completed — clean up marker.
      if (status.seed_list_exists) {
        try {
          fs.unlinkSync(markerPath)
        } catch {
          /* ignore */
        }
      } else {
        try {
          const m = JSON.parse(fs.readFileSync(markerPath, 'utf8')) as {
            pid?: number
            started_at?: string
          }
          status.running = true
          status.running_pid = typeof m.pid === 'number' ? m.pid : null
          status.running_started_at =
            typeof m.started_at === 'string' ? m.started_at : null
          if (status.running_started_at) {
            const startMs = new Date(status.running_started_at).getTime()
            if (!Number.isNaN(startMs)) {
              status.running_elapsed_seconds = Math.floor((Date.now() - startMs) / 1000)
            }
          }
        } catch {
          /* malformed marker — treat as not running */
        }
      }
    }

    // Log tail (last ~2KB) for visibility
    if (fs.existsSync(logPath)) {
      try {
        const fd = fs.openSync(logPath, 'r')
        const stat = fs.fstatSync(fd)
        const TAIL_BYTES = 2048
        const len = Math.min(TAIL_BYTES, stat.size)
        const buf = Buffer.alloc(len)
        fs.readSync(fd, buf, 0, len, Math.max(0, stat.size - len))
        fs.closeSync(fd)
        status.log_tail = buf.toString('utf8')
      } catch {
        /* ignore log read errors */
      }
    }

    return { ok: true, data: status }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ── 2b. Run /vcb-seed-list as detached claude -p ──

export interface RunSeedListResult {
  pid: number | null
  spec_file: string
  log_file: string
  started_at: string
}

export async function runSeedListCommand(
  run_id: number,
  opts?: { model?: 'sonnet' | 'opus'; maxBudgetUsd?: number },
): Promise<ServerActionResult<RunSeedListResult>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()

    const runResult = await fetchRunForSeed(client, run_id)
    if (!runResult.ok || !runResult.row) {
      return { ok: false, error: runResult.error ?? `run #${run_id} not found` }
    }
    const r = runResult.row

    const specFile = typeof r.config?.seed_spec_file === 'string' ? r.config.seed_spec_file : null
    if (!specFile) {
      return { ok: false, error: 'seed_spec_file missing — generate spec first (Step 1)' }
    }

    const jobsDir = getVcbJobsDir()
    const specPath = path.join(jobsDir, specFile)
    if (!fs.existsSync(specPath)) {
      return { ok: false, error: `spec file not found on disk: ${specFile}` }
    }

    const base = specFile.replace(/-seed-spec\.json$/, '')
    const seedListFile = `${base}-seed-list.jsonl`
    const seedListPath = path.join(jobsDir, seedListFile)
    if (fs.existsSync(seedListPath)) {
      return {
        ok: false,
        error: `seed list already generated: ${seedListFile}. Delete the file first if you want to regenerate.`,
      }
    }

    const markerPath = path.join(jobsDir, `${base}-seed-list.running.json`)
    if (fs.existsSync(markerPath)) {
      return { ok: false, error: 'a run is already in progress — wait or remove the .running.json marker' }
    }

    const logPath = path.join(jobsDir, `${base}-seed-list.log`)

    const model = opts?.model ?? 'opus'
    const budget = opts?.maxBudgetUsd ?? 5
    const monorepoRoot = findMonorepoRoot()

    // Relative path from monorepo root → matches slash command convention
    const relSpec = `exports/vcb-jobs/${specFile}`
    const startedAt = new Date().toISOString()

    // ─── Inline the slash command body ────────────────
    // claude -p (non-interactive print mode) does NOT resolve slash commands;
    // it treats `/foo` as literal text. We must read the .md file and inject
    // the body as the prompt, performing $ARGUMENTS substitution ourselves.
    //
    // This keeps `.claude/commands/vcb-seed-list.md` as the SSoT while enabling
    // batch invocation. Interactive sessions still resolve the slash command
    // via Claude Code's frontmatter parser.
    const slashCmdPath = path.join(monorepoRoot, '.claude', 'commands', 'vcb-seed-list.md')
    if (!fs.existsSync(slashCmdPath)) {
      return { ok: false, error: 'slash command definition missing: .claude/commands/vcb-seed-list.md' }
    }
    let mdContent = fs.readFileSync(slashCmdPath, 'utf8')
    // Strip frontmatter (--- ... ---) and arg-hint metadata
    mdContent = mdContent.replace(/^---\n[\s\S]*?\n---\n/, '')
    // Substitute $ARGUMENTS with the actual spec path
    const promptBody = mdContent.replace(/\$ARGUMENTS/g, relSpec)

    // Write prompt body to a temp file. The runner script reads from this.
    const promptFile = path.join(jobsDir, `${base}-seed-list.prompt.txt`)
    fs.writeFileSync(promptFile, promptBody, 'utf8')

    // Initialize log with startup metadata (the runner script appends from here).
    fs.writeFileSync(
      logPath,
      [
        `[runSeedListCommand ${startedAt}]`,
        `cwd=${monorepoRoot}`,
        `model=${model} budget=$${budget}`,
        `spec=${relSpec}`,
        `platform=${process.platform}`,
        `prompt_file=${path.basename(promptFile)}`,
        `prompt_bytes=${Buffer.byteLength(promptBody, 'utf8')}`,
        '---',
        '',
      ].join('\n'),
      'utf8',
    )

    // Delegate to scripts/vcb/run-seed-list.mjs (Node script). The runner
    // handles claude invocation + stdio capture properly. We just fire-and-forget.
    //
    // Why delegate instead of spawning claude directly:
    // - Windows: detached + stdio:'ignore' + shell redirect (`>> log 2>&1`) is
    //   unreliable — error messages get lost, exit codes inconsistent.
    // - Doing the redirect inside a child Node process gives clean fs.appendFileSync
    //   capture regardless of platform.
    // - The runner is invokable from CLI too for debugging.
    const runnerScript = path.join(monorepoRoot, 'scripts', 'vcb', 'run-seed-list.mjs')
    const proc = spawn(
      process.execPath,
      [
        runnerScript,
        '--prompt-file', promptFile,
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

    // Write marker before unref so status check can pick it up immediately
    fs.writeFileSync(
      markerPath,
      JSON.stringify(
        { pid, started_at: startedAt, model, budget, runner: 'scripts/vcb/run-seed-list.mjs' },
        null,
        2,
      ) + '\n',
      'utf8',
    )

    // Capture early exit (within ~1s) — if claude.cmd fails to launch we want to know.
    proc.on('exit', (code, signal) => {
      try {
        const now = new Date().toISOString()
        fs.appendFileSync(
          logPath,
          `\n[runner ${now}] exit code=${code} signal=${signal ?? 'none'}\n`,
          'utf8',
        )
        // If exit before seed-list.jsonl appears, leave marker for status-check to surface;
        // but if we exit non-zero and no jsonl, drop marker so admin can retry.
        if (code !== 0 && !fs.existsSync(seedListPath)) {
          try {
            fs.unlinkSync(markerPath)
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    })

    // Best-effort cleanup if spawn errors out very fast
    proc.on('error', (err) => {
      try {
        fs.appendFileSync(logPath, `\n[spawn error] ${err.message}\n`, 'utf8')
        fs.unlinkSync(markerPath)
      } catch {
        /* ignore */
      }
    })

    // Detach so the Node process doesn't keep claude alive after server action returns
    proc.unref()

    revalidatePath(`/admin/vocab/runs/${run_id}/seed`)

    return {
      ok: true,
      data: {
        pid,
        spec_file: specFile,
        log_file: `${base}-seed-list.log`,
        started_at: startedAt,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ── 2c. Load seed preview (parse JSONL + validation) ──

export interface SeedPreviewItem {
  lemma: string
  pos: string
  cefr_estimate: string
  frequency_tier: string
  rationale_short: string
  confidence: number
}

export interface SeedPreviewValidation {
  ok: boolean | null
  total_input: number | null
  total_passed: number | null
  total_failed: number | null
  cefr_distribution: Record<string, number> | null
  confidence_avg: number | null
  encoding: { hasBom: boolean; hasCrlf: boolean } | null
  errors: unknown[]
  summary: string | null
}

export interface SeedPreviewSpec {
  spec_id: number
  collection_slug: string
  collection_title: string
  target_count: number | null
  target_cefr_range: string[]
  target_segment: string | null
  must_include_keywords: string[]
  must_exclude_keywords: string[]
}

export interface SeedPreviewData {
  spec: SeedPreviewSpec
  items: SeedPreviewItem[]
  validation: SeedPreviewValidation
  run_status: string
  seed_list_file: string
}

export async function loadSeedPreview(
  run_id: number,
): Promise<ServerActionResult<SeedPreviewData>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()

    const runResult = await fetchRunForSeed(client, run_id)
    if (!runResult.ok || !runResult.row) {
      return { ok: false, error: runResult.error ?? `run #${run_id} not found` }
    }
    const r = runResult.row

    const cfg = r.config ?? {}
    const specFile = typeof cfg.seed_spec_file === 'string' ? cfg.seed_spec_file : null
    if (!specFile) {
      return { ok: false, error: 'seed_spec_file missing' }
    }

    const jobsDir = getVcbJobsDir()
    const base = specFile.replace(/-seed-spec\.json$/, '')
    const seedListPath = path.join(jobsDir, `${base}-seed-list.jsonl`)
    const validationPath = path.join(jobsDir, `${base}-seed-list.validation.json`)

    if (!fs.existsSync(seedListPath)) {
      return { ok: false, error: 'seed-list.jsonl not found — generate first' }
    }

    const content = fs.readFileSync(seedListPath, 'utf8')
    const items: SeedPreviewItem[] = []
    const lines = content.split('\n').filter((l) => l.trim().length > 0)
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as SeedPreviewItem
        if (
          typeof parsed.lemma === 'string' &&
          typeof parsed.pos === 'string' &&
          typeof parsed.cefr_estimate === 'string' &&
          typeof parsed.frequency_tier === 'string'
        ) {
          items.push({
            lemma: parsed.lemma,
            pos: parsed.pos,
            cefr_estimate: parsed.cefr_estimate,
            frequency_tier: parsed.frequency_tier,
            rationale_short: parsed.rationale_short ?? '',
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
          })
        }
      } catch {
        /* skip malformed lines — validation should have flagged them */
      }
    }

    let validation: SeedPreviewValidation = {
      ok: null,
      total_input: null,
      total_passed: null,
      total_failed: null,
      cefr_distribution: null,
      confidence_avg: null,
      encoding: null,
      errors: [],
      summary: null,
    }
    if (fs.existsSync(validationPath)) {
      try {
        const v = JSON.parse(fs.readFileSync(validationPath, 'utf8')) as Partial<
          SeedPreviewValidation
        > & { summary?: string }
        validation = {
          ok: typeof v.ok === 'boolean' ? v.ok : null,
          total_input: typeof v.total_input === 'number' ? v.total_input : null,
          total_passed: typeof v.total_passed === 'number' ? v.total_passed : null,
          total_failed: typeof v.total_failed === 'number' ? v.total_failed : null,
          cefr_distribution: (v.cefr_distribution as Record<string, number>) ?? null,
          confidence_avg: typeof v.confidence_avg === 'number' ? v.confidence_avg : null,
          encoding: (v.encoding as SeedPreviewValidation['encoding']) ?? null,
          errors: Array.isArray(v.errors) ? v.errors : [],
          summary: typeof v.summary === 'string' ? v.summary : null,
        }
      } catch {
        /* malformed validation — leave as defaults */
      }
    }

    const spec: SeedPreviewSpec = {
      spec_id: r.id,
      collection_slug: r.collection_slug,
      collection_title: r.collection_title,
      target_count: typeof cfg.target_count === 'number' ? cfg.target_count : null,
      target_cefr_range: Array.isArray(cfg.target_cefr_range)
        ? (cfg.target_cefr_range as string[])
        : [],
      target_segment: typeof cfg.target_segment === 'string' ? cfg.target_segment : null,
      must_include_keywords: Array.isArray(cfg.must_include_keywords)
        ? (cfg.must_include_keywords as string[])
        : [],
      must_exclude_keywords: Array.isArray(cfg.must_exclude_keywords)
        ? (cfg.must_exclude_keywords as string[])
        : [],
    }

    return {
      ok: true,
      data: {
        spec,
        items,
        validation,
        run_status: r.status,
        seed_list_file: `${base}-seed-list.jsonl`,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ── 2d. Delete seed list artifacts (regenerate flow) ──

export interface DeleteSeedArtifactsResult {
  deleted_files: string[]
  run_status_reset: boolean
}

/**
 * Removes generated seed-list artifacts (jsonl + validation + log + prompt + marker)
 * so the admin can regenerate Step 2 without manual file management.
 *
 * Preserves:
 * - seed-spec.json (admin's input, useful for re-run)
 * - vocab_sources / vocab_seed_candidates rows already in DB (none yet expected,
 *   since regenerate is meant for pre-import flow only)
 *
 * Refuses if:
 * - Run status is past 'extracted' (import already happened → user must reset DB manually)
 * - A runner is currently in progress (marker present + no jsonl yet)
 */
export async function deleteSeedListArtifacts(
  run_id: number,
): Promise<ServerActionResult<DeleteSeedArtifactsResult>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()

    const runResult = await fetchRunForSeed(client, run_id)
    if (!runResult.ok || !runResult.row) {
      return { ok: false, error: runResult.error ?? `run #${run_id} not found` }
    }
    const r = runResult.row

    // Block when import already happened.
    if (r.status !== 'created' && r.status !== 'ingesting') {
      return {
        ok: false,
        error: `cannot regenerate: run status is ${r.status} (이미 후속 단계 진행됨)`,
      }
    }

    const cfg = r.config ?? {}
    const specFile = typeof cfg.seed_spec_file === 'string' ? cfg.seed_spec_file : null
    if (!specFile) {
      return { ok: false, error: 'no spec file recorded — nothing to delete' }
    }

    const jobsDir = getVcbJobsDir()
    const base = specFile.replace(/-seed-spec\.json$/, '')
    const markerPath = path.join(jobsDir, `${base}-seed-list.running.json`)
    const seedListPath = path.join(jobsDir, `${base}-seed-list.jsonl`)

    // Block if a runner is in progress but hasn't produced the jsonl yet.
    if (fs.existsSync(markerPath) && !fs.existsSync(seedListPath)) {
      return {
        ok: false,
        error: 'a runner is currently in progress — wait for it to finish or remove the marker file',
      }
    }

    const candidates = [
      `${base}-seed-list.jsonl`,
      `${base}-seed-list.validation.json`,
      `${base}-seed-list.error.json`,
      `${base}-seed-list.log`,
      `${base}-seed-list.prompt.txt`,
      `${base}-seed-list.running.json`,
    ]

    const deleted: string[] = []
    for (const name of candidates) {
      const p = path.join(jobsDir, name)
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p)
          deleted.push(name)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { ok: false, error: `failed to delete ${name}: ${msg}` }
        }
      }
    }

    // Clear seed_list_file from config so checkSeedJobStatus reflects the reset.
    // Keep seed_spec_file + spec params so admin can immediately re-run.
    const newConfig = { ...cfg }
    delete newConfig.seed_list_file
    await updateRunConfig(client, r.id, newConfig)

    // If run status drifted to 'ingesting' (rare), reset to 'created'
    let runStatusReset = false
    if (r.status === 'ingesting') {
      const reset = await updateRunStatus(client, r.id, 'created')
      runStatusReset = reset.ok
    }

    revalidatePath(`/admin/vocab/runs/${run_id}`)
    revalidatePath(`/admin/vocab/runs/${run_id}/seed`)
    revalidatePath(`/admin/vocab/runs/${run_id}/seed/preview`)

    return {
      ok: true,
      data: { deleted_files: deleted, run_status_reset: runStatusReset },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// ── 3. Import seed list ───────────────────────────

export interface ImportSeedListResult {
  source_id: number
  source_slug: string
  inserted: number
  skipped: number
  total: number
}

export interface ImportSeedListOptions {
  /** Lemma keys to exclude. Format: `<lemma>|<pos>` (matches the dedup key). */
  excluded_keys?: string[]
}

export async function importSeedList(
  run_id: number,
  opts?: ImportSeedListOptions,
): Promise<ServerActionResult<ImportSeedListResult>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()

    const runResult = await fetchRunForSeed(client, run_id)
    if (!runResult.ok || !runResult.row) {
      return { ok: false, error: runResult.error ?? `run #${run_id} not found` }
    }
    const r = runResult.row

    if (r.status !== 'created' && r.status !== 'ingesting') {
      return {
        ok: false,
        error: `cannot import seed: run status is ${r.status} (expected created or ingesting)`,
      }
    }

    const specFile = typeof r.config?.seed_spec_file === 'string' ? r.config.seed_spec_file : null
    if (!specFile) {
      return { ok: false, error: 'seed_spec_file missing in run config — generate spec first' }
    }

    const jobsDir = getVcbJobsDir()
    const base = specFile.replace(/-seed-spec\.json$/, '')
    const seedListFile = `${base}-seed-list.jsonl`
    const seedListPath = path.join(jobsDir, seedListFile)

    if (!fs.existsSync(seedListPath)) {
      return { ok: false, error: `seed list not found: ${seedListFile}` }
    }

    const enc = checkEncoding(seedListPath)
    if (!enc.ok) {
      const reason = enc.hasBom ? 'UTF-8 BOM present' : 'CRLF line endings present'
      return { ok: false, error: `encoding check failed: ${reason} (must be UTF-8 LF)` }
    }

    const content = fs.readFileSync(seedListPath, 'utf8')
    const parsed = parseSeedListJsonl(content)
    if (!parsed.ok || !parsed.items) {
      const ln = parsed.line_number !== undefined ? ` (line ${parsed.line_number})` : ''
      return { ok: false, error: `parse failed: ${parsed.error}${ln}` }
    }

    const dups = detectDuplicates(parsed.items)
    if (dups.length > 0) {
      return {
        ok: false,
        error: `duplicate (lemma, pos) detected: ${dups.slice(0, 5).join(', ')}${dups.length > 5 ? ` ... (+${dups.length - 5} more)` : ''}`,
      }
    }

    // Apply excludes from preview workspace (lemma|pos keys)
    const excludeSet = new Set(opts?.excluded_keys ?? [])
    const filteredItems =
      excludeSet.size > 0
        ? parsed.items.filter((it) => !excludeSet.has(`${it.lemma}|${it.pos}`))
        : parsed.items

    if (filteredItems.length === 0) {
      return { ok: false, error: 'all items excluded — nothing to import' }
    }

    const specMeta = extractSpecFromRunConfig(r.config)

    const ingResult = await updateRunStatus(client, r.id, 'ingesting')
    if (!ingResult.ok) return { ok: false, error: ingResult.error }

    const srcResult = await createAiGeneratedSource(client, {
      runId: r.id,
      collectionSlug: r.collection_slug,
      collectionTitle: r.collection_title,
      seedFileName: seedListFile,
      specId: specMeta?.spec_id ?? null,
      itemCount: filteredItems.length,
    })
    if (!srcResult.ok || srcResult.source_id === undefined || srcResult.slug === undefined) {
      return { ok: false, error: srcResult.error ?? 'source insert failed' }
    }

    const insertResult = await insertAiSeedCandidates(client, r.id, filteredItems)
    if (!insertResult.ok) {
      return { ok: false, error: insertResult.error ?? 'seed insert failed' }
    }

    const extResult = await updateRunStatus(client, r.id, 'extracted')
    if (!extResult.ok) return { ok: false, error: extResult.error }

    const newConfig = { ...r.config, seed_list_file: seedListFile }
    await updateRunConfig(client, r.id, newConfig)

    revalidatePath(`/admin/vocab/runs/${r.id}`)
    revalidatePath(`/admin/vocab/runs/${r.id}/seed`)

    return {
      ok: true,
      data: {
        source_id: srcResult.source_id,
        source_slug: srcResult.slug,
        inserted: insertResult.inserted,
        skipped: insertResult.skipped,
        total: filteredItems.length,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
