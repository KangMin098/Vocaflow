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
  /** ACP §18 — 정규화 라이선스 등급 (public_domain/cc0/cc_by/cc_by_sa/cc_by_nd/restricted) */
  license_class: string | null
  /** ACP §18 — 글 유형 (expository/argumentative/narrative/news/reference) */
  register: string | null
  /** ACP §18 §4-C — 어휘 노이즈 비율 (>0.08 = 단어세트 미발행) */
  lexical_noise: number | null
  /** ACP §18 — CC-BY-ND ⇒ 본문 불변(단어세트 미발행) */
  display_only: boolean | null
  /** P4 — 검수 게이트 audio 조건 (media='audio' 소스에서 필수) */
  audio_url: string | null
  /** P4 — 검수 게이트 V-Level 산정 + iplus 뱃지 산출원 */
  article_v_level: number | null
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

/**
 * 상태별 **서버 카운트** (`count: 'exact', head: true`).
 *
 * ⚠️ 이 값을 목록에서 세지 않는다. `library_articles` 는 87,968행이고 PostgREST 는
 *    한 응답을 조용히 1,000행에서 자른다 — 목록을 세면 "전체 1,000 · 게시됨 0" 같은
 *    거짓말이 오류 없이 화면에 뜬다(2026-09-05 실측: 발행 293건이 통째로 안 보였다).
 */
export interface ArticleStatusCounts {
  /** 필터 없는 전체 행 수 — byStatus 합과 다르면 스키마에 모르는 상태가 생겼다는 뜻. */
  total: number
  byStatus: Record<ArticleStatus, number>
}

/** 매트릭스 30칸(register 5 × CEFR 6)의 **발행** 건수 — 서버 카운트 산출물. */
export interface CoverageCounts {
  /** `${register}|${cefr}` → 발행 건수. 0인 칸도 키가 있다(= GAP). */
  cells: Record<string, number>
  /** status='published' 전체 건수. */
  publishedTotal: number
  /** 발행됐지만 30칸 어디에도 못 들어간 글 (register·CEFR 미분류 또는 표 밖 값). */
  unclassified: number
}

/** ACP §18 P2 — 소스/feed 별 후보 현황 (SourceFeedList · library_article_seed_catalog 집계). */
export interface SourceFeedHealth {
  source: string
  feedId: string
  feedLabel: string
  /** 전체 후보 수 */
  candidates: number
  /** 미import (큐 미진입) 후보 수 */
  pending: number
  /** audio 보유 후보 수 */
  audioN: number
  /** 평균 학습 친화도 score (0~1) */
  avgScore: number
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
  /** P4 — 학습자 카드 i+1 배지 산출원 (article_v_level vs 사용자 V) */
  article_v_level: number | null
  /** P4 — 글 유형 배지 (narrative/expository/argumentative/news/reference) */
  register: string | null
  /** P4 — 음성 배지 (VOA 등 듣기 정체성 · audio 연결 여부) */
  audio_url: string | null
  /**
   * 이 글이 다른 글의 **쉬운 판**인가 (ACP §20 레벨 적응).
   *
   * 적응 글은 출처를 원본 그대로 쓰므로(nasa 등) 카탈로그에서 원본 바로 옆에 선다.
   * 표시가 없으면 학습자에게는 **같은 글이 두 개**로 보인다.
   */
  adapted_from_id?: string | null
}

export const ARTICLE_IN_PROGRESS_STATUSES: ArticleStatus[] = [
  'queued',
  'ingesting',
  'normalizing',
  'analyzing',
  'curating',
]

/** 스키마의 전체 상태 — 서버 카운트를 상태마다 한 번씩 돌 때의 정본 목록. */
export const ALL_ARTICLE_STATUSES: ArticleStatus[] = [
  'queued',
  'ingesting',
  'normalizing',
  'analyzing',
  'curating',
  'ready',
  'published',
  'archived',
  'failed',
]

export function emptyStatusCounts(): ArticleStatusCounts {
  const byStatus = {} as Record<ArticleStatus, number>
  for (const s of ALL_ARTICLE_STATUSES) byStatus[s] = 0
  return { total: 0, byStatus }
}

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

/**
 * 상단 타일 — **서버 카운트에서만** 만든다.
 *
 * 여기 있던 `computeArticleStats(rows)` 는 받은 목록의 길이를 셌다. 목록이 1,000행에서
 * 잘리는 순간 그 타일은 오류 없이 "전체 1,000 · 게시됨 0" 을 표시했고, 같은 거짓값이
 * 커버리지 매트릭스(전 칸 GAP)와 소스 추천까지 흘러갔다. 그래서 행 배열을 받는 버전은
 * 되살리지 않는다 — 세는 곳은 DB 한 군데뿐이어야 한다.
 */
export function statsFromCounts(counts: ArticleStatusCounts): ArticleStats {
  return {
    total: counts.total,
    published: counts.byStatus.published,
    ready: counts.byStatus.ready,
    inProgress: ARTICLE_IN_PROGRESS_STATUSES.reduce((n, s) => n + counts.byStatus[s], 0),
    failed: counts.byStatus.failed,
  }
}
