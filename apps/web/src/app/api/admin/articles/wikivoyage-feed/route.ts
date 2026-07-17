// apps/web/src/app/api/admin/articles/wikivoyage-feed/route.ts
// ACP 대량 GET — Wikivoyage Star/Guide 목적지 목록 (BulkArticlesTab 용).
//
// GET /api/admin/articles/wikivoyage-feed?feed=<star|guide>

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'
import { listWikivoyageFeed, WIKIVOYAGE_FEEDS } from '@vocaflow/library-pipeline'
import { upsertArticleSeeds } from '@/lib/acp/seed-upsert'

export const runtime = 'nodejs'
export const revalidate = 600

export async function GET(req: NextRequest) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const feedId = req.nextUrl.searchParams.get('feed') ?? 'star'
  const feed = WIKIVOYAGE_FEEDS.find((f) => f.id === feedId)
  if (!feed) {
    return NextResponse.json(
      { error: 'BadRequest', message: `Unknown Wikivoyage feed: ${feedId}` },
      { status: 400 },
    )
  }

  try {
    const items = await listWikivoyageFeed(feed.category, feed.id)

    let publishedSourceIds: string[] = []
    if (items.length > 0) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('library_articles')
        .select('source_id')
        .in('source_id', items.map((i) => i.source_id))
      publishedSourceIds = (data ?? []).map((r: { source_id: string }) => r.source_id)
      await upsertArticleSeeds(supabase, 'wikivoyage', feed.id, feed.label, items)
    }

    return NextResponse.json(
      { feed_id: feed.id, label: feed.label, items, publishedSourceIds },
      { status: 200, headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    console.error('[wikivoyage-feed] failed:', msg)
    return NextResponse.json(
      { error: 'InternalError', message: `Wikivoyage API 가져오기 실패: ${msg}. URL 직접 입력으로 우회하세요.` },
      { status: 502 },
    )
  }
}
