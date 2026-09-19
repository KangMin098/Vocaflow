// apps/web/src/lib/textbook/source-workspace.ts
// Operational clues from inventory counts, not a second eligibility classifier.
import type { SourceInventoryRow } from './source-inventory-view'
import { articleConsoleQuery, type ArticleStatusFilter } from '@/lib/articles/console-view'

export const SOURCE_VIEWS = {
  sources: '원천 관리',
  eligibility: '적격 판정',
  coverage: '코퍼스 분포',
  operations: '처리 안내',
} as const
export const SOURCE_ISSUES = {
  all: '모든 원천',
  attention: '확인할 항목 있음',
  failed: '수집·처리 실패',
  legal: '법적 제약',
  raw: '발췌 경로 확인',
  analysis: '학령 분석 부족',
  unjudged: '내용 판정 부족',
  gate: '게이트 차단 기록',
} as const
export const SOURCE_SORTS = {
  attention: '조치 필요 우선',
  total: '재고 많은 순',
  recent: '최근 등록순',
  name: '이름순',
} as const
export type SourceView = keyof typeof SOURCE_VIEWS
export function sourceViewForKey(view: SourceView, key: string): SourceView | null {
  const keys = Object.keys(SOURCE_VIEWS) as SourceView[]
  const index = keys.indexOf(view)
  if (key === 'Home') return keys[0]
  if (key === 'End') return keys[keys.length - 1]
  if (key === 'ArrowRight') return keys[(index + 1) % keys.length]
  if (key === 'ArrowLeft') return keys[(index + keys.length - 1) % keys.length]
  return null
}
export type SourceIssue = keyof typeof SOURCE_ISSUES
export type SourceSort = keyof typeof SOURCE_SORTS
export interface SourceWorkspaceState {
  view: SourceView
  issue: SourceIssue
  sort: SourceSort
  q: string
  source: string | null
}
export const DEFAULT_SOURCE_STATE: SourceWorkspaceState = {
  view: 'sources',
  issue: 'all',
  sort: 'attention',
  q: '',
  source: null,
}
export const QUERY_KEYS = ['view', 'issue', 'sort', 'q', 'source'] as const
type Params = Record<string, string | string[] | undefined> | URLSearchParams

export function parseSourceWorkspace(params?: Params): SourceWorkspaceState {
  const read = (key: string) => {
    const value = params instanceof URLSearchParams ? params.get(key) : params?.[key]
    return (Array.isArray(value) ? value[0] : value) ?? ''
  }
  const oneOf = <T extends string>(value: string, options: Record<T, string>, fallback: T): T =>
    Object.prototype.hasOwnProperty.call(options, value) ? (value as T) : fallback
  return {
    view: oneOf(read('view'), SOURCE_VIEWS, 'sources'),
    issue: oneOf(read('issue'), SOURCE_ISSUES, 'all'),
    sort: oneOf(read('sort'), SOURCE_SORTS, 'attention'),
    q: read('q').trim().slice(0, 100),
    source: read('source').trim().slice(0, 100) || null,
  }
}

export function sourceWorkspaceHref(state: SourceWorkspaceState) {
  const params = new URLSearchParams()
  for (const key of QUERY_KEYS) {
    const value = state[key]
    if (value && value !== DEFAULT_SOURCE_STATE[key]) params.set(key, value)
  }
  const query = params.toString()
  return `/admin/csat/sources${query ? `?${query}` : ''}`
}

export interface SourceClue {
  issue: Exclude<SourceIssue, 'all' | 'attention'>
  label: string
  count: number
  reason: string
}

/** These populations overlap. Never sum them as an affected-article total. */
export function sourceClues(row: SourceInventoryRow): SourceClue[] {
  const candidates: SourceClue[] = [
    {
      issue: 'failed',
      label: '처리 실패',
      count: row.byStatus.find((s) => s.status === 'failed')?.count ?? 0,
      reason: '실패 상태의 원문에서 오류 사유를 확인하고 재처리 대상을 정하세요.',
    },
    {
      issue: 'legal',
      label: '법적 제약',
      count: row.legalBlocked,
      reason: '라이선스·공개 범위를 확인하세요. 분석을 다시 돌려도 사용 권한이 생기지는 않습니다.',
    },
    {
      issue: 'raw',
      label: '발췌 경로 확인',
      count: row.rawPurpose,
      reason:
        '미절단 원본입니다. 내용 판정만 반복하지 말고 발췌본과 연결된 문항을 먼저 확인하세요.',
    },
    {
      issue: 'analysis',
      label: '학령 분석 부족',
      count: Math.max(0, row.total - row.levelled),
      reason: '학령 값이 없는 원문입니다. 큐 상태를 확인한 뒤 분석 경로를 정하세요.',
    },
    {
      issue: 'unjudged',
      label: '내용 판정 부족',
      count: Math.max(0, row.total - row.judged),
      reason:
        '내용 판정 기록이 없습니다. 원문과 발췌 여부를 확인한 뒤 해당 판정 절차로 진행하세요.',
    },
    {
      issue: 'gate',
      label: '게이트 차단 기록',
      count: row.topBlocked.reduce((sum, item) => sum + item.count, 0),
      reason:
        '상위 차단 사유에 잡힌 원문입니다. 전체 차단 수가 아니며 다른 확인 항목과 겹칠 수 있습니다.',
    },
  ]
  return candidates.filter((clue) => clue.count > 0)
}

export function filterSources(rows: SourceInventoryRow[], state: SourceWorkspaceState) {
  const query = state.q.trim().toLocaleLowerCase('ko')
  const priority = (row: SourceInventoryRow) => {
    const first = sourceClues(row)[0]?.issue
    return first ? ['failed', 'legal', 'raw', 'analysis', 'unjudged', 'gate'].indexOf(first) : 6
  }
  return rows
    .filter((row) => {
      const clues = sourceClues(row)
      return (
        (!query || `${row.source} ${row.label}`.toLocaleLowerCase('ko').includes(query)) &&
        (state.issue === 'all' ||
          (state.issue === 'attention'
            ? clues.length > 0
            : clues.some((clue) => clue.issue === state.issue)))
      )
    })
    .sort((a, b) => {
      const diff =
        state.sort === 'total'
          ? b.total - a.total
          : state.sort === 'recent'
            ? (b.lastGet ?? '').localeCompare(a.lastGet ?? '')
            : state.sort === 'name'
              ? a.label.localeCompare(b.label, 'ko')
              : priority(a) - priority(b) || b.total - a.total
      return diff || a.source.localeCompare(b.source)
    })
}

export function sourceArticlesHref(source: string, status: ArticleStatusFilter = 'all') {
  return `/admin/articles?${articleConsoleQuery({ stage: 'review', source, status, page: 0 })}`
}
