// apps/web/src/app/admin/csat/review/page.tsx
// ⑦ 검수 — 다층·다각도. 층마다 무엇을 보는지 함께 적는다.
//
// ⚠️ 2026-09-23 부터 **검수 표를 직접 읽는다**(`loadReviewDefects`). 그 전에는 화면이
//   `textbook_volume_renders.colophon` 의 얼린 요약만 봐서, `csat_item_reviews` 의
//   revise 501 · fail 159 가 **어느 화면에도 없었다**(DD-69 B4 · 실측).

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadReviewView } from '@/lib/csat/factory-line-views'
import { loadReviewDefects } from '@/lib/csat/review-defects'
import { createAdminClient } from '@/lib/supabase/admin'

import type { SupabaseClient } from '@supabase/supabase-js'

import { ReviewClient } from './ReviewClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatReviewPage() {
  await requireAdmin('/admin/csat/review')
  // 둘은 서로를 안 기다린다 — 한쪽이 느려도 다른 쪽이 그려진다.
  const [view, defects] = await Promise.all([
    loadReviewView(),
    loadReviewDefects(createAdminClient() as unknown as SupabaseClient),
  ])
  return <ReviewClient {...view} defects={defects} />
}
