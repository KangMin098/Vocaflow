// scripts/vcb/05a-export-job.ts
// VCB Step 5a — pending queue 를 200개씩 JSONL 로 export.
//
// 사용:
//   pnpm vcb:export-job --run-id <id>
//   pnpm vcb:export-job --run-id <id> --chunk-size 200 --limit 1000
//
// CLAUDE.md §19.5 정합. chunk-size 200 (자동 분할).

import {
  createLogger,
  getSupabaseAdmin,
  getVcbJobsDir,
  IngestError,
  jobFileName,
  timestampPrefix,
  writeUtf8Lf,
  type DictHitLevel,
  type EnrichmentJobLine,
  type Pos,
} from '@vocaflow/vcb-core'
import path from 'node:path'
import { parseArgs } from 'node:util'

const log = createLogger({ script: '05a-export-job' })

const DEFAULT_CHUNK_SIZE = 200

interface ExportJobOptions {
  runId: number
  chunkSize: number
  limit: number | null
  contextHint: string | null
}

interface PendingRow {
  queue_id: number
  hit_level: DictHitLevel | null
  missing_fields: string[] | null
  enriched_payload: Record<string, unknown> | null // partial 의 경우 existing payload 보존
  lemma: string
  pos: Pos
}

async function fetchRun(runId: number): Promise<{
  collection_slug: string
}> {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('vocab_runs')
    .select('collection_slug')
    .eq('id', runId)
    .single()

  if (error || !data) {
    throw new IngestError('run not found', { run_id: runId, error: error?.message })
  }
  return data
}

async function fetchPending(opts: { runId: number; limit: number | null }): Promise<PendingRow[]> {
  const sb = getSupabaseAdmin()
  const PAGE_SIZE = 1000
  const all: PendingRow[] = []
  let offset = 0
  const cap = opts.limit ?? Infinity

  while (all.length < cap) {
    const remaining = cap - all.length
    const fetchSize = Math.min(PAGE_SIZE, remaining)

    // queue + seed_candidates + dict_hits 조인
    const { data, error } = await sb
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
      `
      )
      .eq('status', 'pending')
      .eq('seed.run_id', opts.runId)
      .order('id', { ascending: true })
      .range(offset, offset + fetchSize - 1)

    if (error) {
      throw new IngestError('fetch pending failed', {
        run_id: opts.runId,
        offset,
        error: error.message,
      })
    }
    const page = data ?? []
    if (page.length === 0) break

    for (const row of page as Array<{
      id: number
      hit_level: DictHitLevel | null
      missing_fields: string[] | null
      enriched_payload: Record<string, unknown> | null
      seed: { lemma: string; pos: Pos }
    }>) {
      all.push({
        queue_id: row.id,
        hit_level: row.hit_level,
        missing_fields: row.missing_fields,
        enriched_payload: row.enriched_payload,
        lemma: row.seed.lemma,
        pos: row.seed.pos,
      })
      if (all.length >= cap) break
    }

    if (page.length < fetchSize) break
    offset += fetchSize
  }

  return all
}

function buildJobLine(row: PendingRow, contextHint: string | null): EnrichmentJobLine {
  // partial hit: 기존 payload 에 누락 필드만 받아오도록
  // miss: 전체 필드 요청 (missing_fields = null 의미)
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

async function markExported(queueIds: number[], exportedFile: string): Promise<void> {
  const sb = getSupabaseAdmin()
  const exportedAt = new Date().toISOString()

  // 200개씩 chunked update (Postgrest in() 제한 회피)
  const CHUNK = 200
  for (let i = 0; i < queueIds.length; i += CHUNK) {
    const slice = queueIds.slice(i, i + CHUNK)
    const { error } = await sb
      .from('vocab_enrichment_queue')
      .update({
        status: 'exported',
        exported_job_file: exportedFile,
        exported_at: exportedAt,
      })
      .in('id', slice)

    if (error) {
      throw new IngestError('mark exported failed', {
        chunk_start: i,
        error: error.message,
      })
    }
  }
}

async function updateRunStatus(runId: number, status: string): Promise<void> {
  const sb = getSupabaseAdmin()
  const { error } = await sb.from('vocab_runs').update({ status }).eq('id', runId)
  if (error) {
    throw new IngestError('run status update failed', {
      run_id: runId,
      error: error.message,
    })
  }
}

async function run(opts: ExportJobOptions): Promise<void> {
  const childLog = log.child({ run_id: opts.runId })
  childLog.info(
    { chunk_size: opts.chunkSize, limit: opts.limit, context_hint: opts.contextHint },
    'export-job started'
  )

  const runRow = await fetchRun(opts.runId)
  const pending = await fetchPending({ runId: opts.runId, limit: opts.limit })

  if (pending.length === 0) {
    childLog.warn('no pending queue items found')
    return
  }

  childLog.info({ pending_count: pending.length }, 'pending items fetched')

  await updateRunStatus(opts.runId, 'enriching')

  const jobsDir = getVcbJobsDir()
  const ts = timestampPrefix()
  const slug = runRow.collection_slug

  const generatedFiles: Array<{ path: string; count: number }> = []

  for (let i = 0; i < pending.length; i += opts.chunkSize) {
    const chunk = pending.slice(i, i + opts.chunkSize)
    const chunkIdx = Math.floor(i / opts.chunkSize) + 1
    const totalChunks = Math.ceil(pending.length / opts.chunkSize)

    // 파일명: <ts>-<slug>-pending-<chunkIdx>of<total>.jsonl
    const baseName = jobFileName.pending(slug, ts)
    const fileName =
      totalChunks > 1
        ? baseName.replace(
            /-pending\.jsonl$/,
            `-pending-${String(chunkIdx).padStart(2, '0')}of${String(totalChunks).padStart(2, '0')}.jsonl`
          )
        : baseName
    const filePath = path.join(jobsDir, fileName)

    const lines = chunk.map((row) => JSON.stringify(buildJobLine(row, opts.contextHint)))
    writeUtf8Lf(filePath, lines)

    await markExported(
      chunk.map((c) => c.queue_id),
      filePath
    )

    generatedFiles.push({ path: filePath, count: chunk.length })
    childLog.info(
      { chunk: `${chunkIdx}/${totalChunks}`, file: fileName, items: chunk.length },
      'chunk exported'
    )
  }

  childLog.info(
    {
      total_exported: pending.length,
      chunks: generatedFiles.length,
      files: generatedFiles.map((f) => path.basename(f.path)),
    },
    'export-job completed'
  )

  // 사용자 안내 (콘솔)
  console.log('\nGenerated files:')
  for (const f of generatedFiles) {
    console.log(`  ${f.path}  [${f.count} words]`)
  }
  console.log('\nRun in VS Code Claude Code:')
  for (const f of generatedFiles) {
    console.log(`  /vcb-enrich ${f.path}`)
  }
}

function parseCliArgs(): ExportJobOptions {
  const { values } = parseArgs({
    options: {
      'run-id': { type: 'string' },
      'chunk-size': { type: 'string' },
      limit: { type: 'string' },
      'context-hint': { type: 'string' },
    },
  })

  if (!values['run-id']) {
    throw new IngestError('--run-id is required')
  }

  const chunkSize = values['chunk-size'] ? parseInt(values['chunk-size'], 10) : DEFAULT_CHUNK_SIZE
  if (!Number.isFinite(chunkSize) || chunkSize <= 0 || chunkSize > 1000) {
    throw new IngestError('--chunk-size must be 1..1000', { chunk_size: chunkSize })
  }

  const limit = values.limit ? parseInt(values.limit, 10) : null
  if (limit !== null && (!Number.isFinite(limit) || limit <= 0)) {
    throw new IngestError('--limit must be positive integer', { limit })
  }

  return {
    runId: parseInt(values['run-id'], 10),
    chunkSize,
    limit,
    contextHint: values['context-hint'] ?? null,
  }
}

const opts = parseCliArgs()
run(opts).catch((err) => {
  log.error(
    {
      err:
        err instanceof Error
          ? {
              name: err.name,
              message: err.message,
              code: (err as any).code,
              context: (err as any).context,
            }
          : err,
    },
    'export-job failed'
  )
  process.exit(1)
})
