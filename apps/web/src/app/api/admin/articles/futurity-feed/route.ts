// apps/web/src/app/api/admin/articles/futurity-feed/route.ts
// ACP 대량 GET — Futurity 대학 연구 기사 목록 (워드프레스 RSS · BulkArticlesTab 용).
//
// GET /api/admin/articles/futurity-feed?feed=all
//
// Futurity 는 CC BY 4.0 이라 본문을 그대로 쓰고 변형할 수 있다(= 문항화 가능).
// 라이선스 근거는 **기사 페이지**에 있다 — about 페이지에는 "All rights reserved"(사이트 크롬).
//
// 응답:
//   200 { feed_id, label, items, publishedSourceIds }
//   400/401/502/504 — 표준 에러

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'
import { listFuturityFeed, FUTURITY_FEEDS } from '@vocaflow/library-pipeline'
import { upsertArticleSeeds } from '@/lib/acp/seed-upsert'

export const runtime = 'nodejs'
export const revalidate = 600

export async function GET(req: NextRequest) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const feedId = req.nextUrl.searchParams.get('feed') ?? 'all'
  const feed = FUTURITY_FEEDS.find((f) => f.id === feedId)
  if (!feed) {
    return NextResponse.json(
      { error: 'BadRequest', message: `Unknown Futurity feed: ${feedId}` },
      { status: 400 },
    )
  }

  try {
    const items = await listFuturityFeed(feed.url, feed.id)

    // 이미 가진 것을 지우지 않고 **표시만** 한다 — 다른 소스와 같은 규칙.
    let publishedSourceIds: string[] = []
    if (items.length > 0) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('library_articles')
        .select('source_id')
        .in(
          'source_id',
          items.map((i) => i.source_id),
        )
      publishedSourceIds = (data ?? []).map((r: { source_id: string }) => r.source_id)
      await upsertArticleSeeds(supabase, 'futurity', feed.id, feed.label, items)
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
        { error: 'GatewayTimeout', message: 'Futurity RSS 응답이 늦어 가져오지 못했습니다.' },
        { status: 504 },
      )
    }
    console.error('[futurity-feed] failed:', message)
    return NextResponse.json(
      {
        error: 'InternalError',
        message: `Futurity RSS 가져오기 실패: ${message}. URL 직접 입력으로 우회하세요.`,
        feed_url: feed.url,
      },
      { status: 502 },
    )
  }
}
