// apps/web/src/app/api/admin/articles/voa-feed/route.ts
// ACP v1.0 Phase 18 — VOA RSS feed 항목 목록 (큐레이션 진입점)
//
// GET /api/admin/articles/voa-feed?feed=<feed_id>
//
// 응답:
//   200 { feed_id, label, level, items: VoaListItem[] }
//   400/401/404/504 — 표준 에러

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'
import { listVoaFeed, VOA_FEEDS } from '@vocaflow/library-pipeline'
import { upsertArticleSeeds } from '@/lib/acp/seed-upsert'

export const runtime = 'nodejs'
export const revalidate = 600

export async function GET(req: NextRequest) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const feedId = req.nextUrl.searchParams.get('feed') ?? 'as-it-is'
  const feed = VOA_FEEDS.find((f) => f.id === feedId)
  if (!feed) {
    return NextResponse.json(
      { error: 'BadRequest', message: `Unknown VOA feed: ${feedId}` },
      { status: 400 },
    )
  }

  try {
    const items = await listVoaFeed(feed.url, feed.id)

    // v06.41 — 이미 발행된 source_id 표시 (제거 X, 가시화)
    // v06.46 — seed_catalog 영구 보존 upsert (LCP library_seed_catalog 동형)
    let publishedSourceIds: string[] = []
    if (items.length > 0) {
      const supabase = await createClient()
      const sourceIds = items.map((i) => i.source_id)
      const { data } = await supabase
        .from('library_articles')
        .select('source_id')
        .in('source_id', sourceIds)
      publishedSourceIds = (data ?? []).map((r: { source_id: string }) => r.source_id)

      // seed_catalog upsert — 영구 보존 (새로고침해도 사라지지 않음)
      await upsertArticleSeeds(supabase, 'voa', feed.id, feed.label, items)
    }

    return NextResponse.json(
      {
        feed_id: feed.id,
        label: feed.label,
        level: feed.level,
        items,
        publishedSourceIds,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
        },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    if (message.includes('timeout') || message.includes('AbortError')) {
      return NextResponse.json(
        { error: 'GatewayTimeout', message: 'VOA RSS 응답이 늦어 가져오지 못했습니다.' },
        { status: 504 },
      )
    }
    console.error('[voa-feed] failed:', message)
    // 원인 진단을 위해 실제 에러 메시지 노출 (admin 만 접근 가능 — 권한 가드 통과 후)
    return NextResponse.json(
      {
        error: 'InternalError',
        message: `VOA RSS 가져오기 실패: ${message}. URL 직접 입력으로 우회하세요.`,
        feed_url: feed.url,
        hint:
          'VOA WAF 가 서버 fetch 를 403 차단할 수 있습니다. URL 직접 입력 모드로 article URL 을 붙여넣어 큐에 추가하세요.',
      },
      { status: 500 },
    )
  }
}
