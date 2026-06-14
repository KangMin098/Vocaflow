// apps/web/src/lib/acp/seed-upsert.ts
//
// ACP article RSS GET 결과를 library_article_seed_catalog 에 upsert.
// LCP library_seed_catalog 동형 — 한 번 GET 한 항목은 영구 보존, 같은 source_id 면 UPDATE.
//
// 호출: 6 feed route (voa/nasa/nih/wikinews/the_conversation/simple_wikipedia) 가 RSS fetch 직후 호출.
// 반환: 각 source_id 에 대해 seed_catalog 에서의 row id + 상태 정보.

import type { SupabaseClient } from '@supabase/supabase-js'

// v06.69 — arxiv 제거 (사용자 명시: "플랫폼 전체에서 삭제"). 6종 가용.
export type SeedSource =
  | 'voa'
  | 'nasa'
  | 'nih'
  | 'wikinews'
  | 'the_conversation'
  | 'simple_wikipedia'

interface ArticleScore {
  total: number
  recency: number
  source: number
  length: number
  level: number
}

export interface SeedUpsertItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  score?: ArticleScore
  has_audio?: boolean
}

export interface SeedRow {
  id: string
  source_id: string
  curation_status: 'pending' | 'enqueued' | 'published' | 'rejected' | 'hidden'
  imported_to_articles: boolean
  imported_article_id: string | null
  has_audio: boolean
}

/**
 * RSS GET 결과를 seed_catalog 에 일괄 upsert.
 *
 * 동작:
 *  · INSERT … ON CONFLICT (source, source_id) DO UPDATE
 *  · score / has_audio / description / fetched_at 갱신
 *  · imported_to_articles=true 인 항목은 curation_meta 만 갱신 (status 유지)
 */
export async function upsertArticleSeeds(
  supabase: SupabaseClient,
  source: SeedSource,
  feedId: string,
  feedLabel: string,
  items: SeedUpsertItem[],
): Promise<SeedRow[]> {
  if (items.length === 0) return []

  const rows = items.map((it) => ({
    source,
    source_id: it.source_id,
    feed_id: feedId,
    feed_label: feedLabel,
    title: it.title,
    source_url: it.url,
    published_at: it.published_at,
    description: it.description,
    language: 'en',
    score_total: it.score?.total ?? null,
    score_recency: it.score?.recency ?? null,
    score_source: it.score?.source ?? null,
    score_length: it.score?.length ?? null,
    score_level: it.score?.level ?? null,
    has_audio: it.has_audio ?? false,
    fetched_at: new Date().toISOString(),
    // curation_meta 에 score breakdown + audio detect 결과 보존
    curation_meta: {
      score: it.score ?? null,
      has_audio: it.has_audio ?? false,
    },
  }))

  const { data, error } = await supabase
    .from('library_article_seed_catalog')
    .upsert(rows, {
      onConflict: 'source,source_id',
      ignoreDuplicates: false,
    })
    .select('id, source_id, curation_status, imported_to_articles, imported_article_id, has_audio')

  if (error) {
    console.error('[upsertArticleSeeds] failed:', error.message)
    return []
  }
  return (data ?? []) as SeedRow[]
}

/**
 * source 별 seed 조회 — list view 용. status='pending' 우선, score_total 내림차순.
 *
 * `includeImported=false` 면 imported_to_articles=true 항목 제외 (이미 큐잉됨).
 */
// v06.74 — article.status 까지 매핑하여 큐레이터가 단계별 상태 한눈에 파악 가능.
export type ArticleStatusValue =
  | 'queued'
  | 'normalizing'
  | 'analyzing'
  | 'curating'
  | 'ready'
  | 'published'
  | 'failed'
  | 'archived'

export interface SeedListRow {
  id: string
  source: SeedSource
  source_id: string
  feed_id: string | null
  feed_label: string | null
  title: string
  author: string | null
  source_url: string | null
  published_at: string | null
  description: string | null
  score_total: number | null
  score_recency: number | null
  score_source: number | null
  score_length: number | null
  score_level: number | null
  has_audio: boolean
  fetched_at: string
  imported_to_articles: boolean
  imported_article_id: string | null
  curation_status: 'pending' | 'enqueued' | 'published' | 'rejected' | 'hidden'
  /** v06.74 — imported_article_id 로 연결된 library_articles.status (없으면 null) */
  article_status: ArticleStatusValue | null
  /** v06.74 — article.status_message (failed 시 원인) */
  article_status_message: string | null
}

export async function listArticleSeeds(
  supabase: SupabaseClient,
  opts: {
    sources?: SeedSource[]
    feedId?: string
    includeImported?: boolean
    limit?: number
  } = {},
): Promise<SeedListRow[]> {
  const { sources, feedId, includeImported = false, limit = 200 } = opts
  let q = supabase
    .from('library_article_seed_catalog')
    .select(
      'id, source, source_id, feed_id, feed_label, title, author, source_url, published_at, description, ' +
        'score_total, score_recency, score_source, score_length, score_level, has_audio, fetched_at, ' +
        'imported_to_articles, imported_article_id, curation_status',
    )
    .order('score_total', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (sources && sources.length > 0) q = q.in('source', sources)
  if (feedId) q = q.eq('feed_id', feedId)
  if (!includeImported) q = q.eq('imported_to_articles', false)

  const { data, error } = await q
  if (error) {
    console.error('[listArticleSeeds] failed:', error.message)
    return []
  }
  const seeds = (data ?? []) as unknown as Array<
    Omit<SeedListRow, 'article_status' | 'article_status_message'>
  >

  // v06.74 — imported_article_id 로 article.status 매핑 (별도 query — JOIN 안 되는 nullable FK)
  const articleIds = seeds
    .map((s) => s.imported_article_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  const articleStatusMap = new Map<string, { status: ArticleStatusValue; message: string | null }>()
  if (articleIds.length > 0) {
    const { data: articles, error: artErr } = await supabase
      .from('library_articles')
      .select('id, status, status_message')
      .in('id', articleIds)
    if (!artErr && articles) {
      for (const a of articles as Array<{
        id: string
        status: ArticleStatusValue
        status_message: string | null
      }>) {
        articleStatusMap.set(a.id, { status: a.status, message: a.status_message })
      }
    }
  }

  return seeds.map((s) => {
    const am = s.imported_article_id ? articleStatusMap.get(s.imported_article_id) : undefined
    return {
      ...s,
      article_status: am?.status ?? null,
      article_status_message: am?.message ?? null,
    }
  })
}

/** seed → library_articles 이동 후 imported_to_articles=true, imported_article_id 설정 */
export async function markSeedImported(
  supabase: SupabaseClient,
  source: SeedSource,
  sourceId: string,
  articleId: string,
): Promise<void> {
  const { error } = await supabase
    .from('library_article_seed_catalog')
    .update({
      imported_to_articles: true,
      imported_article_id: articleId,
      imported_at: new Date().toISOString(),
      curation_status: 'enqueued',
    })
    .eq('source', source)
    .eq('source_id', sourceId)
  if (error) console.error('[markSeedImported] failed:', error.message)
}
