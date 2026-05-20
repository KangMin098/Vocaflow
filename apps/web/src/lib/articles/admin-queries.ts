// apps/web/src/lib/articles/admin-queries.ts
// ACP v1.0 — /admin/articles 서버 전용 데이터 fetch.
// (타입/순수 헬퍼는 ./types — client 측에서도 import 가능)

import 'server-only'

import { createClient } from '@/lib/supabase/server'

import type { ArticleAdminRow } from './types'

export type { ArticleAdminRow, ArticleStats, ArticleStatus } from './types'
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
      'id, source, source_id, source_url, title, author, cefr_level, cefr_confidence, word_count, reading_minutes, status, status_message, license, copyright_safe_in_kr, published_at, llm_cost_usd, created_at, updated_at',
    )
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`listAdminArticles failed: ${error.message}`)
  }
  return (data ?? []) as ArticleAdminRow[]
}
