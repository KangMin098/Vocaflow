// apps/web/src/app/api/admin/articles/force-publish/route.ts
//
// POST /api/admin/articles/force-publish   { article_id }
//   admin_force_publish_article 동등 로직 (서버사이드).
//
// 배경 (v06.56): 기존 CuratedArticlesTab / AdminArticleReviewClient 가 브라우저
//   client.rpc('admin_force_publish_article') 를 호출했는데, DEV_ADMIN_BYPASS=1
//   환경에선 cookie 세션이 비어 auth.uid()=NULL → is_admin_or_curator()=false
//   → RPC throw "Forbidden". preview 화면에선 footer 영역 작은 표시로 무반응
//   처럼 보이고, list 에선 alert 으로 노출됐다.
//
// 해결: 책 v06.55 (force-publish-book) 와 동일 패턴 — requireAdmin 가드 +
//   service_role client. RPC 의 is_admin_or_curator() 가드를 우회하기 위해
//   RPC 대신 동등 로직 직접 실행. trg_publish_article_word_set trigger 가
//   자동으로 shared_word_sets 생성.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requireAdmin } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body {
  article_id?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  await requireAdmin('/admin/articles')

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.article_id) {
    return NextResponse.json({ error: 'article_id required' }, { status: 400 })
  }

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'ServerConfig', message: 'SUPABASE_URL / SERVICE_ROLE_KEY 누락' },
      { status: 500 },
    )
  }
  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: art, error: fetchErr } = await client
    .from('library_articles')
    .select('id, copyright_safe_in_kr, status, source, audio_url')
    .eq('id', body.article_id)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: 'DBError', message: fetchErr.message }, { status: 500 })
  }
  if (!art) {
    return NextResponse.json(
      { error: 'NotFound', message: `Article ${body.article_id} not found` },
      { status: 404 },
    )
  }
  const a = art as {
    id: string
    copyright_safe_in_kr: boolean
    status: string
    source: string
    audio_url: string | null
  }
  if (!a.copyright_safe_in_kr) {
    return NextResponse.json(
      { error: 'CopyrightGate', message: '저작권 미확인 (copyright_safe_in_kr=false) — 게시 불가' },
      { status: 400 },
    )
  }
  // P3/C5 — VOA = listening-first 학습 정체성: audio 미연결 발행 차단
  //   (DB 트리거 trg_la_require_audio 와 동일 규칙 · route 에서 친절한 메시지 선제 반환).
  if (a.source === 'voa' && !(a.audio_url && a.audio_url.trim())) {
    return NextResponse.json(
      { error: 'AudioGate', message: 'VOA 글은 오디오(audio_url) 연결 후 게시 가능 — 듣기 정체성' },
      { status: 400 },
    )
  }
  if (a.status === 'published') {
    return NextResponse.json({ ok: true, already_published: true })
  }

  const { error: updErr } = await client
    .from('library_articles')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', body.article_id)

  if (updErr) {
    return NextResponse.json({ error: 'DBError', message: updErr.message }, { status: 500 })
  }

  // trg_publish_article_word_set trigger 가 자동으로 publish_article_word_set 호출
  // → shared_word_sets(category='library_article') 1개 + shared_words 생성.

  return NextResponse.json({ ok: true, published: true })
}
