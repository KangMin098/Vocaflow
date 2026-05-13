// scripts/vcb/06-qa.ts
// VCB Step 6 — QA Gate: enriched 상태 queue 의 payload 를 R1~R8 적용,
// qa_flags 적재 + status 전환 (enriched_flagged | failed | enriched 유지).
//
// 사용:
//   pnpm vcb:qa --run-id <id>
//   pnpm vcb:qa --run-id <id> --requeue-flagged
//
// CLAUDE.md §19.6 정합.

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { runQaGate, type QaItem } from '@vocaflow/wlp'
import {
  getSupabaseAdmin,
  createLogger,
  IngestError,
  qaResultToQueueStatus,
  findMonorepoRoot,
  mapVcbToSharedDictPos,
  type Pos,
} from '@vocaflow/vcb-core'

const log = createLogger({ script: '06-qa' })

interface QaOptions {
  runId: number
  requeueFlagged: boolean
}

interface QueueWithSeed {
  id: number
  status: string
  enriched_payload: Record<string, unknown> | null
  qa_flags: string[]
  seed: {
    lemma: string
    pos: Pos
  }
}

interface DenylistFile {
  version: string
  categories?: Record<string, string[]>
  english?: string[]
  korean?: string[]
}

function loadDenylist(filename: string): string[] {
  try {
    const root = findMonorepoRoot()
    const filePath = path.join(root, 'scripts', 'vcb', 'data', filename)
    if (!fs.existsSync(filePath)) {
      log.warn({ filename }, 'denylist file missing — using empty list')
      return []
    }
    const content = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(content) as DenylistFile
    const all: string[] = []

    if (parsed.categories) {
      for (const list of Object.values(parsed.categories)) {
        if (Array.isArray(list)) all.push(...list)
      }
    }
    if (Array.isArray(parsed.english)) all.push(...parsed.english)
    if (Array.isArray(parsed.korean)) all.push(...parsed.korean)

    return all
  } catch (err) {
    log.warn(
      { filename, err: err instanceof Error ? err.message : err },
      'denylist load failed — using empty list'
    )
    return []
  }
}

async function fetchEnrichedQueue(runId: number): Promise<QueueWithSeed[]> {
  const sb = getSupabaseAdmin()
  const PAGE_SIZE = 500
  const all: QueueWithSeed[] = []
  let offset = 0

  while (true) {
    const { data, error } = await sb
      .from('vocab_enrichment_queue')
      .select(
        `
        id,
        status,
        enriched_payload,
        qa_flags,
        seed:vocab_seed_candidates!inner(
          run_id,
          lemma,
          pos
        )
      `
      )
      .in('status', ['enriched', 'enriched_flagged'])
      .eq('seed.run_id', runId)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      throw new IngestError('fetch queue failed', {
        run_id: runId,
        offset,
        error: error.message,
      })
    }
    const page = (data ?? []) as unknown as QueueWithSeed[]
    if (page.length === 0) break
    all.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}

/**
 * shared_dictionary 에서 frequency_rank 조회 (R5 검사용).
 */
async function fetchNgslRanks(
  pairs: Array<{ lemma: string; pos: Pos }>
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>()
  if (pairs.length === 0) return map

  const sb = getSupabaseAdmin()
  const CHUNK = 200

  for (let i = 0; i < pairs.length; i += CHUNK) {
    const slice = pairs.slice(i, i + CHUNK)
    const lemmas = [...new Set(slice.map((p) => p.lemma))]

    const { data, error } = await sb
      .from('shared_dictionary')
      .select('word, pos, frequency_rank')
      .in('word', lemmas)

    if (error) {
      log.warn(
        { chunk_start: i, error: error.message },
        'frequency_rank fetch failed — R5 will be skipped for this chunk'
      )
      continue
    }

    const rows = (data ?? []) as Array<{ word: string; pos: string; frequency_rank: number | null }>
    for (const pair of slice) {
      const targetSharedPos = mapVcbToSharedDictPos(pair.pos)
      const row = rows.find((r) => r.word === pair.lemma && r.pos === targetSharedPos)
      map.set(`${pair.lemma}|${pair.pos}`, row?.frequency_rank ?? null)
    }
  }
  return map
}

function buildQaItem(row: QueueWithSeed): QaItem | null {
  if (!row.enriched_payload) return null
  const p = row.enriched_payload as Record<string, unknown>

  return {
    queue_id: row.id,
    lemma: row.seed.lemma,
    pos: row.seed.pos,
    ipa: (p.ipa as string | null) ?? null,
    cefr: (p.cefr as string | null) ?? null,
    definitions_ko: (p.definitions_ko as QaItem['definitions_ko']) ?? [],
    definitions_en: (p.definitions_en as QaItem['definitions_en']) ?? [],
    examples: (p.examples as QaItem['examples']) ?? [],
    synonyms: (p.synonyms as string[]) ?? [],
    antonyms: (p.antonyms as string[]) ?? [],
    collocations: (p.collocations as string[]) ?? [],
    korean_learner_note: (p.korean_learner_note as string | null) ?? null,
    confidence: typeof p.confidence === 'number' ? p.confidence : 0,
  }
}

async function updateQueueRow(opts: {
  queueId: number
  status: 'enriched' | 'enriched_flagged' | 'failed'
  qaFlags: string[]
  fixedPayload: Record<string, unknown> | null
  lastError: string | null
}): Promise<void> {
  const sb = getSupabaseAdmin()
  const update: Record<string, unknown> = {
    status: opts.status,
    qa_flags: opts.qaFlags,
    last_error: opts.lastError,
  }
  if (opts.fixedPayload !== null) {
    update.enriched_payload = opts.fixedPayload
  }

  const { error } = await sb
    .from('vocab_enrichment_queue')
    .update(update)
    .eq('id', opts.queueId)

  if (error) {
    throw new IngestError('queue update failed', {
      queue_id: opts.queueId,
      error: error.message,
    })
  }
}

async function updateRunStatus(runId: number, status: string): Promise<void> {
  const sb = getSupabaseAdmin()
  const { error } = await sb
    .from('vocab_runs')
    .update({ status })
    .eq('id', runId)
  if (error) {
    throw new IngestError('run status update failed', {
      run_id: runId,
      error: error.message,
    })
  }
}

async function requeueFlaggedItems(runId: number): Promise<number> {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('vocab_enrichment_queue')
    .update({ status: 'pending', retry_count: 1 })
    .eq('status', 'enriched_flagged')
    .in(
      'seed_id',
      (
        await sb
          .from('vocab_seed_candidates')
          .select('id')
          .eq('run_id', runId)
      ).data?.map((r) => r.id) ?? []
    )
    .select('id')

  if (error) {
    throw new IngestError('requeue failed', { run_id: runId, error: error.message })
  }
  return data?.length ?? 0
}

async function run(opts: QaOptions): Promise<void> {
  const childLog = log.child({ run_id: opts.runId })
  childLog.info('qa started')

  const brandDenylist = loadDenylist('brand-denylist.json')
  const profanityDenylist = loadDenylist('profanity-denylist.json')
  const combinedDenylist = [...brandDenylist, ...profanityDenylist]

  childLog.info(
    {
      brand_count: brandDenylist.length,
      profanity_count: profanityDenylist.length,
    },
    'denylists loaded'
  )

  const rows = await fetchEnrichedQueue(opts.runId)
  if (rows.length === 0) {
    childLog.warn('no enriched queue items found')
    return
  }
  childLog.info({ count: rows.length }, 'enriched queue fetched')

  await updateRunStatus(opts.runId, 'qa')

  const pairs = rows
    .filter((r) => r.enriched_payload !== null)
    .map((r) => ({ lemma: r.seed.lemma, pos: r.seed.pos }))
  const ngslRankMap = await fetchNgslRanks(pairs)
  childLog.info({ ngsl_loaded: ngslRankMap.size }, 'NGSL ranks loaded')

  const stats = {
    passed: 0,
    flagged: 0,
    failed: 0,
    autofixed: 0,
    payloadMissing: 0,
  }

  for (const row of rows) {
    const qaItem = buildQaItem(row)
    if (!qaItem) {
      stats.payloadMissing += 1
      await updateQueueRow({
        queueId: row.id,
        status: 'failed',
        qaFlags: ['R1'],
        fixedPayload: null,
        lastError: 'enriched_payload is null',
      })
      continue
    }

    const ngslRank = ngslRankMap.get(`${qaItem.lemma}|${qaItem.pos}`) ?? null
    const result = runQaGate(qaItem, {
      ngslRank,
      profanityDenylist: combinedDenylist,
    })

    const newStatus = qaResultToQueueStatus(result)
    const flagCodes = result.flags.map((f) => f.code)
    const uniqueCodes = [...new Set(flagCodes)]
    const hasFix = result.fixed_item !== undefined

    const lastError = result.passed
      ? null
      : result.flags
          .filter((f) => f.severity === 'reject')
          .map((f) => `${f.code}: ${f.message}`)
          .join('; ')

    await updateQueueRow({
      queueId: row.id,
      status: newStatus,
      qaFlags: uniqueCodes,
      fixedPayload: hasFix ? (result.fixed_item as Record<string, unknown>) : null,
      lastError,
    })

    if (newStatus === 'enriched') stats.passed += 1
    else if (newStatus === 'enriched_flagged') stats.flagged += 1
    else if (newStatus === 'failed') stats.failed += 1
    if (hasFix) stats.autofixed += 1
  }

  childLog.info(stats, 'qa completed')

  if (opts.requeueFlagged) {
    const requeued = await requeueFlaggedItems(opts.runId)
    childLog.info({ requeued }, 'flagged items requeued to pending')
  }

  childLog.info('qa run finished')
}

function parseCliArgs(): QaOptions {
  const { values } = parseArgs({
    options: {
      'run-id': { type: 'string' },
      'requeue-flagged': { type: 'boolean' },
    },
  })

  if (!values['run-id']) {
    throw new IngestError('--run-id is required')
  }

  return {
    runId: parseInt(values['run-id'], 10),
    requeueFlagged: values['requeue-flagged'] === true,
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
              code: (err as { code?: string }).code,
              context: (err as { context?: unknown }).context,
            }
          : err,
    },
    'qa failed'
  )
  process.exit(1)
})
