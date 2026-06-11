// apps/web/src/lib/articles/types.ts
// ACP v1.0 — 공유 타입 + 순수 헬퍼 (client/server 양쪽 사용)
// admin-queries.ts 는 'server-only' 라 client 컴포넌트가 직접 import 불가 →
// type/classify 는 본 파일로 분리.

export type ArticleStatus =
  | 'queued'
  | 'ingesting'
  | 'normalizing'
  | 'analyzing'
  | 'curating'
  | 'ready'
  | 'published'
  | 'archived'
  | 'failed'

export interface ArticleAdminRow {
  id: string
  source: string
  source_id: string
  source_url: string | null
  title: string
  author: string | null
  cefr_level: string | null
  cefr_confidence: number | null
  word_count: number | null
  reading_minutes: number | null
  status: ArticleStatus
  status_message: string | null
  license: string
  copyright_safe_in_kr: boolean
  published_at: string | null
  llm_cost_usd: string | null
  created_at: string
  updated_at: string
}

export interface ArticleStats {
  total: number
  published: number
  ready: number
  inProgress: number
  failed: number
}

/** 학습자 노출용 — published + copyright_safe 아티클 (스크립트 탭) */
export interface PublishedArticle {
  id: string
  title: string
  author: string | null
  source: string
  source_url: string | null
  cefr_level: string | null
  word_count: number | null
  reading_minutes: number | null
  category_tags: string[] | null
  published_at: string | null
}

export const ARTICLE_IN_PROGRESS_STATUSES: ArticleStatus[] = [
  'queued',
  'ingesting',
  'normalizing',
  'analyzing',
  'curating',
]

export function classifyArticleStatus(status: ArticleStatus): {
  label: string
  tone: 'success' | 'warning' | 'info' | 'danger' | 'neutral'
} {
  switch (status) {
    case 'published':
      return { label: '게시됨', tone: 'success' }
    case 'ready':
      return { label: '검토 대기', tone: 'warning' }
    case 'queued':
      return { label: '대기', tone: 'info' }
    case 'ingesting':
      return { label: '수집중', tone: 'info' }
    case 'normalizing':
      return { label: '정규화', tone: 'info' }
    case 'analyzing':
      return { label: '분석중', tone: 'info' }
    case 'curating':
      return { label: '큐레이션', tone: 'info' }
    case 'failed':
      return { label: '실패', tone: 'danger' }
    case 'archived':
      return { label: '보관됨', tone: 'neutral' }
  }
}

export function computeArticleStats(rows: ArticleAdminRow[]): ArticleStats {
  return {
    total: rows.length,
    published: rows.filter((r) => r.status === 'published').length,
    ready: rows.filter((r) => r.status === 'ready').length,
    inProgress: rows.filter((r) => ARTICLE_IN_PROGRESS_STATUSES.includes(r.status)).length,
    failed: rows.filter((r) => r.status === 'failed').length,
  }
}
