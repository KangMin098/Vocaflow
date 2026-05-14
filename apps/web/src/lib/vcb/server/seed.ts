// apps/web/src/lib/vcb/server/seed.ts
// Server Actions — VCB Method B Seed flow.
// 정합: CLAUDE.md §19.4b

'use server'

import fs from 'node:fs'
import path from 'node:path'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  getVcbJobsDir,
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

    return { ok: true, data: status }
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

export async function importSeedList(
  run_id: number,
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

    const specMeta = extractSpecFromRunConfig(r.config)

    const ingResult = await updateRunStatus(client, r.id, 'ingesting')
    if (!ingResult.ok) return { ok: false, error: ingResult.error }

    const srcResult = await createAiGeneratedSource(client, {
      runId: r.id,
      collectionSlug: r.collection_slug,
      collectionTitle: r.collection_title,
      seedFileName: seedListFile,
      specId: specMeta?.spec_id ?? null,
      itemCount: parsed.items.length,
    })
    if (!srcResult.ok || srcResult.source_id === undefined || srcResult.slug === undefined) {
      return { ok: false, error: srcResult.error ?? 'source insert failed' }
    }

    const insertResult = await insertAiSeedCandidates(client, r.id, parsed.items)
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
        total: parsed.items.length,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
