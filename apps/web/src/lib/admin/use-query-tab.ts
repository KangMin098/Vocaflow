// apps/web/src/lib/admin/use-query-tab.ts
'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { updateAdminUrl } from './navigation'

/** URL wins over legacy session storage; native history keeps unrelated filters and back/forward. */
export function useQueryTab<T extends string>(values: readonly T[], fallback: T, initial?: T, storageKey?: string): [T, (tab: T) => void] {
  const search = useSearchParams()
  const [legacy, setLegacy] = useState(initial ?? fallback)
  useEffect(() => {
    if (initial || !storageKey || new URL(window.location.href).searchParams.has('tab')) return
    try { const value = sessionStorage.getItem(storageKey); if (values.includes(value as T)) setLegacy(value as T) } catch { /* Browser storage is optional. */ }
  }, [initial, storageKey, values])
  const value = search.get('tab')
  const tab = values.includes(value as T) ? value as T : legacy
  return [tab, next => {
    if (!values.includes(next)) return
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    updateAdminUrl(url, 'push')
    if (storageKey) try { sessionStorage.setItem(storageKey, next) } catch { /* URL remains authoritative. */ }
  }]
}
