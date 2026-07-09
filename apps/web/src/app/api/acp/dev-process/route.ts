// apps/web/src/app/api/acp/dev-process/route.ts
// ACP v1.0 Phase 18 — Admin "지금 처리 (dev)" 트리거
//
// POST /api/acp/dev-process
// body: { article_id: string }
//
// 동작: library_articles row → normalize → analyzeArticle → status='ready'
// 프로덕션 차단 (NODE_ENV='production' → 403). pg_cron 워커는 별도 (article_pipeline 큐 추후 구현).

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  analyzeArticle,
  computeLexicalNoise,
  normalizePunctuation,
  reflowSoftHyphens,
} from '@vocaflow/library-pipeline'
import type { RawArticle, NormalizedArticle } from '@vocaflow/library-pipeline'

import { requireAdmin } from '@/lib/auth/require-admin'

// ACP §18 §4-B — 소스별 register 기본값 (문서별 재분류 가능)
const REGISTER_BY_SOURCE: Record<string, string> = {
  voa: 'news',
  nasa: 'expository',
  nih: 'expository',
  medlineplus: 'expository',
  simple_wikipedia: 'expository',
  the_conversation: 'argumentative',
  wikinews: 'news',
  owid: 'argumentative', // T-2 — 데이터 논증문. argumentative gap 보강(the_conversation=ND display_only 대비 발행 가능)
  factbook: 'reference', // 국가 개요(Background). reference gap 보강(PD → 발행 가능)
}

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

interface DevProcessBody {
  article_id: string
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'dev-process disabled in production' },
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

  let body: DevProcessBody
  try {
    body = (await request.json()) as DevProcessBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.article_id) {
    return NextResponse.json({ error: 'article_id required' }, { status: 400 })
  }

  const client = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    // 1) article row fetch
    const { data: article, error: fetchErr } = await client
      .from('library_articles')
      .select(
        'id, source, source_id, source_url, title, author, language, license, content, published_at, status',
      )
      .eq('id', body.article_id)
      .single()
    if (fetchErr || !article) {
      throw new Error(`Article not found: ${body.article_id} (${fetchErr?.message ?? 'no row'})`)
    }

    const updateStatus = async (s: string): Promise<void> => {
      await client.from('library_articles').update({ status: s }).eq('id', body.article_id)
    }

    // 2) normalize (구두점 통일 + reflow — article 은 boundary/TOC 단계 불필요)
    await updateStatus('normalizing')
    const body_text = reflowSoftHyphens(normalizePunctuation(article.content as string))
    const norm: NormalizedArticle = {
      raw: {
        source: article.source,
        source_id: article.source_id,
        source_url: article.source_url ?? '',
        title: article.title,
        author: article.author ?? undefined,
        language: article.language ?? 'en',
        license: article.license,
        published_at: article.published_at ? new Date(article.published_at) : null,
        content: article.content,
        estimated_cefr: null,
        fetched_at: new Date(),
      } as RawArticle,
      body: body_text,
      body_hash: await sha256(body_text),
    }

    // 3) analyze
    await updateStatus('analyzing')
    const result = await analyzeArticle(body.article_id, norm)

    // 3-1) v06.51 — article_v_level (book_v_level 동일 알고리즘: P75 DISTINCT lemma, V11 제외)
    //      vocab INSERT 직후 호출 — select_article_vocab 의 V-Level 게이트 baseline.
    {
      const sb = client as unknown as {
        rpc: (n: string, p: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
      }
      const { error: vrlErr } = await sb.rpc('compute_article_vrl', { p_article_id: body.article_id })
      if (vrlErr) {
        // VRL 산출 실패는 치명적 X — article_v_level NULL 이면 select_article_vocab 가 V4 fallback
        console.warn('[acp/dev-process] compute_article_vrl warning:', vrlErr.message)
      }
    }

    // 4) library_articles 메타 업데이트 + status='ready' (dev 는 auto_curate 우회)
    //    ACP §18 §4-B/§4-C — register(소스 기본) + lexical_noise(텍스트 청결) 산출.
    //    noise>0.08 이면 발행 트리거가 단어세트 발행 SKIP(읽기용만).
    const lexicalNoise = computeLexicalNoise(body_text)
    await client
      .from('library_articles')
      .update({
        cefr_level: result.cefr_level,
        cefr_confidence: result.cefr_confidence,
        word_count: result.word_count,
        reading_minutes: result.reading_minutes,
        llm_cost_usd: result.llm_cost_usd,
        register: REGISTER_BY_SOURCE[article.source as string] ?? null,
        lexical_noise: lexicalNoise,
        status: 'ready',
        status_message:
          lexicalNoise > 0.08
            ? `lexical_noise ${lexicalNoise} > 0.08 — 단어세트 미발행(읽기용)`
            : null,
        content_hash: norm.body_hash,
      })
      .eq('id', body.article_id)

    return NextResponse.json({
      ok: true,
      article_id: body.article_id,
      decision: 'ready_for_review',
      cefr_level: result.cefr_level,
      cefr_confidence: result.cefr_confidence,
      vocab_count: result.words.length,
      llm_cost: result.llm_cost_usd,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[acp/dev-process] article_id=${body.article_id} failed:`, err)
    await client
      .from('library_articles')
      .update({ status: 'failed', status_message: msg.slice(0, 500) })
      .eq('id', body.article_id)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

async function sha256(s: string): Promise<string> {
  // bare 'crypto' — Next.js 14 webpack 이 'node:' scheme 동적 import 를 못 다룸(UnhandledSchemeError).
  const crypto = await import('crypto')
  return crypto.createHash('sha256').update(s).digest('hex')
}
