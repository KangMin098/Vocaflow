// apps/web/src/lib/articles/console-view.ts
//
// ACP — /admin/articles 콘솔의 "지금 무엇을 보고 있는가" 를 URL 하나로 정의한다.
//
// 왜 URL 인가: 목록을 서버에서 상태별로 잘라 오기 때문이다. 87,968행을 전부 내려보내
// 브라우저에서 거르던 시절엔 필터가 순수 클라이언트 상태여도 됐지만(그리고 그게
// 1,000행 절단 버그의 뿌리였다), 이제 필터·페이지가 바뀌면 **서버가 다시 질의**해야 한다.
// searchParams 에 두면 그 재질의가 라우터 한 번으로 끝나고, 검수 화면에 들어갔다
// 돌아와도 보던 자리가 그대로다.
//
// client/server 양쪽에서 import 한다 — 'server-only' 를 넣지 말 것.

import type { ArticleStatus, ArticleStatusCounts } from './types'
import { ARTICLE_IN_PROGRESS_STATUSES } from './types'

export type ArticleStage = 'coverage' | 'get' | 'review' | 'publish'

export const ARTICLE_STAGES: ArticleStage[] = ['coverage', 'get', 'review', 'publish']

/** 목록 상태 칩 — 'all' 은 상태 필터 없음, 'in_progress' 는 5개 상태 묶음. */
export type ArticleStatusFilter =
  | 'all'
  | 'in_progress'
  | 'ready'
  | 'published'
  | 'failed'
  | 'archived'

export const ARTICLE_STATUS_FILTERS: ArticleStatusFilter[] = [
  'all',
  'in_progress',
  'ready',
  'published',
  'failed',
  'archived',
]

export const ARTICLE_STATUS_FILTER_LABEL: Record<ArticleStatusFilter, string> = {
  all: '전체',
  in_progress: '처리 중',
  ready: '검토 대기',
  published: '게시됨',
  failed: '실패',
  archived: '보관됨',
}

/**
 * 한 화면에 그릴 행 수.
 *
 * PostgREST 상한(1,000)보다 훨씬 작게 잡는다 — 보관 20,053건을 한 번에 그리면
 * 브라우저가 멈추고, 관리자가 실제로 훑는 것은 앞쪽 수십 건이다.
 */
export const ARTICLE_LIST_PAGE_SIZE = 100

export interface ArticleConsoleView {
  stage: ArticleStage
  status: ArticleStatusFilter
  /** 소스 필터 (library_articles.source). null = 전체. */
  source: string | null
  /** 0-based 페이지 번호. */
  page: number
}

/** 단계별 기본 상태 필터 — 검수는 ready 큐, 발행은 published. */
export function defaultStatusFilter(stage: ArticleStage): ArticleStatusFilter {
  if (stage === 'review') return 'ready'
  if (stage === 'publish') return 'published'
  return 'all'
}

/** 목록 질의가 필요한 단계인가 — 커버리지·소스 GET 은 집계만 쓰므로 행을 안 읽는다. */
export function stageNeedsList(stage: ArticleStage): boolean {
  return stage === 'review' || stage === 'publish'
}

type ParamValue = string | string[] | undefined
export type ConsoleSearchParams = Record<string, ParamValue> | URLSearchParams

/**
 * 이 화면이 읽는 쿼리 키 전부 — **여기 없는 키는 조용히 버려진다.**
 *
 * 한 곳에 적는 이유: 링크를 만드는 쪽(`articleConsoleQuery`, 검수 화면의 「목록으로」,
 * 도움말 seeAlso)과 읽는 쪽(`parseArticleConsoleView`)이 같은 목록을 봐야 한다. 갈리면
 * `/admin/articles?stage=review` 처럼 **화면은 뜨는데 조건만 사라지는** 링크가 생긴다 —
 * `route-query-params.test.ts` 가 이 상수를 읽어 그 어긋남을 잡는다.
 */
export const QUERY_KEYS = ['stage', 'status', 'src', 'page'] as const
type QueryKey = (typeof QUERY_KEYS)[number]

function readParam(params: ConsoleSearchParams | undefined, key: QueryKey): string | null {
  if (!params) return null
  if (params instanceof URLSearchParams) return params.get(key)
  const v = params[key]
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

/**
 * URL → 뷰. **모르는 값은 조용히 기본값으로 떨어뜨린다** — 관리자가 주소를 손으로 고치거나
 * 낡은 북마크로 들어와도 화면이 500 으로 죽으면 안 된다.
 */
export function parseArticleConsoleView(params?: ConsoleSearchParams): ArticleConsoleView {
  const rawStage = readParam(params, 'stage')
  const stage: ArticleStage = ARTICLE_STAGES.includes(rawStage as ArticleStage)
    ? (rawStage as ArticleStage)
    : 'coverage'

  const rawStatus = readParam(params, 'status')
  const status: ArticleStatusFilter = ARTICLE_STATUS_FILTERS.includes(
    rawStatus as ArticleStatusFilter,
  )
    ? (rawStatus as ArticleStatusFilter)
    : defaultStatusFilter(stage)

  const rawSource = readParam(params, 'src')
  const source = rawSource && rawSource.trim() ? rawSource.trim() : null

  const rawPage = Number.parseInt(readParam(params, 'page') ?? '', 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 0

  return { stage, status, source, page }
}

/**
 * 뷰 → 쿼리스트링. **기본값은 적지 않는다** — 주소가 짧아야 사람이 읽고, 공유한 링크가
 * 나중에 기본값이 바뀌어도 "그때 그 화면" 이 아니라 "지금의 기본 화면" 으로 열린다.
 */
export function articleConsoleQuery(view: ArticleConsoleView): string {
  const p = new URLSearchParams()
  if (view.stage !== 'coverage') p.set('stage', view.stage)
  if (view.status !== defaultStatusFilter(view.stage)) p.set('status', view.status)
  if (view.source) p.set('src', view.source)
  if (view.page > 0) p.set('page', String(view.page))
  return p.toString()
}

/**
 * 상태 칩 → 질의할 상태 목록. `null` 이면 상태 조건 없음(전체).
 */
export function statusesForFilter(filter: ArticleStatusFilter): ArticleStatus[] | null {
  if (filter === 'all') return null
  if (filter === 'in_progress') return [...ARTICLE_IN_PROGRESS_STATUSES]
  return [filter]
}

/**
 * 상태 칩의 건수 — **서버 카운트 합**에서만 만든다(목록 길이 금지).
 * 페이지네이션의 분모이기도 하다.
 */
export function countForFilter(
  counts: ArticleStatusCounts,
  filter: ArticleStatusFilter,
): number {
  const statuses = statusesForFilter(filter)
  if (!statuses) return counts.total
  return statuses.reduce((n, s) => n + (counts.byStatus[s] ?? 0), 0)
}

/** 현재 페이지가 분모를 넘어섰는지 — 필터를 바꾸면 흔히 생긴다. */
export function lastPageIndex(total: number, pageSize = ARTICLE_LIST_PAGE_SIZE): number {
  if (total <= 0) return 0
  return Math.floor((total - 1) / pageSize)
}
