// apps/web/src/app/api/acp/dev-enqueue/route.ts
// ACP dev-only enqueue — service-role INSERT (admin_enqueue_article 재현).
//
// 배경: /api/acp/enqueue 는 admin_enqueue_article RPC(SECURITY DEFINER · is_admin_or_curator())
//   경유라, DEV_ADMIN_BYPASS 환경(=SSR 쿠키 세션 비어 auth.uid()=NULL)에서 RPC 가 Forbidden.
//   dev-process 는 service-role 이라 처리는 되지만 enqueue 자체가 막혀 dev 전체 ingest 불가였음.
//   본 라우트가 dev-process 와 동일 패턴(service-role · NODE_ENV 가드)으로 enqueue 갭을 해소.
//   프로덕션은 정규 /api/acp/enqueue(RPC) 사용 — 본 라우트는 NODE_ENV='production' 차단.
//
// body: { item_url: string; source?: ArticleSource; feed_id?: string }
// 동작: URL host(또는 명시 source)로 ingester 선택 → 본문 fetch → library_articles INSERT(status='queued').
//   INSERT 트리거(acp_classify_license)가 license_class/display_only/copyright_safe 자동 부여.

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  ingestElifeArticle,
  ingestFactbookArticle,
  ingestNasaArticle,
  ingestNihArticle,
  ingestOwidArticle,
  ingestSimpleWikipediaArticle,
  ingestTheConversationArticle,
  ingestPlosArticle,
  ingestVoaArticle,
  ingestWikinewsArticle,
  ingestWikipediaArticle,
  VOA_FEEDS,
  type RawArticle,
} from '@vocaflow/library-pipeline'

import { requireAdmin } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

type ArticleSource =
  | 'voa' | 'nasa' | 'nih' | 'simple_wikipedia' | 'the_conversation' | 'wikinews' | 'owid' | 'factbook' | 'elife' | 'wikipedia' | 'plos'

interface DevEnqueueBody {
  item_url?: string
  source?: ArticleSource
  feed_id?: string
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
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'dev-enqueue disabled in production — use /api/acp/enqueue' },
      { status: 403 },
    )
  }
  await requireAdmin('/admin/articles')

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 500 },
    )
  }

  let body: DevEnqueueBody
  try {
    body = (await request.json()) as DevEnqueueBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.item_url) {
    return NextResponse.json({ error: 'item_url required' }, { status: 400 })
  }
  const source = detectSource(body.item_url, body.source)
  if (!source) {
    return NextResponse.json({ error: 'Unknown source — URL host 미매칭 또는 source 필드 필요' }, { status: 400 })
  }

  try {
    let article: RawArticle
    switch (source) {
      case 'voa': {
        const feed = body.feed_id ? VOA_FEEDS.find((f) => f.id === body.feed_id) : undefined
        article = await ingestVoaArticle(body.item_url, feed?.level)
        break
      }
      case 'nasa':
        article = await ingestNasaArticle(body.item_url)
        break
      case 'nih':
        article = await ingestNihArticle(body.item_url)
        break
      case 'simple_wikipedia':
        article = await ingestSimpleWikipediaArticle(body.item_url)
        break
      case 'the_conversation':
        article = await ingestTheConversationArticle(body.item_url)
        break
      case 'wikinews':
        article = await ingestWikinewsArticle(body.item_url)
        break
      case 'owid':
        article = await ingestOwidArticle(body.item_url)
        break
      case 'factbook':
        article = await ingestFactbookArticle(body.item_url)
        break
      case 'elife':
        article = await ingestElifeArticle(body.item_url)
        break
      case 'wikipedia':
        article = await ingestWikipediaArticle(body.item_url)
        break
      case 'plos':
        article = await ingestPlosArticle(body.item_url)
        break
    }

    const client = createServiceClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // admin_enqueue_article 재현: dedup(source, source_id) → INSERT(status='queued').
    const { data: existing } = await client
      .from('library_articles')
      .select('id')
      .eq('source', article.source)
      .eq('source_id', article.source_id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({
        ok: true,
        article_id: (existing as { id: string }).id,
        existed: true,
        source: article.source,
      })
    }

    const { data, error } = await client
      .from('library_articles')
      .insert({
        source: article.source,
        source_id: article.source_id,
        title: article.title,
        author: article.author ?? null,
        source_url: article.source_url,
        published_at:
          article.published_at && !Number.isNaN(article.published_at.getTime())
            ? article.published_at.toISOString()
            : null,
        license: article.license,
        content: article.content,
        audio_url: article.audio_url ?? null,
        status: 'queued',
      })
      .select('id')
      .single()
    if (error) {
      throw new Error(`library_articles insert failed: ${error.message}`)
    }

    return NextResponse.json({
      ok: true,
      article_id: (data as { id: string }).id,
      source: article.source,
      license: article.license,
      word_count: article.content.split(/\s+/).filter(Boolean).length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
