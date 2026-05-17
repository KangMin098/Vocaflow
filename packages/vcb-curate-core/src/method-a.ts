// packages/vcb-curate-core/src/method-a.ts
// VCB Method A — Step 2 (Ingest) + Step 3 (Extract) combined.
//
// Method A pipeline reduced to a single core operation: download from Storage
// → SHA-256 dedup → vocab_raw_texts insert → NFC normalize → WLP extract →
// (lemma, pos) aggregation → vocab_seed_candidates upsert → status='extracted'.
//
// Step 2.b Normalize (02-normalize.ts) is a noop in P2 (sanity check only),
// so it's folded into this combined flow. WLP does the real normalization.

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createDropStats,
  mapWlpPos,
  recordDrop,
  type Pos,
  type PosDropStats,
} from '@vocaflow/vcb-core'
import { processText, type WlpToken } from '@vocaflow/wlp'

const STORAGE_BUCKET = 'vocab-sources-raw'
const MAX_CONTEXT_SAMPLES = 3
const MAX_CONTEXT_LENGTH = 200

export interface MethodASourceListItem {
  source_id: number
  slug: string
  title: string
  license_tier: 'T1' | 'T2' | 'T3'
  storage_key: string | null
  already_ingested: boolean
  raw_text_id: number | null
}

export interface MethodAExtractResult {
  ok: boolean
  inserted_raw_text: boolean
  raw_text_id?: number
  bytes?: number
  content_hash_prefix?: string
  total_tokens?: number
  content_tokens?: number
  unique_lemmas?: number
  candidates_inserted?: number
  candidates_skipped?: number
  drop_stats?: PosDropStats
  duration_ms?: number
  error?: string
}

function extractStorageKey(notes: string | null): string | null {
  if (!notes) return null
  const m = notes.match(/^storage_key=([^\n]+)$/m)
  return m ? m[1]!.trim() : null
}

/**
 * List all sources visible to admin + flag whether each has been ingested
 * into the given run already.
 */
export async function listMethodASources(
  client: SupabaseClient,
  runId: number,
): Promise<MethodASourceListItem[]> {
  const { data: sources, error: srcErr } = await client
    .from('vocab_sources')
    .select('id, slug, title, license_tier, notes, kind')
    .neq('kind', 'ai_generated')
    .order('created_at', { ascending: false })

  if (srcErr) {
    throw new Error(`fetch sources failed: ${srcErr.message}`)
  }

  const rows = (sources ?? []) as unknown as Array<{
    id: number
    slug: string
    title: string
    license_tier: 'T1' | 'T2' | 'T3'
    notes: string | null
  }>

  if (rows.length === 0) return []

  const sourceIds = rows.map((r) => r.id)

  const { data: ingested, error: ingErr } = await client
    .from('vocab_raw_texts')
    .select('id, source_id')
    .eq('run_id', runId)
    .in('source_id', sourceIds)

  if (ingErr) {
    throw new Error(`fetch ingested check failed: ${ingErr.message}`)
  }

  const ingestedMap = new Map<number, number>()
  for (const row of (ingested ?? []) as unknown as Array<{
    id: number
    source_id: number
  }>) {
    ingestedMap.set(row.source_id, row.id)
  }

  return rows.map((r): MethodASourceListItem => ({
    source_id: r.id,
    slug: r.slug,
    title: r.title,
    license_tier: r.license_tier,
    storage_key: extractStorageKey(r.notes),
    already_ingested: ingestedMap.has(r.id),
    raw_text_id: ingestedMap.get(r.id) ?? null,
  }))
}

function extractContext(fullText: string, charStart: number, charEnd: number): string {
  const halfWindow = Math.floor((MAX_CONTEXT_LENGTH - (charEnd - charStart)) / 2)
  const rawStart = Math.max(0, charStart - halfWindow)
  const rawEnd = Math.min(fullText.length, charEnd + halfWindow)
  let start = rawStart
  while (start > 0 && !/\s/.test(fullText.charAt(start - 1))) start -= 1
  let end = rawEnd
  while (end < fullText.length && !/\s/.test(fullText.charAt(end))) end += 1
  let snippet = fullText.slice(start, end).trim()
  if (snippet.length > MAX_CONTEXT_LENGTH) {
    snippet = snippet.slice(0, MAX_CONTEXT_LENGTH - 1) + '…'
  }
  return snippet
}

interface SeedAccumulator {
  count: number
  contextSamples: string[]
  firstSeenOffset: number
}

function aggregateTokens(
  text: string,
  tokens: WlpToken[],
): {
  map: Map<string, { lemma: string; pos: Pos; data: SeedAccumulator }>
  dropStats: PosDropStats
} {
  const dropStats = createDropStats()
  const map = new Map<string, { lemma: string; pos: Pos; data: SeedAccumulator }>()

  for (const tok of tokens) {
    if (!tok.lemma || tok.lemma.length === 0) {
      recordDrop(dropStats, 'EMPTY_LEMMA')
      continue
    }
    const vcbPos = mapWlpPos(tok.pos)
    if (vcbPos === null) {
      recordDrop(dropStats, tok.pos)
      continue
    }

    const key = `${tok.lemma}|${vcbPos}`
    const existing = map.get(key)
    if (existing) {
      existing.data.count += 1
      if (existing.data.contextSamples.length < MAX_CONTEXT_SAMPLES) {
        const snippet = extractContext(text, tok.charStart, tok.charEnd)
        if (snippet && !existing.data.contextSamples.includes(snippet)) {
          existing.data.contextSamples.push(snippet)
        }
      }
    } else {
      const snippet = extractContext(text, tok.charStart, tok.charEnd)
      map.set(key, {
        lemma: tok.lemma,
        pos: vcbPos,
        data: {
          count: 1,
          contextSamples: snippet ? [snippet] : [],
          firstSeenOffset: tok.charStart,
        },
      })
    }
  }

  return { map, dropStats }
}

async function downloadFromStorage(
  client: SupabaseClient,
  storageKey: string,
): Promise<Buffer> {
  const { data, error } = await client.storage.from(STORAGE_BUCKET).download(storageKey)
  if (error || !data) {
    throw new Error(`storage download failed (${storageKey}): ${error?.message ?? 'unknown'}`)
  }
  return Buffer.from(await data.arrayBuffer())
}

async function insertRawText(
  client: SupabaseClient,
  opts: {
    runId: number
    sourceId: number
    externalRef: string
    content: Buffer
  },
): Promise<{ inserted: boolean; rawId: number | null }> {
  const contentHash = createHash('sha256').update(opts.content).digest('hex')
  const contentBytes = opts.content.byteLength

  const { data, error } = await client
    .from('vocab_raw_texts')
    .upsert(
      {
        run_id: opts.runId,
        source_id: opts.sourceId,
        external_ref: opts.externalRef,
        content_hash: contentHash,
        content_bytes: contentBytes,
      },
      { onConflict: 'run_id,content_hash', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(`insert raw_text failed: ${error.message}`)
  }

  if (data) {
    return { inserted: true, rawId: (data as { id: number }).id }
  }
  return { inserted: false, rawId: null }
}

async function persistCandidates(
  client: SupabaseClient,
  runId: number,
  aggregated: Map<string, { lemma: string; pos: Pos; data: SeedAccumulator }>,
): Promise<{ inserted: number; skipped: number }> {
  const entries = Array.from(aggregated.values()).sort((a, b) => {
    if (b.data.count !== a.data.count) return b.data.count - a.data.count
    return a.data.firstSeenOffset - b.data.firstSeenOffset
  })

  const rows = entries.map((e, idx) => ({
    run_id: runId,
    lemma: e.lemma,
    pos: e.pos,
    raw_count: e.data.count,
    normalized_freq: null,
    rank_in_run: idx + 1,
    context_samples: e.data.contextSamples,
    seed_origin: 'extracted' as const,
  }))

  if (rows.length === 0) return { inserted: 0, skipped: 0 }

  const { data, error } = await client
    .from('vocab_seed_candidates')
    .upsert(rows, {
      onConflict: 'run_id,lemma,pos',
      ignoreDuplicates: true,
    })
    .select('id')

  if (error) {
    throw new Error(`seed_candidates insert failed: ${error.message}`)
  }

  const inserted = data?.length ?? 0
  return { inserted, skipped: rows.length - inserted }
}

async function updateRunStatus(
  client: SupabaseClient,
  runId: number,
  status: string,
): Promise<void> {
  const { error } = await client.from('vocab_runs').update({ status }).eq('id', runId)
  if (error) throw new Error(`run status update failed: ${error.message}`)
}

async function fetchSource(
  client: SupabaseClient,
  sourceId: number,
): Promise<{
  id: number
  notes: string | null
  license_tier: 'T1' | 'T2' | 'T3'
  kind: string
}> {
  const { data, error } = await client
    .from('vocab_sources')
    .select('id, notes, license_tier, kind')
    .eq('id', sourceId)
    .maybeSingle()

  if (error || !data) {
    throw new Error(`source #${sourceId} not found: ${error?.message ?? 'not found'}`)
  }
  return data as unknown as {
    id: number
    notes: string | null
    license_tier: 'T1' | 'T2' | 'T3'
    kind: string
  }
}

/**
 * Combined Method A ingest + extract for a single source.
 *
 * Pipeline:
 *   1. Fetch source, validate not T3 (license gate)
 *   2. Resolve storage_key from source.notes
 *   3. Download file from vocab-sources-raw bucket
 *   4. SHA-256 dedup → insert vocab_raw_texts
 *   5. NFC normalize → WLP processText
 *   6. Aggregate by (lemma, pos) → upsert vocab_seed_candidates
 *   7. Transition run.status → 'extracted'
 */
export async function runMethodAExtract(
  client: SupabaseClient,
  runId: number,
  sourceId: number,
): Promise<MethodAExtractResult> {
  const started = Date.now()
  try {
    const source = await fetchSource(client, sourceId)
    if (source.license_tier === 'T3') {
      return { ok: false, inserted_raw_text: false, error: 'T3 source cannot be ingested' }
    }
    if (source.kind === 'ai_generated') {
      return {
        ok: false,
        inserted_raw_text: false,
        error: 'ai_generated source uses Method B flow, not Method A',
      }
    }

    const storageKey = extractStorageKey(source.notes)
    if (!storageKey) {
      return {
        ok: false,
        inserted_raw_text: false,
        error: 'no storage_key in source.notes — re-upload the file',
      }
    }

    await updateRunStatus(client, runId, 'ingesting')

    const content = await downloadFromStorage(client, storageKey)
    if (content.byteLength === 0) {
      return { ok: false, inserted_raw_text: false, error: 'storage file is empty' }
    }

    const rawResult = await insertRawText(client, {
      runId,
      sourceId,
      externalRef: storageKey,
      content,
    })

    const hashPrefix = createHash('sha256').update(content).digest('hex').slice(0, 12)
    const text = content.toString('utf8').normalize('NFC')

    if (text.trim().length === 0) {
      return {
        ok: false,
        inserted_raw_text: rawResult.inserted,
        raw_text_id: rawResult.rawId ?? undefined,
        bytes: content.byteLength,
        content_hash_prefix: hashPrefix,
        error: 'file decoded to empty text',
      }
    }

    const wlpResult = processText(text, {
      excludeStopWords: true,
      excludePunctuation: true,
      minLemmaLength: 2,
    })

    const allTokens: WlpToken[] = []
    for (const sentence of wlpResult.sentences) {
      for (const tok of sentence.tokens) allTokens.push(tok)
    }

    const { map: aggregated, dropStats } = aggregateTokens(text, allTokens)
    const { inserted, skipped } = await persistCandidates(client, runId, aggregated)

    await updateRunStatus(client, runId, 'extracted')

    return {
      ok: true,
      inserted_raw_text: rawResult.inserted,
      raw_text_id: rawResult.rawId ?? undefined,
      bytes: content.byteLength,
      content_hash_prefix: hashPrefix,
      total_tokens: wlpResult.stats.totalTokens,
      content_tokens: wlpResult.stats.contentTokens,
      unique_lemmas: aggregated.size,
      candidates_inserted: inserted,
      candidates_skipped: skipped,
      drop_stats: dropStats,
      duration_ms: Date.now() - started,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      inserted_raw_text: false,
      error: msg,
      duration_ms: Date.now() - started,
    }
  }
}
