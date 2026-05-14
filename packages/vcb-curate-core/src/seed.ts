// packages/vcb-curate-core/src/seed.ts
// Method B (AI-generated seed) 비즈니스 로직. CLI(scripts/vcb/01b-ingest-ai-seed.ts)
// + Server Action(apps/web/src/lib/vcb/server/seed.ts) 양쪽 공유.
// 정합: CLAUDE.md §19.4b

import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SeedListItem, FrequencyTier, Pos, Cefr, Segment } from '@vocaflow/vcb-core'

// ── Validation ────────────────────────────────────

const VALID_POS: ReadonlySet<Pos> = new Set([
  'NOUN', 'VERB', 'ADJ', 'ADV', 'PREP', 'CONJ', 'PRON', 'DET', 'INTJ',
])
const VALID_CEFR: ReadonlySet<Cefr> = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
const VALID_TIER: ReadonlySet<FrequencyTier> = new Set(['core', 'common', 'moderate', 'rare'])

export function tierToCount(tier: FrequencyTier): number {
  switch (tier) {
    case 'core': return 4
    case 'common': return 3
    case 'moderate': return 2
    case 'rare': return 1
  }
}

export function isSeedListItem(x: unknown): x is SeedListItem {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return (
    typeof o.lemma === 'string' &&
    o.lemma.length > 0 &&
    typeof o.pos === 'string' &&
    VALID_POS.has(o.pos as Pos) &&
    typeof o.cefr_estimate === 'string' &&
    VALID_CEFR.has(o.cefr_estimate as Cefr) &&
    typeof o.frequency_tier === 'string' &&
    VALID_TIER.has(o.frequency_tier as FrequencyTier) &&
    typeof o.rationale_short === 'string' &&
    typeof o.confidence === 'number' &&
    o.confidence >= 0 &&
    o.confidence <= 1
  )
}

export interface ParseResult {
  ok: boolean
  items?: SeedListItem[]
  error?: string
  line_number?: number
}

export function parseSeedListJsonl(content: string): ParseResult {
  if (content.charCodeAt(0) === 0xfeff) {
    return { ok: false, error: 'JSONL has UTF-8 BOM — must be without BOM' }
  }
  if (content.includes('\r\n')) {
    return { ok: false, error: 'JSONL has CRLF line endings — must be LF only' }
  }

  const lines = content.split('\n').filter((l) => l.trim().length > 0)
  const items: SeedListItem[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      return { ok: false, error: 'invalid JSON line', line_number: i + 1 }
    }
    if (!isSeedListItem(parsed)) {
      return { ok: false, error: 'line does not match SeedListItem schema', line_number: i + 1 }
    }
    items.push(parsed)
  }

  return { ok: true, items }
}

export function detectDuplicates(items: SeedListItem[]): string[] {
  const seen = new Map<string, number>()
  const dups: string[] = []
  for (const item of items) {
    const key = `${item.lemma}|${item.pos}`
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    if (count === 2) dups.push(key)
  }
  return dups
}

// ── Spec generation ───────────────────────────────

export interface SeedSpecInput {
  spec_id: number
  collection_slug: string
  collection_title: string
  target_count: number
  target_cefr_range: Cefr[]
  target_segment: Segment
  domain_hints?: string[]
  must_include_keywords?: string[]
  must_exclude_keywords?: string[]
  reference_seeds?: string
  license_constraint?: string
}

export function buildSeedSpec(input: SeedSpecInput): Record<string, unknown> {
  return {
    spec_id: input.spec_id,
    collection_slug: input.collection_slug,
    collection_title: input.collection_title,
    target_count: input.target_count,
    target_cefr_range: input.target_cefr_range,
    target_segment: input.target_segment,
    domain_hints: input.domain_hints ?? [],
    must_include_keywords: input.must_include_keywords ?? [],
    must_exclude_keywords: input.must_exclude_keywords ?? [],
    reference_seeds: input.reference_seeds ?? '',
    license_constraint:
      input.license_constraint ??
      'AI-generated; must not replicate any copyrighted vocabulary list or textbook word list. ' +
        'Output is original synthesis based on general English vocabulary frequency patterns.',
    output_format: 'jsonl',
  }
}

export interface FileNames {
  spec: string
  seedList: string
  validation: string
  error: string
}

export function buildJobFileNames(timestamp: string, slug: string): FileNames {
  const base = `${timestamp}-${slug}`
  return {
    spec: `${base}-seed-spec.json`,
    seedList: `${base}-seed-list.jsonl`,
    validation: `${base}-seed-list.validation.json`,
    error: `${base}-seed-list.error.json`,
  }
}

// ── DB operations ─────────────────────────────────

export interface CreateAiSourceInput {
  runId: number
  collectionSlug: string
  collectionTitle: string
  seedFileName: string
  specId: number | null
  itemCount: number
}

export interface CreateAiSourceResult {
  ok: boolean
  source_id?: number
  slug?: string
  error?: string
}

export async function createAiGeneratedSource(
  client: SupabaseClient,
  input: CreateAiSourceInput,
): Promise<CreateAiSourceResult> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const slug = `${input.collectionSlug}-ai-seed-${ts}`

  const citation = [
    'Generated via Vocaflow VCB seed-list command',
    input.specId !== null ? `spec_id=${input.specId}` : null,
    `run_id=${input.runId}`,
    `count=${input.itemCount}`,
    `file=${path.basename(input.seedFileName)}`,
  ]
    .filter(Boolean)
    .join(', ')

  const { data, error } = await client
    .from('vocab_sources')
    .insert({
      slug,
      title: `AI Generated Seed for ${input.collectionTitle}`,
      kind: 'ai_generated',
      license_tier: 'T1',
      citation,
      url: null,
      language: 'en',
      notes: 'Auto-generated by VCB Method B',
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: `ai_generated source insert failed: ${error?.message ?? 'unknown'}` }
  }
  return { ok: true, source_id: (data as { id: number }).id, slug }
}

export interface InsertSeedCandidatesResult {
  ok: boolean
  inserted: number
  skipped: number
  error?: string
}

export async function insertAiSeedCandidates(
  client: SupabaseClient,
  runId: number,
  items: SeedListItem[],
): Promise<InsertSeedCandidatesResult> {
  const rows = items.map((item, idx) => ({
    run_id: runId,
    lemma: item.lemma,
    pos: item.pos,
    raw_count: tierToCount(item.frequency_tier),
    normalized_freq: null,
    rank_in_run: idx + 1,
    context_samples: [] as string[],
    seed_origin: 'ai_generated' as const,
  }))

  const { data, error } = await client
    .from('vocab_seed_candidates')
    .upsert(rows, { onConflict: 'run_id,lemma,pos', ignoreDuplicates: true })
    .select('id')

  if (error) {
    return { ok: false, inserted: 0, skipped: 0, error: error.message }
  }

  const inserted = data?.length ?? 0
  return { ok: true, inserted, skipped: rows.length - inserted }
}

export async function updateRunStatus(
  client: SupabaseClient,
  runId: number,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.from('vocab_runs').update({ status }).eq('id', runId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Run config helpers ────────────────────────────

export interface SeedSpecFromConfig {
  spec_id: number
  target_count: number
  domain_hints: string[]
  must_include_keywords: string[]
  must_exclude_keywords: string[]
  reference_seeds: string
}

// ── Run config DB helpers (server action 호출용) ───

export interface RunSeedRow {
  id: number
  collection_slug: string
  collection_title: string
  config: Record<string, unknown>
  status: string
}

export async function fetchRunForSeed(
  client: SupabaseClient,
  runId: number,
): Promise<{ ok: boolean; row?: RunSeedRow; error?: string }> {
  const { data, error } = await client
    .from('vocab_runs')
    .select('id, collection_slug, collection_title, config, status')
    .eq('id', runId)
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? `run #${runId} not found` }
  }
  return { ok: true, row: data as unknown as RunSeedRow }
}

export async function updateRunConfig(
  client: SupabaseClient,
  runId: number,
  config: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.from('vocab_runs').update({ config }).eq('id', runId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export function extractSpecFromRunConfig(
  config: unknown,
): SeedSpecFromConfig | null {
  if (typeof config !== 'object' || config === null) return null
  const c = config as Record<string, unknown>
  if (typeof c.seed_spec_id !== 'number') return null

  return {
    spec_id: c.seed_spec_id,
    target_count: typeof c.target_count === 'number' ? c.target_count : 2000,
    domain_hints: Array.isArray(c.domain_hints) ? (c.domain_hints as string[]) : [],
    must_include_keywords: Array.isArray(c.must_include_keywords)
      ? (c.must_include_keywords as string[])
      : [],
    must_exclude_keywords: Array.isArray(c.must_exclude_keywords)
      ? (c.must_exclude_keywords as string[])
      : [],
    reference_seeds: typeof c.reference_seeds === 'string' ? c.reference_seeds : '',
  }
}
