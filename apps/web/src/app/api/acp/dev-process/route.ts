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
  assessReadingLoad,
  computeLexicalNoise,
  normalizePunctuation,
  reflowSoftHyphens,
  resolveArticleRegister,
} from '@vocaflow/library-pipeline'
import type { RawArticle, NormalizedArticle } from '@vocaflow/library-pipeline'

import { requireAdmin } from '@/lib/auth/require-admin'

// ACP §18 §4-B — register 는 (source, feed_id) 단위로 산정 (resolveArticleRegister).
//   VOA 처럼 피드마다 글 유형이 다른 소스의 오분류 교정 (american-stories=narrative 등).

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
        'id, source, source_id, source_url, title, author, language, license, content, published_at, status, feed_id',
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
    // ⚠️ 기사는 HTML 이라 줄바꿈 하이픈이 없다(322편 전수 실측 0건). 배치 경로와 같은 설정이어야
    //   화면으로 처리한 글과 배치로 처리한 글의 어휘가 갈리지 않는다 — reflow.ts 주석 참조.
    const body_text = reflowSoftHyphens(normalizePunctuation(article.content as string), {
      joinHyphenLineBreaks: false,
    })
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
      // CTP ① — syntax_score(구문 난이도) 산출. 실패해도 치명적 X(뷰가 NULL 노출).
      const { error: synErr } = await sb.rpc('compute_article_syntax', { p_article_id: body.article_id })
      if (synErr) {
        console.warn('[acp/dev-process] compute_article_syntax warning:', synErr.message)
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
        register: resolveArticleRegister(
          article.source as string,
          (article.feed_id as string | null) ?? null,
        ),
        lexical_noise: lexicalNoise,
        status: 'ready',
        // 표시할 것이 둘 이상일 수 있다 — 앞의 것만 남기면 뒤의 것이 조용히 사라진다.
        //   길이 판단은 `assessReadingLoad` 한 곳에 있다(배치 경로와 같은 답을 내야 한다).
        status_message:
          [
            lexicalNoise > 0.08
              ? `lexical_noise ${lexicalNoise} > 0.08 — 단어세트 미발행(읽기용)`
              : null,
            assessReadingLoad(result.word_count).note,
          ]
            .filter(Boolean)
            .join(' · ') || null,
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
