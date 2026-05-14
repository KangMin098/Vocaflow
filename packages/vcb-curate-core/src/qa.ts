// packages/vcb-curate-core/src/qa.ts
// VCB Step 6 QA Gate — DB-only, R1~R8 rules from @vocaflow/wlp.
// Shared between CLI (scripts/vcb/06-qa.ts) and Server Action.

import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runQaGate, type QaItem } from '@vocaflow/wlp'
import {
  findMonorepoRoot,
  mapVcbToSharedDictPos,
  qaResultToQueueStatus,
  type Pos,
} from '@vocaflow/vcb-core'

export interface QaSummary {
  total: number
  passed: number
  flagged: number
  failed: number
  autofixed: number
  payload_missing: number
  requeued: number
  duration_ms: number
  denylist_counts: { brand: number; profanity: number }
  ngsl_loaded: number
}

export interface QaResult {
  ok: boolean
  summary?: QaSummary
  error?: string
}

export interface QaOptions {
  /** Move enriched_flagged items back to 'pending' for re-enrichment. */
  requeueFlagged?: boolean
}

interface DenylistFile {
  version?: string
  categories?: Record<string, string[]>
  english?: string[]
  korean?: string[]
}

function loadDenylist(filename: string): string[] {
  try {
    const root = findMonorepoRoot()
    const filePath = path.join(root, 'scripts', 'vcb', 'data', filename)
    if (!fs.existsSync(filePath)) return []
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as DenylistFile
    const all: string[] = []
    if (parsed.categories) {
      for (const list of Object.values(parsed.categories)) {
        if (Array.isArray(list)) all.push(...list)
      }
    }
    if (Array.isArray(parsed.english)) all.push(...parsed.english)
    if (Array.isArray(parsed.korean)) all.push(...parsed.korean)
    return all
  } catch {
    return []
  }
}

interface QueueWithSeed {
  id: number
  status: string
  enriched_payload: Record<string, unknown> | null
  qa_flags: string[]
  seed: { lemma: string; pos: Pos } | Array<{ lemma: string; pos: Pos }>
}

async function fetchEnrichedQueue(
  client: SupabaseClient,
  runId: number,
): Promise<Array<{ id: number; payload: Record<string, unknown> | null; lemma: string; pos: Pos }>> {
  const PAGE_SIZE = 500
  const out: Array<{
    id: number
    payload: Record<string, unknown> | null
    lemma: string
    pos: Pos
  }> = []
  let offset = 0

  while (true) {
    const { data, error } = await client
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
        `,
      )
      .in('status', ['enriched', 'enriched_flagged'])
      .eq('seed.run_id', runId)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`fetch queue failed: ${error.message}`)
    }
    const page = (data ?? []) as unknown as QueueWithSeed[]
    if (page.length === 0) break
    for (const row of page) {
      const seed = Array.isArray(row.seed) ? row.seed[0] : row.seed
      if (!seed) continue
      out.push({
        id: row.id,
        payload: row.enriched_payload,
        lemma: seed.lemma,
        pos: seed.pos,
      })
    }
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return out
}

async function fetchNgslRanks(
  client: SupabaseClient,
  pairs: Array<{ lemma: string; pos: Pos }>,
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>()
  if (pairs.length === 0) return map
  const CHUNK = 200

  for (let i = 0; i < pairs.length; i += CHUNK) {
    const slice = pairs.slice(i, i + CHUNK)
    const lemmas = [...new Set(slice.map((p) => p.lemma))]

    const { data, error } = await client
      .from('shared_dictionary')
      .select('word, pos, frequency_rank')
      .in('word', lemmas)

    if (error) continue
    const rows = (data ?? []) as unknown as Array<{
      word: string
      pos: string
      frequency_rank: number | null
    }>
    for (const pair of slice) {
      const targetPos = mapVcbToSharedDictPos(pair.pos)
      const row = rows.find((r) => r.word === pair.lemma && r.pos === targetPos)
      map.set(`${pair.lemma}|${pair.pos}`, row?.frequency_rank ?? null)
    }
  }
  return map
}

function buildQaItem(row: {
  id: number
  payload: Record<string, unknown> | null
  lemma: string
  pos: Pos
}): QaItem | null {
  if (!row.payload) return null
  const p = row.payload
  return {
    queue_id: row.id,
    lemma: row.lemma,
    pos: row.pos,
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

async function updateQueueRow(
  client: SupabaseClient,
  opts: {
    queueId: number
    status: 'enriched' | 'enriched_flagged' | 'failed'
    qaFlags: string[]
    fixedPayload: Record<string, unknown> | null
    lastError: string | null
  },
): Promise<void> {
  const update: Record<string, unknown> = {
    status: opts.status,
    qa_flags: opts.qaFlags,
    last_error: opts.lastError,
  }
  if (opts.fixedPayload !== null) update.enriched_payload = opts.fixedPayload

  const { error } = await client
    .from('vocab_enrichment_queue')
    .update(update)
    .eq('id', opts.queueId)

  if (error) {
    throw new Error(`queue update failed (queue_id=${opts.queueId}): ${error.message}`)
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

async function requeueFlaggedItems(
  client: SupabaseClient,
  runId: number,
): Promise<number> {
  const { data: seedRows, error: seedErr } = await client
    .from('vocab_seed_candidates')
    .select('id')
    .eq('run_id', runId)
  if (seedErr) throw new Error(`fetch seed_ids failed: ${seedErr.message}`)

  const seedIds = ((seedRows ?? []) as unknown as Array<{ id: number }>).map((r) => r.id)
  if (seedIds.length === 0) return 0

  const { data, error } = await client
    .from('vocab_enrichment_queue')
    .update({ status: 'pending', retry_count: 1 })
    .eq('status', 'enriched_flagged')
    .in('seed_id', seedIds)
    .select('id')

  if (error) throw new Error(`requeue failed: ${error.message}`)
  return ((data ?? []) as unknown as Array<{ id: number }>).length
}

export async function performQaGate(
  client: SupabaseClient,
  runId: number,
  opts: QaOptions = {},
): Promise<QaResult> {
  try {
    const started = Date.now()

    const brandDenylist = loadDenylist('brand-denylist.json')
    const profanityDenylist = loadDenylist('profanity-denylist.json')
    const combinedDenylist = [...brandDenylist, ...profanityDenylist]

    const rows = await fetchEnrichedQueue(client, runId)
    if (rows.length === 0) {
      return { ok: false, error: 'no enriched queue items found — run enrichment + import first' }
    }

    await updateRunStatus(client, runId, 'qa')

    const pairs = rows
      .filter((r) => r.payload !== null)
      .map((r) => ({ lemma: r.lemma, pos: r.pos }))
    const ngslRankMap = await fetchNgslRanks(client, pairs)

    let passed = 0
    let flagged = 0
    let failed = 0
    let autofixed = 0
    let payloadMissing = 0

    for (const row of rows) {
      const qaItem = buildQaItem(row)
      if (!qaItem) {
        payloadMissing++
        await updateQueueRow(client, {
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

      const newStatus = qaResultToQueueStatus(
        result as unknown as Parameters<typeof qaResultToQueueStatus>[0],
      )
      const flagCodes = result.flags.map((f) => f.code)
      const uniqueCodes = [...new Set(flagCodes)]
      const hasFix = result.fixed_item !== undefined

      const lastError = result.passed
        ? null
        : result.flags
            .filter((f) => f.severity === 'reject')
            .map((f) => `${f.code}: ${f.message}`)
            .join('; ')

      await updateQueueRow(client, {
        queueId: row.id,
        status: newStatus,
        qaFlags: uniqueCodes,
        fixedPayload: hasFix
          ? (result.fixed_item as unknown as Record<string, unknown>)
          : null,
        lastError,
      })

      if (newStatus === 'enriched') passed++
      else if (newStatus === 'enriched_flagged') flagged++
      else if (newStatus === 'failed') failed++
      if (hasFix) autofixed++
    }

    let requeued = 0
    if (opts.requeueFlagged) {
      requeued = await requeueFlaggedItems(client, runId)
    }

    return {
      ok: true,
      summary: {
        total: rows.length,
        passed,
        flagged,
        failed,
        autofixed,
        payload_missing: payloadMissing,
        requeued,
        duration_ms: Date.now() - started,
        denylist_counts: {
          brand: brandDenylist.length,
          profanity: profanityDenylist.length,
        },
        ngsl_loaded: ngslRankMap.size,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
