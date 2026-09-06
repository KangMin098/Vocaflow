// apps/web/src/app/admin/csat/catalog/page.tsx
// 카탈로그 — 「뭘 만드나」. 공장에 없던 유일한 답이다.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadCatalogView } from '@/lib/csat/product-view'

import { CatalogClient } from './CatalogClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatCatalogPage() {
  await requireAdmin('/admin/csat/catalog')
  const view = await loadCatalogView()
  return <CatalogClient {...view} />
}
