// apps/web/src/app/api/acp/enqueue/route.ts
// ACP v1.0 Phase 18 (VOA) + Phase 19 (NASA · NIH · arXiv) — article 1건 큐 추가
//
// POST /api/acp/enqueue
// body: {
//   item_url?: string;       // RSS item URL or arxiv:id
//   feed_id?: string;        // (선택) VOA level 힌트용
//   source?: ArticleSource;  // 'voa' | 'nasa' | 'nih' | 'arxiv' (URL host 로 자동 추론도 가능)
// }
//
// 동작: URL host (또는 명시 source) 로 ingester 선택 → 본문 fetch → admin_enqueue_article RPC.

import { NextResponse } from 'next/server'
import {
  ARXIV_FEEDS,
  ingestArxivArticle,
  ingestNasaArticle,
  ingestNihArticle,
  ingestVoaArticle,
  VOA_FEEDS,
  type RawArticle,
} from '@vocaflow/library-pipeline'

import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { markSeedImported, type SeedSource } from '@/lib/acp/seed-upsert'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ArticleSource = 'voa' | 'nasa' | 'nih' | 'arxiv'

interface EnqueueBody {
  feed_id?: string
  item_url?: string
  source?: ArticleSource
}

const HOST_TO_SOURCE: Array<{ pattern: RegExp; source: ArticleSource }> = [
  { pattern: /^https:\/\/learningenglish\.voanews\.com\//, source: 'voa' },
  { pattern: /^https:\/\/(?:www\.)?nasa\.gov\//, source: 'nasa' },
  { pattern: /^https:\/\/apod\.nasa\.gov\//, source: 'nasa' },
  { pattern: /^https:\/\/(?:www\.)?nih\.gov\//, source: 'nih' },
  { pattern: /^https:\/\/medlineplus\.gov\//, source: 'nih' },
  { pattern: /^https:\/\/directorsblog\.nih\.gov\//, source: 'nih' },
  { pattern: /^https?:\/\/(?:www\.)?arxiv\.org\//, source: 'arxiv' },
]

function detectSource(url: string | undefined, explicit?: ArticleSource): ArticleSource | null {
  if (explicit) return explicit
  if (!url) return null
  for (const { pattern, source } of HOST_TO_SOURCE) {
    if (pattern.test(url)) return source
  }
  // arxiv:2401.12345 같은 ID 직접 입력
  if (/^arxiv:[\d.]+/i.test(url) || /^\d{4}\.\d{4,5}(?:v\d+)?$/.test(url)) return 'arxiv'
  return null
}

export async function POST(request: Request): Promise<NextResponse> {
  await requireAdmin('/admin/articles')

  let body: EnqueueBody
  try {
    body = (await request.json()) as EnqueueBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.item_url) {
    return NextResponse.json({ error: 'item_url required' }, { status: 400 })
  }
  const source = detectSource(body.item_url, body.source)
  if (!source) {
    return NextResponse.json(
      {
        error:
          'Unknown source — URL host 가 VOA / NASA / NIH / arXiv 중 하나여야 하거나 source 필드 명시 필요',
      },
      { status: 400 },
    )
  }

  try {
    // 1. source 별 ingester 분기
    let article: RawArticle
    switch (source) {
      case 'voa': {
        const feed = body.feed_id ? VOA_FEEDS.find((f) => f.id === body.feed_id) : undefined
        article = await ingestVoaArticle(body.item_url, feed?.level)
        break
      }
      case 'nasa': {
        article = await ingestNasaArticle(body.item_url)
        break
      }
      case 'nih': {
        article = await ingestNihArticle(body.item_url)
        break
      }
      case 'arxiv': {
        const feed = body.feed_id ? ARXIV_FEEDS.find((f) => f.id === body.feed_id) : undefined
        article = await ingestArxivArticle(body.item_url, feed?.url)
        break
      }
    }

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
      // v06.45 — audio_url (LCP librivox_audio 와 동일 연계). VOA = 학습 정체성으로 거의 100% 존재.
      p_audio_url: article.audio_url ?? null,
    })

    if (error) {
      throw new Error(`admin_enqueue_article failed: ${error.message}`)
    }

    // v06.46 — seed_catalog 추적: 해당 seed 에 imported_to_articles=true 마킹
    if (typeof data === 'string' && data.length > 0) {
      await markSeedImported(
        supabase as unknown as Parameters<typeof markSeedImported>[0],
        article.source as SeedSource,
        article.source_id,
        data,
      )
    }

    return NextResponse.json({
      ok: true,
      article_id: data,
      source: article.source,
      title: article.title,
      cefr_hint: article.estimated_cefr,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[acp/enqueue] failed:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
