// apps/web/src/app/api/admin/articles/elife-feed/route.ts
// ACP 대량 GET — eLife 최근 기사 목록 (digest 후보 · BulkArticlesTab 용).
//
// GET /api/admin/articles/elife-feed?feed=all  (feed 무의미 — API 최신순)

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'
import { listElifeFeed } from '@vocaflow/library-pipeline'
import { upsertArticleSeeds } from '@/lib/acp/seed-upsert'

export const runtime = 'nodejs'
export const revalidate = 600

const FEED_LABEL = 'Recent (digest)'

export async function GET(req: NextRequest) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const perPage = Math.min(50, Math.max(5, parseInt(req.nextUrl.searchParams.get('limit') ?? '30', 10) || 30))

  try {
    const items = await listElifeFeed(perPage)

    let publishedSourceIds: string[] = []
    if (items.length > 0) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('library_articles')
        .select('source_id')
        .in('source_id', items.map((i) => i.source_id))
      publishedSourceIds = (data ?? []).map((r: { source_id: string }) => r.source_id)
      await upsertArticleSeeds(supabase, 'elife', 'all', FEED_LABEL, items)
    }

    return NextResponse.json(
      { feed_id: 'all', label: FEED_LABEL, items, publishedSourceIds },
      { status: 200, headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    console.error('[elife-feed] failed:', msg)
    return NextResponse.json(
      { error: 'InternalError', message: `eLife API 가져오기 실패: ${msg}. URL 직접 입력으로 우회하세요.` },
      { status: 502 },
    )
  }
}
