// apps/web/src/lib/admin/curation-view.ts
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

/** Batched imports can share a timestamp; an ID tie-breaker stabilizes reloads. */
export function sortCurationRows<T extends { id: string; updated_at: string }>(
  rows: readonly T[]
): T[] {
  return [...rows].sort(
    (left, right) =>
      right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id)
  )
}
