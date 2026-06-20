// apps/web/src/app/api/admin/articles/nasa-feed/route.ts
// ACP v1.0 Phase 19 — NASA RSS feed 항목 목록
//
// GET /api/admin/articles/nasa-feed?feed=<feed_id>

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'
import { listNasaFeed, NASA_FEEDS } from '@vocaflow/library-pipeline'
import { upsertArticleSeeds } from '@/lib/acp/seed-upsert'

export const runtime = 'nodejs'
export const revalidate = 600

export async function GET(req: NextRequest) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const feedId = req.nextUrl.searchParams.get('feed') ?? 'news'
  const feed = NASA_FEEDS.find((f) => f.id === feedId)
  if (!feed) {
    return NextResponse.json(
      { error: 'BadRequest', message: `Unknown NASA feed: ${feedId}` },
      { status: 400 },
    )
  }

  try {
    const items = await listNasaFeed(feed.url, feed.id)

    let publishedSourceIds: string[] = []
    if (items.length > 0) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('library_articles')
        .select('source_id')
        .in('source_id', items.map((i) => i.source_id))
      publishedSourceIds = (data ?? []).map((r: { source_id: string }) => r.source_id)

      // v06.46 — seed_catalog 영구 보존
      await upsertArticleSeeds(supabase, 'nasa', feed.id, feed.label, items)
    }

    return NextResponse.json(
      { feed_id: feed.id, label: feed.label, items, publishedSourceIds },
      { status: 200, headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    if (msg.includes('timeout') || msg.includes('AbortError')) {
      return NextResponse.json(
        { error: 'GatewayTimeout', message: 'NASA RSS 응답이 늦어 가져오지 못했습니다.' },
        { status: 504 },
      )
    }
    console.error('[nasa-feed] failed:', msg)
    return NextResponse.json(
      {
        error: 'InternalError',
        message: `NASA RSS 가져오기 실패: ${msg}. URL 직접 입력으로 우회하세요.`,
      },
      { status: 502 },
    )
  }
}
