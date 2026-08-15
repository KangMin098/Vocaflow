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
/**
 * VCB 가 발행한 공용 단어장 — **생산자 두 종류를 함께** 싣는다.
 *
 * 한때 `source_run_id IS NOT NULL` 로만 조회했다. 그 조건은 VCB 8-step run 만 통과하므로,
 * 단어장 Studio·`pnpm vcb:compose` 가 발행한 세트 32개가 **이 화면에서 통째로 보이지 않았다**
 * (실측 2026-08-15: run 산출물 0 · 컴포저 32). 발행은 DB 에서 성공으로 보이고 학습자 카탈로그에도
 * 뜨는데 어드민만 모르는 상태였다 — 관리자가 "발행됐나?" 를 확인할 곳이 없다는 뜻이다.
 *
 * 두 생산자는 남기는 흔적이 다르다: run 은 `source_run_id`, 컴포저는 `curation_query.blueprint`.
 * 둘 중 하나라도 있으면 여기 싣고, 어느 쪽인지 `producer` 로 구분한다.
 */
export interface VcbCollectionInfo extends PublishedSetInfo {
  /** VCB 8-step run 산출물이면 run 번호, 컴포저 산출물이면 null */
  source_run_id: number | null
  /** 컴포저 산출물이면 blueprint id (유형), run 산출물이면 null */
  blueprint: string | null
  producer: 'run' | 'composer'
}

export async function fetchVcbCollections(): Promise<VcbCollectionInfo[]> {
  await requireAdmin('/admin/vocab')
  const client = createAdminClient()

  interface Row {
    id: string
    slug: string
    title: string
    category: string
    word_count: number | null
    is_published: boolean
    source_run_id: number | null
    curation_query: { blueprint?: string } | null
    created_at: string
  }
  const cols =
    'id, slug, title, category, word_count, is_published, source_run_id, curation_query, created_at'

  // 두 번 나눠 조회한다 — jsonb 키 존재 조건과 컬럼 NOT NULL 조건을 한 `.or()` 로 묶으면
  // PostgREST 문법이 조용히 빗나가 한쪽이 통째로 빠진다(그 사고가 이 함수의 원래 결함이었다).
  const [byRun, byBlueprint] = await Promise.all([
    client.from('shared_word_sets').select(cols).not('source_run_id', 'is', null),
    client.from('shared_word_sets').select(cols).not('curation_query->blueprint', 'is', null),
  ])
  if (byRun.error) throw new Error(`fetchVcbCollections(run) failed: ${byRun.error.message}`)
  if (byBlueprint.error) {
    throw new Error(`fetchVcbCollections(composer) failed: ${byBlueprint.error.message}`)
  }

  const merged = new Map<string, Row>()
  for (const r of [...(byRun.data ?? []), ...(byBlueprint.data ?? [])] as unknown as Row[]) {
    merged.set(r.id, r)
  }
  const rows = [...merged.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))

  const result: VcbCollectionInfo[] = []
  for (const r of rows) {
    const { count: actual } = await client
      .from('shared_words')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', r.id)
    const blueprint = r.curation_query?.blueprint ?? null
    result.push({
      set_id: r.id,
      slug: r.slug,
      title: r.title,
      category: r.category,
      word_count: r.word_count ?? 0,
      actual_word_count: actual ?? 0,
      is_published: r.is_published,
      source_run_id: r.source_run_id,
      blueprint,
      producer: r.source_run_id != null ? 'run' : 'composer',
      created_at: r.created_at,
    })
  }
  return result
}
