// packages/vcb-curate-core/src/run-create.ts
// Run 생성 비즈니스 로직. Server Action + CLI 양쪽 공유 가능.
// 정합: CLAUDE.md §19.3 vocab_runs

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Segment, Cefr, RunConfig } from './types'

export interface CreateRunInput {
  collection_slug: string
  collection_title: string
  target_segment: Segment
  target_cefr_range: Cefr[]
  description: string | null
  cover_emoji: string | null
}

export interface CreateRunContext {
  created_by: string | null
}

export interface CreateRunResult {
  ok: boolean
  run_id?: number
  error?: string
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/
const VALID_SEGMENTS: ReadonlySet<Segment> = new Set([
  'middle_school',
  'high_school',
  'toeic',
  'business',
  'academic',
  'civil_service',
  'general',
])
const VALID_CEFR: ReadonlySet<Cefr> = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

export async function createRun(
  client: SupabaseClient,
  input: CreateRunInput,
  ctx: CreateRunContext,
): Promise<CreateRunResult> {
  if (!SLUG_PATTERN.test(input.collection_slug)) {
    return {
      ok: false,
      error:
        'collection_slug must match /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/ (lowercase, numbers, hyphens; 3~80 chars)',
    }
  }
  if (input.collection_title.trim().length === 0) {
    return { ok: false, error: 'collection_title must be non-empty' }
  }
  if (input.collection_title.length > 200) {
    return { ok: false, error: 'collection_title must be <= 200 chars' }
  }
  if (!VALID_SEGMENTS.has(input.target_segment)) {
    return { ok: false, error: `invalid target_segment: ${input.target_segment}` }
  }
  if (input.target_cefr_range.length === 0) {
    return { ok: false, error: 'target_cefr_range must have at least one level' }
  }
  for (const cefr of input.target_cefr_range) {
    if (!VALID_CEFR.has(cefr)) {
      return { ok: false, error: `invalid cefr level: ${cefr}` }
    }
  }
  if (input.cover_emoji !== null && input.cover_emoji.length > 8) {
    return { ok: false, error: 'cover_emoji must be <= 8 chars' }
  }
  if (input.description !== null && input.description.length > 500) {
    return { ok: false, error: 'description must be <= 500 chars' }
  }

  const { data: existing, error: dupErr } = await client
    .from('vocab_runs')
    .select('id')
    .eq('collection_slug', input.collection_slug)
    .limit(1)
    .maybeSingle()

  if (dupErr) {
    return { ok: false, error: `slug duplicate check failed: ${dupErr.message}` }
  }
  if (existing) {
    return {
      ok: false,
      error: `collection_slug "${input.collection_slug}" already exists (run #${(existing as { id: number }).id})`,
    }
  }

  const config: RunConfig = {
    target_segment: input.target_segment,
    target_cefr_range: input.target_cefr_range,
    description: input.description ?? undefined,
    cover_emoji: input.cover_emoji ?? undefined,
  }

  const { data, error } = await client
    .from('vocab_runs')
    .insert({
      collection_slug: input.collection_slug,
      collection_title: input.collection_title.trim(),
      status: 'created',
      config,
      created_by: ctx.created_by,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: `run insert failed: ${error?.message ?? 'unknown'}` }
  }

  return { ok: true, run_id: (data as { id: number }).id }
}
