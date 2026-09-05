// apps/web/src/app/admin/csat/sourcing/page.tsx
// ④ 소재 — 단계 밴드별 지문 재고와 저작권 등급.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadSourceView } from '@/lib/csat/factory-line-views'

import { SourceClient } from './SourceClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatSourcePage() {
  await requireAdmin('/admin/csat/sourcing')
  const view = await loadSourceView()
  return <SourceClient {...view} />
}
