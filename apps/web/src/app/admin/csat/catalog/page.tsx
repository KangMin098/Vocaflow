// apps/web/src/app/admin/csat/catalog/page.tsx
// 카탈로그 — 「어떤 시리즈를 파나」. 공장에 없던 유일한 답이다.
//
// ⚠️ 축이 (유형 × 학령)에서 **시리즈 × 학령**으로 바뀌었다(2026-09-06). 시장이 파는 단위가
//   시리즈라서다 — 자세한 근거는 `SeriesShelf.tsx` 머리말과 `series-catalog.ts` 에 있다.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadSeriesCatalog } from '@/lib/csat/series-view'

import { SeriesShelf } from './SeriesShelf'

export const dynamic = 'force-dynamic'

export default async function AdminCsatCatalogPage() {
  await requireAdmin('/admin/csat/catalog')
  const view = await loadSeriesCatalog()
  return <SeriesShelf {...view} />
}
