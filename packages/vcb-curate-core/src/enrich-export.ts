// packages/vcb-curate-core/src/enrich-export.ts
// VCB Step 5a — Export pending queue to JSONL chunks. CLI + Server Action shared.
// CLAUDE.md §19.5

import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getVcbJobsDir,
  jobFileName,
  timestampPrefix,
  writeUtf8Lf,
  type DictHitLevel,
  type EnrichmentJobLine,
  type Pos,
} from '@vocaflow/vcb-core'

export const DEFAULT_CHUNK_SIZE = 200

export interface PendingRow {
  queue_id: number
  hit_level: DictHitLevel | null
  missing_fields: string[] | null
  enriched_payload: Record<string, unknown> | null
  lemma: string
  pos: Pos
}

export interface ExportJobOptions {
  chunkSize?: number
  limit?: number | null
  contextHint?: string | null
}

export interface ExportedFile {
  path: string
  basename: string
  count: number
  chunk: number
  total_chunks: number
}

export interface ExportJobResult {
  ok: boolean
  pending_count?: number
  files?: ExportedFile[]
  error?: string
}

/**
 * Reset queue rows marked exported into a list of stale paths back to 'pending'.
 * Returns the number of rows updated.
 */
export async function resetStaleExportedRows(
  client: SupabaseClient,
  runId: number,
  stalePaths: string[],
): Promise<{ ok: boolean; reset_count?: number; error?: string }> {
  if (stalePaths.length === 0) return { ok: true, reset_count: 0 }

  const { data: seedRows, error: seedErr } = await client
    .from('vocab_seed_candidates')
    .select('id')
    .eq('run_id', runId)
  if (seedErr) return { ok: false, error: `fetch seed ids failed: ${seedErr.message}` }

  const seedIds = ((seedRows ?? []) as unknown as Array<{ id: number }>).map((r) => r.id)
  if (seedIds.length === 0) return { ok: true, reset_count: 0 }

  const { data: updated, error: updErr } = await client
    .from('vocab_enrichment_queue')
    .update({
      status: 'pending',
      exported_job_file: null,
      exported_at: null,
    })
    .eq('status', 'exported')
    .in('exported_job_file', stalePaths)
    .in('seed_id', seedIds)
    .select('id')

  if (updErr) return { ok: false, error: `reset failed: ${updErr.message}` }

  return {
    ok: true,
    reset_count: ((updated ?? []) as unknown as Array<{ id: number }>).length,
  }
}

/**
 * List all exported pending files associated with this run, via
 * vocab_enrichment_queue.exported_job_file.
 */
export async function listExportedPendingFiles(
  client: SupabaseClient,
  runId: number,
): Promise<string[]> {
  const { data, error } = await client
    .from('vocab_enrichment_queue')
    .select('exported_job_file, seed:vocab_seed_candidates!inner(run_id)')
    .eq('seed.run_id', runId)
    .not('exported_job_file', 'is', null)

  if (error) {
    throw new Error(`fetch exported files failed: ${error.message}`)
  }
  const set = new Set<string>()
  for (const row of (data ?? []) as Array<{ exported_job_file: string | null }>) {
    if (row.exported_job_file) set.add(row.exported_job_file)
  }
  return Array.from(set).sort()
}

async function fetchRunSlug(
  client: SupabaseClient,
  runId: number,
): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const { data, error } = await client
    .from('vocab_runs')
    .select('collection_slug')
    .eq('id', runId)
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? `run #${runId} not found` }
  }
  return { ok: true, slug: (data as { collection_slug: string }).collection_slug }
}

async function fetchPending(
  client: SupabaseClient,
  runId: number,
  limit: number | null,
): Promise<PendingRow[]> {
  const PAGE_SIZE = 1000
  const all: PendingRow[] = []
  let offset = 0
  const cap = limit ?? Infinity

  while (all.length < cap) {
    const remaining = cap - all.length
    const fetchSize = Math.min(PAGE_SIZE, remaining)

    const { data, error } = await client
      .from('vocab_enrichment_queue')
      .select(
        `
        id,
        hit_level,
        missing_fields,
        enriched_payload,
        seed:vocab_seed_candidates!inner(
          run_id,
          lemma,
          pos
        )
        `,
      )
      .eq('status', 'pending')
      .eq('seed.run_id', runId)
      .order('id', { ascending: true })
      .range(offset, offset + fetchSize - 1)

    if (error) {
      throw new Error(`fetch pending failed: ${error.message}`)
    }
    const page = data ?? []
    if (page.length === 0) break

    type Row = {
      id: number
      hit_level: DictHitLevel | null
      missing_fields: string[] | null
      enriched_payload: Record<string, unknown> | null
      // PostgREST returns the joined relation as object OR array depending on inference;
      // accept both and normalize below.
      seed: { lemma: string; pos: Pos } | Array<{ lemma: string; pos: Pos }>
    }
    for (const row of page as unknown as Row[]) {
      const seed = Array.isArray(row.seed) ? row.seed[0] : row.seed
      if (!seed) continue
      all.push({
        queue_id: row.id,
        hit_level: row.hit_level,
        missing_fields: row.missing_fields,
        enriched_payload: row.enriched_payload,
        lemma: seed.lemma,
        pos: seed.pos,
      })
      if (all.length >= cap) break
    }

    if (page.length < fetchSize) break
    offset += fetchSize
  }

  return all
}

function buildJobLine(row: PendingRow, contextHint: string | null): EnrichmentJobLine {
  const isPartial = row.hit_level === 'partial'
  return {
    queue_id: row.queue_id,
    lemma: row.lemma,
    pos: row.pos,
    missing_fields: isPartial ? row.missing_fields : null,
    existing_payload: isPartial ? row.enriched_payload : null,
    context_hint: contextHint,
  }
}

async function markExported(
  client: SupabaseClient,
  queueIds: number[],
  exportedFile: string,
): Promise<void> {
  const exportedAt = new Date().toISOString()
  const CHUNK = 200
  for (let i = 0; i < queueIds.length; i += CHUNK) {
    const slice = queueIds.slice(i, i + CHUNK)
    const { error } = await client
      .from('vocab_enrichment_queue')
      .update({
        status: 'exported',
        exported_job_file: exportedFile,
        exported_at: exportedAt,
      })
      .in('id', slice)
    if (error) {
      throw new Error(`mark exported failed (chunk start ${i}): ${error.message}`)
    }
  }
}

async function updateRunStatus(
  client: SupabaseClient,
  runId: number,
  status: string,
): Promise<void> {
  const { error } = await client.from('vocab_runs').update({ status }).eq('id', runId)
  if (error) throw new Error(`run status update failed: ${error.message}`)
}

/**
 * Export pending queue items to one or more JSONL files (chunked).
 * Marks exported rows + transitions run to 'enriching' status.
 */
export async function exportEnrichmentJob(
  client: SupabaseClient,
  runId: number,
  opts: ExportJobOptions = {},
): Promise<ExportJobResult> {
  try {
    const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE
    if (chunkSize <= 0 || chunkSize > 1000) {
      return { ok: false, error: `chunkSize must be 1..1000 (got ${chunkSize})` }
    }

    const slugResult = await fetchRunSlug(client, runId)
    if (!slugResult.ok || !slugResult.slug) {
      return { ok: false, error: slugResult.error }
    }
    const slug = slugResult.slug

    const pending = await fetchPending(client, runId, opts.limit ?? null)
    if (pending.length === 0) {
      return { ok: true, pending_count: 0, files: [] }
    }

    await updateRunStatus(client, runId, 'enriching')

    const jobsDir = getVcbJobsDir()
    const ts = timestampPrefix()
    const totalChunks = Math.ceil(pending.length / chunkSize)
    const baseName = jobFileName.pending(slug, ts)
    const files: ExportedFile[] = []

    for (let i = 0; i < pending.length; i += chunkSize) {
      const chunk = pending.slice(i, i + chunkSize)
      const chunkIdx = Math.floor(i / chunkSize) + 1

      const fileName =
        totalChunks > 1
          ? baseName.replace(
              /-pending\.jsonl$/,
              `-pending-${String(chunkIdx).padStart(2, '0')}of${String(totalChunks).padStart(2, '0')}.jsonl`,
            )
          : baseName
      const filePath = path.join(jobsDir, fileName)

      const lines = chunk.map((row) =>
        JSON.stringify(buildJobLine(row, opts.contextHint ?? null)),
      )
      writeUtf8Lf(filePath, lines)

      await markExported(
        client,
        chunk.map((c) => c.queue_id),
        filePath,
      )

      files.push({
        path: filePath,
        basename: fileName,
        count: chunk.length,
        chunk: chunkIdx,
        total_chunks: totalChunks,
      })
    }

    return { ok: true, pending_count: pending.length, files }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
