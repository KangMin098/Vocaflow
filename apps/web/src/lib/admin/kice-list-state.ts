// apps/web/src/lib/admin/kice-list-state.ts
import { safeInternalPath } from '@/lib/auth/redirect'
import { parseScope, scopeQuery, type CsatScope } from '@/lib/csat/scope'
export interface KiceListState { q: string; exam: string; page: number }
type Params = Record<string, string | string[] | undefined>
export function parseKiceListState(params: Params): KiceListState {
  const one = (key: string) => typeof params[key] === 'string' ? params[key] as string : ''
  const page = one('page')
  return { q: one('q').trim().slice(0, 100), exam: /^[A-Za-z0-9]{1,40}$/.test(one('exam')) ? one('exam') : '', page: /^[1-9]\d{0,4}$/.test(page) ? Number(page) : 1 }
}
export function kiceListHref(typeId: string, state: KiceListState, scope: CsatScope): string {
  const params = new URLSearchParams(scopeQuery(scope))
  if (state.q) params.set('q', state.q)
  if (state.exam) params.set('exam', state.exam)
  if (state.page > 1) params.set('page', String(state.page))
  return `/admin/kice/${encodeURIComponent(typeId)}${params.size ? `?${params}` : ''}#items-h`
}
/** Keep only a typed admin KICE list destination, never arbitrary return URLs or query keys. */
export function adminKiceReturn(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string' || !raw || raw.length > 2048) return fallback
  const safe = safeInternalPath(raw)
  if (!safe) return fallback
  const url = new URL(safe, 'https://internal.invalid')
  if (!/^\/admin\/kice\/[A-Z][A-Z0-9-]{0,63}$/.test(url.pathname)) return fallback
  return kiceListHref(url.pathname.split('/').at(-1)!, parseKiceListState(Object.fromEntries(url.searchParams)), parseScope(url.searchParams))
}
export function filterKiceItems<T extends { id: string; exam_label: string; no: number }>(items: readonly T[], state: KiceListState) {
  const query = state.q.toLocaleLowerCase('ko')
  return items.filter(item => (!state.exam || item.id.split('#')[0] === state.exam) && (!query || `${item.id} ${item.exam_label} ${item.no}`.toLocaleLowerCase('ko').includes(query)))
}
