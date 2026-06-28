// apps/web/src/app/api/admin/articles/delete/route.ts
//
// POST /api/admin/articles/delete   { article_id }
//   admin_delete_article 동등 로직 (서버사이드, v06.64).
//
// 외부 FK:
//   • library_article_vocabularies → CASCADE (자동 삭제)
//   • library_article_seed_catalog.imported_article_id → SET NULL (부분) — flags 는 수동 리셋
//   • shared_word_sets (category='library_article') — FK 없음, 수동 DELETE
//
// seed 완전 unlock: SET NULL 만으로는 imported_to_articles=true 잔존 → 재-GET 불가라
//   imported_to_articles=false, curation_status='pending' 까지 명시 리셋 (LCP 미러).
// published 글 은 revert 후 삭제 (LCP delete 와 동일 정책).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requireAdmin } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body {
  article_id?: string
}

const ALLOWED_STATUSES = new Set(['ready', 'archived', 'queued', 'failed'])

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
  if (!ALLOWED_STATUSES.has(a.status)) {
    return NextResponse.json(
      {
        error: 'DeleteBlocked',
        message:
          `Delete blocked: current status ${a.status} ` +
          `(allowed: ready/archived/queued/failed). Revert published articles first.`,
      },
      { status: 400 },
    )
  }

  // 1) shared_word_sets (이전 발행분 잔존 가능성)
  const { data: wsDeleted, error: wsErr } = await client
    .from('shared_word_sets')
    .delete()
    .eq('category', 'library_article')
    .eq('curation_query->>article_id', body.article_id)
    .select('id')
  if (wsErr) {
    return NextResponse.json({ error: 'DBError', message: wsErr.message }, { status: 500 })
  }

  // 2) seed catalog FULL unlock — FK SET NULL 은 imported_article_id 만 null 로 만들고
  //    imported_to_articles/curation_status 는 그대로라 seed 가 "잠긴" 채 → 재-GET 불가.
  //    LCP admin_bulk_requeue_books 와 동일하게 flags 리셋 (삭제 前 실행: 삭제되면 매칭 키 소실).
  const { data: seedUnlocked, error: seedErr } = await client
    .from('library_article_seed_catalog')
    .update({ imported_to_articles: false, imported_article_id: null, curation_status: 'pending' })
    .eq('imported_article_id', body.article_id)
    .select('id')
  if (seedErr) {
    return NextResponse.json({ error: 'DBError', message: seedErr.message }, { status: 500 })
  }

  // 3) 본체 삭제 (library_article_vocabularies CASCADE)
  const { error: delErr } = await client
    .from('library_articles')
    .delete()
    .eq('id', body.article_id)
  if (delErr) {
    return NextResponse.json({ error: 'DBError', message: delErr.message }, { status: 500 })
  }

  // texts.source_url='article:{id}' 마커는 그대로 (사용자 학습 진도 보존)

  return NextResponse.json({
    ok: true,
    deleted: true,
    status_was: a.status,
    word_sets_deleted: (wsDeleted ?? []).length,
    seed_unlocked: (seedUnlocked ?? []).length,
  })
}
