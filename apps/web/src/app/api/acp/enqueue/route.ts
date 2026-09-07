// apps/web/src/app/api/acp/enqueue/route.ts
// ACP v1.0 — article 1건 큐 추가 (v06.69 arxiv 제거 후 6종).
//
// POST /api/acp/enqueue
// body: {
//   item_url?: string;       // RSS item URL
//   feed_id?: string;        // (선택) VOA level 힌트용
//   source?: ArticleSource;  // 'voa' | 'nasa' | 'nih' | 'wikinews' | 'the_conversation' | 'simple_wikipedia' (URL host 로 자동 추론도 가능)
// }
//
// 동작: URL host (또는 명시 source) 로 ingester 선택 → 본문 fetch → admin_enqueue_article RPC.

import { NextResponse } from 'next/server'
import {
  ingestElifeArticle,
  ingestFactbookArticle,
  ingestNasaArticle,
  ingestSpacePlaceArticle,
  ingestStoryweaverArticle,
  ingestNihArticle,
  ingestNoaaArticle,
  ingestOwidArticle,
  ingestSimpleWikipediaArticle,
  ingestTheConversationArticle,
  ingestPlosArticle,
  ingestUsgsArticle,
  ingestVoaArticle,
  ingestWikinewsArticle,
  ingestWikipediaArticle,
  ingestWikivoyageArticle,
  VOA_FEEDS,
  type RawArticle,
} from '@vocaflow/library-pipeline'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'
import { markSeedImported, type SeedSource } from '@/lib/acp/seed-upsert'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// v06.69 — arxiv 제거 (사용자 명시: "플랫폼 전체에서 삭제"). 6종.
type ArticleSource =
  | 'voa' | 'nasa' | 'nih' | 'simple_wikipedia' | 'the_conversation' | 'wikinews' | 'owid' | 'factbook' | 'elife' | 'wikipedia' | 'plos' | 'wikivoyage' | 'usgs' | 'noaa' | 'storyweaver' | 'space_place'

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
  { pattern: /^https?:\/\/simple\.wikipedia\.org\/wiki\//, source: 'simple_wikipedia' },
  { pattern: /^https?:\/\/theconversation\.com\//, source: 'the_conversation' },
  { pattern: /^https?:\/\/en\.wikinews\.org\/wiki\//, source: 'wikinews' },
  { pattern: /^https?:\/\/ourworldindata\.org\//, source: 'owid' },
  { pattern: /^https:\/\/raw\.githubusercontent\.com\/factbook\/factbook\.json\//, source: 'factbook' },
  { pattern: /^https?:\/\/(?:www\.)?elifesciences\.org\/articles\//, source: 'elife' },
  { pattern: /^https?:\/\/en\.wikipedia\.org\/wiki\//, source: 'wikipedia' },
  { pattern: /^https?:\/\/journals\.plos\.org\//, source: 'plos' },
  { pattern: /^https?:\/\/en\.wikivoyage\.org\/wiki\//, source: 'wikivoyage' },
  { pattern: /^https?:\/\/(?:www\.)?usgs\.gov\/news\//, source: 'usgs' },
  { pattern: /^https?:\/\/(?:www\.)?climate\.gov\/news-features\//, source: 'noaa' },
  { pattern: /^https?:\/\/storyweaver\.org\.in\/stories\//, source: 'storyweaver' },
  { pattern: /^https?:\/\/spaceplace\.nasa\.gov\/[a-z0-9-]+\//, source: 'space_place' },
]

function detectSource(url: string | undefined, explicit?: ArticleSource): ArticleSource | null {
  if (explicit) return explicit
  if (!url) return null
  for (const { pattern, source } of HOST_TO_SOURCE) {
    if (pattern.test(url)) return source
  }
  return null
}

export async function POST(request: Request): Promise<NextResponse> {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

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
          'Unknown source — URL host 가 VOA / NASA / NIH / Simple Wikipedia / The Conversation / Wikinews / OWID / Factbook / eLife / Wikipedia 중 하나여야 하거나 source 필드 명시 필요',
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
      case 'simple_wikipedia': {
        article = await ingestSimpleWikipediaArticle(body.item_url)
        break
      }
      case 'the_conversation': {
        article = await ingestTheConversationArticle(body.item_url)
        break
      }
      case 'wikinews': {
        article = await ingestWikinewsArticle(body.item_url)
        break
      }
      case 'owid': {
        article = await ingestOwidArticle(body.item_url)
        break
      }
      case 'factbook': {
        article = await ingestFactbookArticle(body.item_url)
        break
      }
      case 'elife': {
        article = await ingestElifeArticle(body.item_url)
        break
      }
      case 'wikipedia': {
        article = await ingestWikipediaArticle(body.item_url)
        break
      }
      case 'plos': {
        article = await ingestPlosArticle(body.item_url)
        break
      }
      case 'wikivoyage': {
        article = await ingestWikivoyageArticle(body.item_url)
        break
      }
      case 'usgs': {
        article = await ingestUsgsArticle(body.item_url)
        break
      }
      case 'noaa': {
        article = await ingestNoaaArticle(body.item_url)
        break
      }
      case 'storyweaver': {
        article = await ingestStoryweaverArticle(body.item_url)
        break
      }
      case 'space_place': {
        article = await ingestSpacePlaceArticle(body.item_url)
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

    // feed_label 승계 — 시드(library_article_seed_catalog)에서 프로그램/시리즈 라벨 조회.
    //   picker '소스 → 프로그램 → 컨텐츠' 하위 분류의 근거 (v06.135).
    const { data: seedRow } = await supabase
      .from('library_article_seed_catalog')
      .select('feed_label')
      .eq('source', article.source)
      .eq('source_url', article.source_url)
      .maybeSingle()
    const feedLabel = (seedRow as { feed_label: string | null } | null)?.feed_label ?? null

    const { data, error } = await sb.rpc('admin_enqueue_article', {
      p_source: article.source,
      p_source_id: article.source_id,
      p_title: article.title,
      p_author: article.author ?? null,
      p_url: article.source_url,
      // Invalid Date 방어 — getTime() NaN 이면 toISOString() 이 "Invalid time value" throw.
      p_published_at:
        article.published_at && !Number.isNaN(article.published_at.getTime())
          ? article.published_at.toISOString()
          : null,
      p_license: article.license,
      p_content: article.content,
      // v06.45 — audio_url (LCP librivox_audio 와 동일 연계). VOA = 학습 정체성으로 거의 100% 존재.
      p_audio_url: article.audio_url ?? null,
      // v06.135 — 프로그램(feed) 라벨 승계 (picker 소스 하위 분류)
      p_feed_id: body.feed_id ?? null,
      p_feed_label: feedLabel,
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
