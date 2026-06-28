// apps/web/src/lib/articles/admin-queries.ts
// ACP v1.0 — /admin/articles 서버 전용 데이터 fetch.
// (타입/순수 헬퍼는 ./types — client 측에서도 import 가능)

import 'server-only'

import { createClient } from '@/lib/supabase/server'

import type { ArticleAdminRow, SourceFeedHealth } from './types'

export type { ArticleAdminRow, ArticleStats, ArticleStatus, SourceFeedHealth } from './types'
export {
  classifyArticleStatus,
  computeArticleStats as articleStats,
  ARTICLE_IN_PROGRESS_STATUSES,
} from './types'

export async function listAdminArticles(): Promise<ArticleAdminRow[]> {
  const supabase = await createClient()
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (
          col: string,
          opts?: { ascending?: boolean; nullsFirst?: boolean },
        ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
      }
    }
  }

  const { data, error } = await sb
    .from('library_articles')
    .select(
      'id, source, source_id, source_url, title, author, cefr_level, cefr_confidence, word_count, reading_minutes, status, status_message, license, license_class, register, lexical_noise, display_only, audio_url, article_v_level, copyright_safe_in_kr, published_at, llm_cost_usd, created_at, updated_at',
    )
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`listAdminArticles failed: ${error.message}`)
  }
  return (data ?? []) as ArticleAdminRow[]
}

/**
 * ACP §18 P2 — 소스/feed 별 후보 현황 집계 (SourceFeedList 용).
 * library_article_seed_catalog 를 JS 에서 집계 (행 수 적음 · 마이그레이션 불요).
 */
export async function listSourceFeedHealth(): Promise<SourceFeedHealth[]> {
  const supabase = await createClient()
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
    }
  }
  const { data, error } = await sb
    .from('library_article_seed_catalog')
    .select('source, feed_id, feed_label, score_total, has_audio, imported_to_articles')

  if (error) {
    throw new Error(`listSourceFeedHealth failed: ${error.message}`)
  }

  type Row = {
    source: string
    feed_id: string | null
    feed_label: string | null
    score_total: number | null
    has_audio: boolean | null
    imported_to_articles: boolean | null
  }
  const rows = (data ?? []) as Row[]

  const byKey = new Map<string, { h: SourceFeedHealth; scoreSum: number }>()
  for (const r of rows) {
    const feedId = r.feed_id ?? '(default)'
    const key = `${r.source}|${feedId}`
    let entry = byKey.get(key)
    if (!entry) {
      entry = {
        h: {
          source: r.source,
          feedId,
          feedLabel: r.feed_label ?? feedId,
          candidates: 0,
          pending: 0,
          audioN: 0,
          avgScore: 0,
        },
        scoreSum: 0,
      }
      byKey.set(key, entry)
    }
    entry.h.candidates += 1
    if (!r.imported_to_articles) entry.h.pending += 1
    if (r.has_audio) entry.h.audioN += 1
    entry.scoreSum += r.score_total ?? 0
  }

  return Array.from(byKey.values())
    .map(({ h, scoreSum }) => ({
      ...h,
      avgScore: h.candidates > 0 ? Math.round((scoreSum / h.candidates) * 100) / 100 : 0,
    }))
    .sort((a, b) => (a.source === b.source ? b.candidates - a.candidates : a.source.localeCompare(b.source)))
}
