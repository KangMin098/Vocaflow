// apps/web/src/lib/admin/curation-view.ts
import { safeInternalPath } from '@/lib/auth/redirect'

/** 본문 검수에서 돌아올 도서 목록만 허용한다. 임의 URL·동작 query를 전달하지 않는다. */
export function adminCurationReturn(raw: unknown): string {
  const fallback = '/admin/curation'
  if (typeof raw !== 'string' || raw.length > 2048) return fallback
  const safe = safeInternalPath(raw)
  if (!safe) return fallback
  const url = new URL(safe, 'https://internal.invalid')
  if (url.pathname !== fallback) return fallback
  const params = new URLSearchParams()
  params.set('view', curationLocation(url.searchParams).view)
  for (const key of ['source', 'level', 'status']) {
    const value = url.searchParams.get(key)
    if (value && /^[A-Za-z0-9_-]{1,40}$/.test(value)) params.set(key, value)
  }
  const q = url.searchParams.get('q')?.trim().slice(0, 100)
  if (q) params.set('q', q)
  const page = url.searchParams.get('page')
  if (page && /^[1-9]\d{0,4}$/.test(page)) params.set('page', page)
  const selected = url.searchParams.get('selected')
  if (selected && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selected)) params.set('selected', selected)
  return `${fallback}?${params}`
}

export function curationPreviewHref(bookId: string, returnTo: string) {
  return `/admin/curation/preview/${encodeURIComponent(bookId)}?${new URLSearchParams({ returnTo: adminCurationReturn(returnTo) })}`
}

export const CURATION_VIEWS = [
  { key: 'library', label: '도서 목록' },
  { key: 'collect', label: '수집' },
  { key: 'review', label: '검토 대기' },
] as const
export const CURATION_METHODS = [
  { key: 'sources', label: '소스 카탈로그' },
  { key: 'bulk', label: '소스 GET (대량)' },
  { key: 'seed', label: '추천 시드' },
  { key: 'id', label: 'Gutenberg ID' },
  { key: 'wikibooks', label: 'Wikibooks' },
  { key: 'wikisource', label: 'Wikisource' },
  { key: 'openstax', label: 'OpenStax' },
  { key: 'storyweaver', label: 'StoryWeaver' },
] as const
export type CurationView = (typeof CURATION_VIEWS)[number]['key']
export type CurationMethod = (typeof CURATION_METHODS)[number]['key']
export function curationLocation(params: Pick<URLSearchParams, 'get'>) {
  const legacy = params.get('tab')
  const method =
    CURATION_METHODS.find((item) => item.key === (params.get('method') ?? legacy))?.key ?? 'sources'
  const view =
    CURATION_VIEWS.find((item) => item.key === params.get('view'))?.key ??
    (legacy && legacy !== 'mine' ? 'collect' : 'library')
  return { view, method }
}
export function curationHref(
  params: { toString(): string },
  view: CurationView,
  method?: CurationMethod
) {
  const next = new URLSearchParams(params.toString())
  next.delete('tab')
  next.set('view', view)
  if (method) next.set('method', method)
  return `/admin/curation?${next}`
}

/** Review is a dedicated queue; entering/leaving it starts at its first row. */
export function curationViewHref(params: URLSearchParams, view: CurationView) {
  const next = new URLSearchParams(params.toString())
  const current = curationLocation(next).view
  if (current !== view && (current === 'review' || view === 'review')) {
    next.delete('page')
    next.delete('selected')
    if (view === 'review') next.set('status', 'ready')
    else next.delete('status')
  }
  return curationHref(next, view)
}

export function curationPage<T>(rows: readonly T[], requested: string | null, pageSize = 25) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const parsed = requested && /^\d+$/.test(requested) ? Number(requested) : 1
  const page = Math.min(totalPages, Math.max(1, Number.isSafeInteger(parsed) ? parsed : 1))
  return { page, totalPages, rows: rows.slice((page - 1) * pageSize, page * pageSize) }
}

// ── 작업 라인: 원본 도서 ↔ 이야기 판본 (LCP Story S4) ─────────────────────────
// 라인 전환은 `line` 하나만 넣거나 뺀다. 원본 라인의 보기·수집 방식·검색·필터·쪽·선택은 그대로 남아
// 이야기 판본에 다녀와도 원본 화면이 정확히 되살아난다. 이야기 라인 상태(`story_*`)도 원본 쪽에서
// 지우지 않는다 — 원본 라인과 adminCurationReturn 은 그 키를 읽지 않는다.

export const CURATION_LINES = [
  { key: 'original', label: '원본 도서' },
  { key: 'story', label: '이야기 판본' },
] as const
export type CurationLine = (typeof CURATION_LINES)[number]['key']

/** 없거나 모르는 값은 원본 라인이다(기존 URL 은 전부 원본 라인으로 읽힌다). */
export function curationLine(params: Pick<URLSearchParams, 'get'>): CurationLine {
  return params.get('line') === 'story' ? 'story' : 'original'
}

function curationQueryHref(next: URLSearchParams) {
  const query = next.toString()
  return query ? `/admin/curation?${query}` : '/admin/curation'
}

export function curationLineHref(params: { toString(): string }, line: CurationLine) {
  const next = new URLSearchParams(params.toString())
  if (line === 'story') next.set('line', 'story')
  else next.delete('line')
  return curationQueryHref(next)
}

const STORY_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 이야기 라인의 보조 패널 — 지금은 후보 파일 패널 하나다. 원문 · 파일 내용은 URL 에 넣지 않는다(식별자만). */
export const STORY_PANELS = ['files'] as const
export type StoryPanel = (typeof STORY_PANELS)[number]

export interface StoryLocation {
  /** 선택한 판본 자리(story_admin_list_slots 의 slot_id). uuid 가 아니면 무시한다. */
  slot: string | null
  panel: StoryPanel | null
}

export function storyLocation(params: Pick<URLSearchParams, 'get'>): StoryLocation {
  const slot = params.get('story_slot')
  const panel = params.get('story_panel')
  return {
    slot: slot && STORY_UUID_RE.test(slot) ? slot : null,
    panel: STORY_PANELS.find((item) => item === panel) ?? null,
  }
}

/** 이야기 라인 안의 이동. `line=story` 를 보장하고, patch 에 적은 키만 바꾼다(원본 라인 키는 보존). */
export function storyHref(
  params: { toString(): string },
  patch: { slot?: string | null; panel?: StoryPanel | null }
) {
  const next = new URLSearchParams(params.toString())
  next.set('line', 'story')
  if ('slot' in patch) {
    if (patch.slot && STORY_UUID_RE.test(patch.slot)) next.set('story_slot', patch.slot)
    else next.delete('story_slot')
  }
  if ('panel' in patch) {
    if (patch.panel && STORY_PANELS.includes(patch.panel)) next.set('story_panel', patch.panel)
    else next.delete('story_panel')
  }
  return curationQueryHref(next)
}

/** Batched imports can share a timestamp; an ID tie-breaker stabilizes reloads. */
export function sortCurationRows<T extends { id: string; updated_at: string }>(
  rows: readonly T[]
): T[] {
  return [...rows].sort(
    (left, right) =>
      right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id)
  )
}
