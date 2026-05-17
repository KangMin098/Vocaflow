// apps/web/src/app/api/acp/enqueue/route.ts
// ACP v1.0 Phase 18 — VOA article 1건 큐 추가 (관리자 트리거)
//
// POST /api/acp/enqueue
// body: { feed_id: string; item_url: string }
//
// 동작: VOA item URL → ingestVoaArticle 으로 본문 fetch + 메타 → admin_enqueue_article RPC.
// 결과로 library_articles.id 반환. UI 가 자동으로 dev-process 호출 가능.

import { NextResponse } from 'next/server'
import { ingestVoaArticle, VOA_FEEDS } from '@vocaflow/library-pipeline'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface EnqueueBody {
  feed_id?: string
  item_url: string
}

export async function POST(request: Request): Promise<NextResponse> {
  await requireAdmin('/admin/articles')

  let body: EnqueueBody
  try {
    body = (await request.json()) as EnqueueBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.item_url || !/^https:\/\/learningenglish\.voanews\.com\//.test(body.item_url)) {
    return NextResponse.json(
      { error: 'item_url required (VOA host)' },
      { status: 400 },
    )
  }

  const feed = body.feed_id ? VOA_FEEDS.find((f) => f.id === body.feed_id) : undefined
  const level = feed?.level

  try {
    // 1. RSS item URL → 본문/메타 fetch
    const article = await ingestVoaArticle(body.item_url, level)

    // 2. admin_enqueue_article RPC 호출 (RLS 통과)
    const supabase = await createClient()
    const sb = supabase as unknown as {
      rpc: (
        name: string,
        params: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    }

    const { data, error } = await sb.rpc('admin_enqueue_article', {
      p_source: article.source,
      p_source_id: article.source_id,
      p_title: article.title,
      p_author: article.author ?? null,
      p_url: article.source_url,
      p_published_at: article.published_at?.toISOString() ?? null,
      p_license: article.license,
      p_content: article.content,
    })

    if (error) {
      throw new Error(`admin_enqueue_article failed: ${error.message}`)
    }

    return NextResponse.json({
      ok: true,
      article_id: data,
      title: article.title,
      cefr_hint: article.estimated_cefr,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[acp/enqueue] failed:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
