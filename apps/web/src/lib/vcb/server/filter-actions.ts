// apps/web/src/lib/vcb/server/filter-actions.ts
// Server Actions — Wizard 라이브 미리보기 RPC 3종 wrap.

'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { VocabFilters } from '../filters'
import type { ServerActionResult } from '../types'

export interface DistributionResult {
  total: number
  v_level: Record<string, number>
  cefr: Record<string, number>
}

export interface SampleWord {
  word: string
  meaning_ko: string | null
  v_level: number | null
  cefr_level: string | null
  primary_pos: string | null
  frequency_rank: number | null
}

// VocabFilters 의 v_level_min/max null → 0 변환 (RPC 호환)
function toJsonbPayload(filters: VocabFilters): Record<string, unknown> {
  return {
    v_level_min: filters.v_level_min ?? 0,
    v_level_max: filters.v_level_max ?? 0,
    cefr_levels: filters.cefr_levels,
    list_tags: filters.list_tags,
    list_tags_mode: filters.list_tags_mode,
    freq_bands: filters.freq_bands,
    primary_pos: filters.primary_pos,
    verified_only: filters.verified_only,
  }
}

export async function countMatchingWords(
  filters: VocabFilters,
): Promise<ServerActionResult<{ count: number }>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()
    const { data, error } = await client.rpc('vcb_count_words_matching', {
      p_filters: toJsonbPayload(filters),
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { count: (data as number) ?? 0 } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function sampleMatchingWords(
  filters: VocabFilters,
  limit = 10,
): Promise<ServerActionResult<{ words: SampleWord[] }>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()
    const { data, error } = await client.rpc('vcb_sample_words_for_filters', {
      p_filters: toJsonbPayload(filters),
      p_limit: limit,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { words: (data as SampleWord[]) ?? [] } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function distributionForFilters(
  filters: VocabFilters,
): Promise<ServerActionResult<DistributionResult>> {
  try {
    await requireAdmin('/admin/vocab')
    const client = await createClient()
    const { data, error } = await client.rpc('vcb_distribution_for_filters', {
      p_filters: toJsonbPayload(filters),
    })
    if (error) return { ok: false, error: error.message }
    const dist = (data as DistributionResult | null) ?? { total: 0, v_level: {}, cefr: {} }
    return { ok: true, data: dist }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
