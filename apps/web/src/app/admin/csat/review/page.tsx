// apps/web/src/app/admin/csat/review/page.tsx
// ⑦ 검수 — 다층·다각도. 층마다 무엇을 보는지 함께 적는다.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadReviewView } from '@/lib/csat/factory-line-views'

import { ReviewClient } from './ReviewClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatReviewPage() {
  await requireAdmin('/admin/csat/review')
  const view = await loadReviewView()
  return <ReviewClient {...view} />
}
