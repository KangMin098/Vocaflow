// apps/web/src/app/api/admin/articles/simple_wikipedia-feed/route.ts
// v06.66 — Simple English Wikipedia 카테고리별 페이지 목록 (MediaWiki API).

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'
import {
  listSimpleWikipediaFeed,
  SIMPLE_WIKIPEDIA_FEEDS,
} from '@vocaflow/library-pipeline'
import { upsertArticleSeeds } from '@/lib/acp/seed-upsert'

export const runtime = 'nodejs'
export const revalidate = 600

export async function GET(req: NextRequest) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const feedId = req.nextUrl.searchParams.get('feed') ?? 'good'
  const feed = SIMPLE_WIKIPEDIA_FEEDS.find((f) => f.id === feedId)
  if (!feed) {
    return NextResponse.json(
      { error: 'BadRequest', message: `Unknown Simple Wikipedia feed: ${feedId}` },
      { status: 400 },
    )
  }

  try {
    const items = await listSimpleWikipediaFeed(feed.category, feed.id)

    let publishedSourceIds: string[] = []
    if (items.length > 0) {
      const supabase = await createClient()
      const sourceIds = items.map((i) => i.source_id)
      const { data } = await supabase
        .from('library_articles')
        .select('source_id')
        .in('source_id', sourceIds)
      publishedSourceIds = (data ?? []).map((r: { source_id: string }) => r.source_id)
      await upsertArticleSeeds(supabase, 'simple_wikipedia', feed.id, feed.label, items)
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
        { error: 'GatewayTimeout', message: 'Simple Wikipedia API 응답이 늦어 가져오지 못했습니다.' },
        { status: 504 },
      )
    }
    console.error('[simple_wikipedia-feed] failed:', message)
    return NextResponse.json(
      { error: 'InternalError', message: `Simple Wikipedia 가져오기 실패: ${message}` },
      { status: 500 },
    )
  }
}
