// apps/web/src/lib/vcb/server/runs.ts
// Server Action — Run 조회.

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  fetchRuns as fetchRunsCore,
  fetchRunDetail as fetchRunDetailCore,
  type RunSummary,
  type RunDetail,
} from '@vocaflow/vcb-curate-core'

export async function fetchRuns(): Promise<RunSummary[]> {
  await requireAdmin('/admin/vocab')
  const client = createAdminClient()
  return fetchRunsCore(client)
}

export async function fetchRunDetail(runId: number): Promise<RunDetail | null> {
  await requireAdmin('/admin/vocab')
  const client = createAdminClient()
  return fetchRunDetailCore(client, runId)
}

// ── 발행 결과 (Step 8 이후 published_set 카드용) ──────────
export interface PublishedSetInfo {
  set_id: string
  slug: string
  title: string
  category: string
  word_count: number
  actual_word_count: number
  is_published: boolean
  created_at: string
}

export async function fetchPublishedSetsForRun(
  runId: number,
): Promise<PublishedSetInfo[]> {
  await requireAdmin('/admin/vocab')
  const client = createAdminClient()
  const { data, error } = await client
    .from('shared_word_sets')
    .select('id, slug, title, category, word_count, is_published, created_at')
    .eq('source_run_id', runId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`fetchPublishedSetsForRun failed: ${error.message}`)

  const rows = (data ?? []) as Array<{
    id: string
    slug: string
    title: string
    category: string
    word_count: number
    is_published: boolean
    created_at: string
  }>

  const result: PublishedSetInfo[] = []
  for (const r of rows) {
    const { count: actual } = await client
      .from('shared_words')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', r.id)
    result.push({
      set_id: r.id,
      slug: r.slug,
      title: r.title,
      category: r.category,
      word_count: r.word_count ?? 0,
      actual_word_count: actual ?? 0,
      is_published: r.is_published,
      created_at: r.created_at,
    })
  }
  return result
}

// ── 전체 VCB 발행 컬렉션 (/admin/vocab/collections) ──────────
// VCB run 에서 발행된 shared_word_sets 전량 (source_run_id 존재).
export interface VcbCollectionInfo extends PublishedSetInfo {
  source_run_id: number
}

export async function fetchVcbCollections(): Promise<VcbCollectionInfo[]> {
  await requireAdmin('/admin/vocab')
  const client = createAdminClient()
  const { data, error } = await client
    .from('shared_word_sets')
    .select(
      'id, slug, title, category, word_count, is_published, source_run_id, created_at',
    )
    .not('source_run_id', 'is', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`fetchVcbCollections failed: ${error.message}`)

  const rows = (data ?? []) as Array<{
    id: string
    slug: string
    title: string
    category: string
    word_count: number
    is_published: boolean
    source_run_id: number
    created_at: string
  }>

  const result: VcbCollectionInfo[] = []
  for (const r of rows) {
    const { count: actual } = await client
      .from('shared_words')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', r.id)
    result.push({
      set_id: r.id,
      slug: r.slug,
      title: r.title,
      category: r.category,
      word_count: r.word_count ?? 0,
      actual_word_count: actual ?? 0,
      is_published: r.is_published,
      source_run_id: r.source_run_id,
      created_at: r.created_at,
    })
  }
  return result
}
