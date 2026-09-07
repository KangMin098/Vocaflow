// apps/web/src/app/api/admin/articles/plos-feed/route.ts
// ACP 대량 GET — PLOS 최근 오픈 학술 논문 목록 (solr API · BulkArticlesTab 용).
//
// GET /api/admin/articles/plos-feed?feed=recent|essay
//
// feed=essay 는 PLOS 의 논증 지면(Essay·Perspective·Opinion·Unsolved Mystery).
// 2026-08-21 실측에서 논증문 교재 가용 재고가 0 이었고, CC BY 논증문 공급선은 여기뿐이다.

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'
import { listPlosFeed, PLOS_FEEDS } from '@vocaflow/library-pipeline'
import { upsertArticleSeeds } from '@/lib/acp/seed-upsert'

export const runtime = 'nodejs'
export const revalidate = 600

export async function GET(req: NextRequest) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const rows = Math.min(50, Math.max(5, parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10) || 20))

  const feedId = req.nextUrl.searchParams.get('feed') ?? 'recent'
  const feed = PLOS_FEEDS.find((f) => f.id === feedId)
  if (!feed) {
    return NextResponse.json(
      { error: 'BadRequest', message: `Unknown PLOS feed: ${feedId}` },
      { status: 400 },
    )
  }

  try {
    const items = await listPlosFeed(feed.id, rows)

    let publishedSourceIds: string[] = []
    if (items.length > 0) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('library_articles')
        .select('source_id')
        .in('source_id', items.map((i) => i.source_id))
      publishedSourceIds = (data ?? []).map((r: { source_id: string }) => r.source_id)
      await upsertArticleSeeds(supabase, 'plos', feed.id, feed.label, items)
    }

    return NextResponse.json(
      { feed_id: feed.id, label: feed.label, items, publishedSourceIds },
      { status: 200, headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    console.error('[plos-feed] failed:', msg)
    return NextResponse.json(
      { error: 'InternalError', message: `PLOS solr 가져오기 실패: ${msg}. URL 직접 입력으로 우회하세요.` },
      { status: 502 },
    )
  }
}
