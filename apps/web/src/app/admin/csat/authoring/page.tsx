// apps/web/src/app/admin/csat/authoring/page.tsx
// ⑤ 집필 — 유형 25 × 수준 9 재고 전량과 사다리 밖 재고.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadAuthorView } from '@/lib/csat/factory-line-views'

import { AuthorClient } from './AuthorClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatAuthorPage() {
  await requireAdmin('/admin/csat/authoring')
  const view = await loadAuthorView()
  return <AuthorClient {...view} />
}
