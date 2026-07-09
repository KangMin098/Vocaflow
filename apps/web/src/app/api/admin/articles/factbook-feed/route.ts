// apps/web/src/app/api/admin/articles/factbook-feed/route.ts
// ACP 대량 GET — CIA World Factbook 국가 목록 (정적 35국 · BulkArticlesTab 용).
//
// GET /api/admin/articles/factbook-feed?feed=all  (RSS 아님 — 정적 국가 리스트)

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'
import { listFactbookFeed } from '@vocaflow/library-pipeline'
import { upsertArticleSeeds } from '@/lib/acp/seed-upsert'

export const runtime = 'nodejs'
export const revalidate = 3600

const FEED_LABEL = 'Countries'

export async function GET() {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  try {
    const items = listFactbookFeed() // 정적 — 네트워크 fetch 없음

    let publishedSourceIds: string[] = []
    if (items.length > 0) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('library_articles')
        .select('source_id')
        .in('source_id', items.map((i) => i.source_id))
      publishedSourceIds = (data ?? []).map((r: { source_id: string }) => r.source_id)
      await upsertArticleSeeds(supabase, 'factbook', 'all', FEED_LABEL, items)
    }

    return NextResponse.json(
      { feed_id: 'all', label: FEED_LABEL, items, publishedSourceIds },
      { status: 200, headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    console.error('[factbook-feed] failed:', msg)
    return NextResponse.json(
      { error: 'InternalError', message: `Factbook 목록 실패: ${msg}` },
      { status: 502 },
    )
  }
}
