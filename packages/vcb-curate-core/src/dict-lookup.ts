// packages/vcb-curate-core/src/dict-lookup.ts
// VCB Step 4 Dictionary Lookup — DB-only, no LLM. Shared between CLI
// (scripts/vcb/04-dict-lookup.ts) and Server Action.
//
// Lookup order (CLAUDE.md §19.4 Step 4):
//   1. word_lexicon (lexicon-v2.1) — currently disabled
//   2. shared_dictionary — active
//   3. shared_words (post-publish cache) — naturally hit via #2 path

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapVcbToSharedDictPos,
  type DictHitLevel,
  type Pos,
  type VocabSeedCandidateRow,
} from '@vocaflow/vcb-core'

const REQUIRED_FIELDS = [
  'ipa',
  'cefr',
  'definitions_ko',
  'definitions_en',
  'examples',
  'synonyms',
  'antonyms',
  'collocations',
  'korean_learner_note',
] as const

const SHARED_DICT_PROVIDABLE_FIELDS = ['cefr', 'definitions_ko'] as const

const WORD_LEXICON_ENABLED = false

export interface LookupResult {
  hitLevel: DictHitLevel
  sourceTable: 'shared_dictionary' | 'word_lexicon' | null
  existingPayload: Record<string, unknown> | null
  missingFields: string[]
}

interface SharedDictRawRow {
  word: string
  pos: string
  meaning_ko: string | null
  meanings_ko: Array<{ pos: string; meaning: string }> | null
  cefr_level: string | null
  frequency_rank: number | null
  ngsl_sfi: number | null
}

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as object).length > 0
  return true
}

export async function lookupSharedDictionary(
  client: SupabaseClient,
  lemma: string,
  pos: Pos,
): Promise<LookupResult> {
  const sharedPos = mapVcbToSharedDictPos(pos)

  const { data, error } = await client
    .from('shared_dictionary')
    .select('word, pos, meaning_ko, meanings_ko, cefr_level, frequency_rank, ngsl_sfi')
    .eq('word', lemma)
    .eq('pos', sharedPos)
    .maybeSingle()

  if (error) {
    throw new Error(
      `shared_dictionary lookup failed: ${error.message} (lemma=${lemma}, pos=${pos})`,
    )
  }

  if (!data) {
    return {
      hitLevel: 'miss',
      sourceTable: null,
      existingPayload: null,
      missingFields: [...REQUIRED_FIELDS],
    }
  }

  const row = data as unknown as SharedDictRawRow

  const payload: Record<string, unknown> = {
    cefr: row.cefr_level,
    meanings_ko: row.meanings_ko,
    meaning_ko_primary: row.meaning_ko,
    frequency_rank: row.frequency_rank,
    ngsl_sfi: row.ngsl_sfi,
  }

  const missing: string[] = []
  if (!isFilled(row.cefr_level)) missing.push('cefr')
  if (!isFilled(row.meanings_ko)) missing.push('definitions_ko')
  for (const field of REQUIRED_FIELDS) {
    if (SHARED_DICT_PROVIDABLE_FIELDS.includes(field as 'cefr' | 'definitions_ko')) continue
    missing.push(field)
  }

  return {
    hitLevel: missing.length === REQUIRED_FIELDS.length ? 'miss' : 'partial',
    sourceTable: 'shared_dictionary',
    existingPayload: payload,
    missingFields: missing,
  }
}

export async function lookupWordLexicon(
  _client: SupabaseClient,
  _lemma: string,
  _pos: Pos,
): Promise<LookupResult | null> {
  if (!WORD_LEXICON_ENABLED) return null
  throw new Error('WORD_LEXICON_ENABLED=true but lookupWordLexicon not implemented')
}

async function fetchCandidates(
  client: SupabaseClient,
  runId: number,
): Promise<VocabSeedCandidateRow[]> {
  const PAGE_SIZE = 1000
  const all: VocabSeedCandidateRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await client
      .from('vocab_seed_candidates')
      .select('*')
      .eq('run_id', runId)
      .order('rank_in_run', { ascending: true, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`fetch candidates failed: ${error.message}`)
    }
    const page = (data ?? []) as unknown as VocabSeedCandidateRow[]
    all.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}

async function upsertDictHit(
  client: SupabaseClient,
  seedId: number,
  result: LookupResult,
): Promise<void> {
  const { error } = await client.from('vocab_dict_hits').upsert(
    {
      seed_id: seedId,
      hit_level: result.hitLevel,
      source_table: result.sourceTable,
      existing_payload: result.existingPayload,
      missing_fields: result.missingFields,
    },
    { onConflict: 'seed_id' },
  )
  if (error) {
    throw new Error(`dict_hit upsert failed (seed_id=${seedId}): ${error.message}`)
  }
}

async function upsertEnrichmentQueue(
  client: SupabaseClient,
  seedId: number,
  result: LookupResult,
): Promise<'pending' | 'enriched_full'> {
  if (result.hitLevel === 'full') {
    const { error } = await client.from('vocab_enrichment_queue').upsert(
      {
        seed_id: seedId,
        status: 'enriched',
        hit_level: 'full',
        missing_fields: [],
        enriched_payload: result.existingPayload,
        enriched_at: new Date().toISOString(),
        qa_flags: [],
      },
      { onConflict: 'seed_id' },
    )
    if (error) throw new Error(`queue upsert (full) failed (seed_id=${seedId}): ${error.message}`)
    return 'enriched_full'
  }

  const { error } = await client.from('vocab_enrichment_queue').upsert(
    {
      seed_id: seedId,
      status: 'pending',
      hit_level: result.hitLevel,
      missing_fields: result.missingFields,
      enriched_payload: null,
      qa_flags: [],
    },
    { onConflict: 'seed_id' },
  )
  if (error) throw new Error(`queue upsert (pending) failed (seed_id=${seedId}): ${error.message}`)
  return 'pending'
}

async function updateRunStatus(
  client: SupabaseClient,
  runId: number,
  status: string,
): Promise<void> {
  const { error } = await client.from('vocab_runs').update({ status }).eq('id', runId)
  if (error) throw new Error(`run status update failed: ${error.message}`)
}

export interface DictLookupSummary {
  total: number
  full_hits: number
  partial_hits: number
  misses: number
  queue_enriched_full: number
  queue_pending: number
  duration_ms: number
}

export interface DictLookupResult {
  ok: boolean
  summary?: DictLookupSummary
  error?: string
}

export async function performDictLookup(
  client: SupabaseClient,
  runId: number,
): Promise<DictLookupResult> {
  const started = Date.now()

  const candidates = await fetchCandidates(client, runId)
  if (candidates.length === 0) {
    return {
      ok: false,
      error: 'no seed_candidates found — run extract or import seed first',
    }
  }

  await updateRunStatus(client, runId, 'looked_up')

  let fullHits = 0
  let partialHits = 0
  let misses = 0
  let enrichedFull = 0
  let pending = 0

  for (const cand of candidates) {
    const lexResult = await lookupWordLexicon(client, cand.lemma, cand.pos)
    const result = lexResult ?? (await lookupSharedDictionary(client, cand.lemma, cand.pos))

    if (result.hitLevel === 'full') fullHits++
    else if (result.hitLevel === 'partial') partialHits++
    else misses++

    await upsertDictHit(client, cand.id, result)
    const queueResult = await upsertEnrichmentQueue(client, cand.id, result)
    if (queueResult === 'enriched_full') enrichedFull++
    else pending++
  }

  return {
    ok: true,
    summary: {
      total: candidates.length,
      full_hits: fullHits,
      partial_hits: partialHits,
      misses,
      queue_enriched_full: enrichedFull,
      queue_pending: pending,
      duration_ms: Date.now() - started,
    },
  }
}
