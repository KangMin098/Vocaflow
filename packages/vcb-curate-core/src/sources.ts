// packages/vcb-curate-core/src/sources.ts
// Source 조회 + 생성 비즈니스 로직. Server Action + CLI 양쪽 공유.
// 정합: CLAUDE.md §19.3 vocab_sources

import type { SupabaseClient } from '@supabase/supabase-js'

export type SourceKind =
  | 'frequency_list'
  | 'corpus'
  | 'dictionary'
  | 'curated_list'
  | 'ai_generated'

export type LicenseTier = 'T1' | 'T2' | 'T3'

export interface SourceSummary {
  id: number
  slug: string
  title: string
  kind: SourceKind
  license_tier: LicenseTier
  citation: string
  url: string | null
  language: string
  notes: string | null
  created_at: string
  run_count: number
}

export interface CreateSourceInput {
  slug: string
  title: string
  kind: SourceKind
  license_tier: LicenseTier
  citation: string
  url: string | null
  language: string
  notes: string | null
}

export interface CreateSourceResult {
  ok: boolean
  source_id?: number
  error?: string
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/
const VALID_KINDS: ReadonlySet<SourceKind> = new Set([
  'frequency_list',
  'corpus',
  'dictionary',
  'curated_list',
  'ai_generated',
])
const VALID_TIERS: ReadonlySet<LicenseTier> = new Set(['T1', 'T2', 'T3'])

export async function fetchSources(
  client: SupabaseClient,
): Promise<SourceSummary[]> {
  const { data, error } = await client
    .from('vocab_sources')
    .select(
      'id, slug, title, kind, license_tier, citation, url, language, notes, created_at',
    )
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`fetchSources failed: ${error.message}`)
  }

  const rows = (data ?? []) as Array<Omit<SourceSummary, 'run_count'>>

  const sourceIds = rows.map((r) => r.id)
  const runCounts = new Map<number, number>()

  if (sourceIds.length > 0) {
    const { data: refRows, error: refErr } = await client
      .from('vocab_raw_texts')
      .select('source_id, run_id')
      .in('source_id', sourceIds)

    if (refErr) {
      throw new Error(`fetchSources run_count failed: ${refErr.message}`)
    }

    const perSource = new Map<number, Set<number>>()
    for (const row of (refRows ?? []) as Array<{
      source_id: number
      run_id: number
    }>) {
      if (!perSource.has(row.source_id)) {
        perSource.set(row.source_id, new Set())
      }
      perSource.get(row.source_id)?.add(row.run_id)
    }
    for (const [sid, runs] of perSource) {
      runCounts.set(sid, runs.size)
    }
  }

  return rows.map(
    (row): SourceSummary => ({
      ...row,
      run_count: runCounts.get(row.id) ?? 0,
    }),
  )
}

export async function createSource(
  client: SupabaseClient,
  input: CreateSourceInput,
): Promise<CreateSourceResult> {
  if (!SLUG_PATTERN.test(input.slug)) {
    return {
      ok: false,
      error: 'slug must match /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/',
    }
  }
  if (input.title.trim().length === 0) {
    return { ok: false, error: 'title must be non-empty' }
  }
  if (input.title.length > 200) {
    return { ok: false, error: 'title must be <= 200 chars' }
  }
  if (!VALID_KINDS.has(input.kind)) {
    return { ok: false, error: `invalid kind: ${input.kind}` }
  }
  if (!VALID_TIERS.has(input.license_tier)) {
    return { ok: false, error: `invalid license_tier: ${input.license_tier}` }
  }
  if (input.citation.trim().length === 0) {
    return { ok: false, error: 'citation must be non-empty' }
  }
  if (input.citation.length > 1000) {
    return { ok: false, error: 'citation must be <= 1000 chars' }
  }
  if (input.url !== null && input.url.length > 500) {
    return { ok: false, error: 'url must be <= 500 chars' }
  }
  if (input.language.length === 0 || input.language.length > 10) {
    return { ok: false, error: 'language must be 1~10 chars' }
  }
  if (input.notes !== null && input.notes.length > 2000) {
    return { ok: false, error: 'notes must be <= 2000 chars' }
  }

  if (input.kind === 'ai_generated' && input.license_tier !== 'T1') {
    return {
      ok: false,
      error: 'ai_generated kind requires license_tier=T1 (CC0 / AI 책임)',
    }
  }

  const { data: existing, error: dupErr } = await client
    .from('vocab_sources')
    .select('id')
    .eq('slug', input.slug)
    .limit(1)
    .maybeSingle()

  if (dupErr) {
    return { ok: false, error: `slug duplicate check failed: ${dupErr.message}` }
  }
  if (existing) {
    return {
      ok: false,
      error: `slug "${input.slug}" already exists (source #${(existing as { id: number }).id})`,
    }
  }

  const { data, error } = await client
    .from('vocab_sources')
    .insert({
      slug: input.slug,
      title: input.title.trim(),
      kind: input.kind,
      license_tier: input.license_tier,
      citation: input.citation.trim(),
      url: input.url,
      language: input.language,
      notes: input.notes,
    })
    .select('id')
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: `source insert failed: ${error?.message ?? 'unknown'}`,
    }
  }

  return { ok: true, source_id: (data as { id: number }).id }
}
