// apps/web/src/app/api/admin/articles/wikinews-feed/route.ts
// v06.66 — Wikinews atom feed 항목 목록.

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'
import { listWikinewsFeed, WIKINEWS_FEEDS } from '@vocaflow/library-pipeline'
import { upsertArticleSeeds } from '@/lib/acp/seed-upsert'

export const runtime = 'nodejs'
export const revalidate = 600

export async function GET(req: NextRequest) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const feedId = req.nextUrl.searchParams.get('feed') ?? 'latest'
  const feed = WIKINEWS_FEEDS.find((f) => f.id === feedId)
  if (!feed) {
    return NextResponse.json(
      { error: 'BadRequest', message: `Unknown Wikinews feed: ${feedId}` },
      { status: 400 },
    )
  }

  try {
    const items = await listWikinewsFeed(feed.url, feed.id)

    let publishedSourceIds: string[] = []
    if (items.length > 0) {
      const supabase = await createClient()
      const sourceIds = items.map((i) => i.source_id)
      const { data } = await supabase
        .from('library_articles')
        .select('source_id')
        .in('source_id', sourceIds)
      publishedSourceIds = (data ?? []).map((r: { source_id: string }) => r.source_id)
      await upsertArticleSeeds(supabase, 'wikinews', feed.id, feed.label, items)
    }

    return NextResponse.json(
      { feed_id: feed.id, label: feed.label, items, publishedSourceIds },
      {
        status: 200,
        headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    if (message.includes('timeout') || message.includes('AbortError')) {
      return NextResponse.json(
        { error: 'GatewayTimeout', message: 'Wikinews atom 응답이 늦어 가져오지 못했습니다.' },
        { status: 504 },
      )
    }
    console.error('[wikinews-feed] failed:', message)
    return NextResponse.json(
      { error: 'InternalError', message: `Wikinews 가져오기 실패: ${message}` },
      { status: 500 },
    )
  }
}
