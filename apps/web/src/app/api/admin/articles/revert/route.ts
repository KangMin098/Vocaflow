// apps/web/src/app/api/admin/articles/revert/route.ts
//
// POST /api/admin/articles/revert   { article_id }
//   admin_revert_published_article 동등 로직 (서버사이드).
//
// v06.57 force-publish 와 동일 패턴 — requireAdminApi + service_role + 동등 로직 직접 실행.
//   (브라우저 client.rpc() 는 DEV_ADMIN_BYPASS=1 환경에서 auth.uid()=NULL → Forbidden.)

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body {
  article_id?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

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
    .select('id, status')
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
  const a = art as { id: string; status: string }
  if (a.status !== 'published') {
    return NextResponse.json(
      { error: 'NotPublished', message: `Article is not published (current: ${a.status})` },
      { status: 400 },
    )
  }

  // 1) shared_word_sets (library_article) 삭제
  const { data: wsDeleted, error: delErr } = await client
    .from('shared_word_sets')
    .delete()
    .eq('category', 'library_article')
    .eq('curation_query->>article_id', body.article_id)
    .select('id')
  if (delErr) {
    return NextResponse.json({ error: 'DBError', message: delErr.message }, { status: 500 })
  }

  // 2) status='ready', published_at=NULL
  const { error: updErr } = await client
    .from('library_articles')
    .update({ status: 'ready', published_at: null })
    .eq('id', body.article_id)
  if (updErr) {
    return NextResponse.json({ error: 'DBError', message: updErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    reverted: true,
    deleted_word_sets: (wsDeleted ?? []).length,
  })
}
