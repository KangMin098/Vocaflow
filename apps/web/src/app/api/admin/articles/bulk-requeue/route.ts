// apps/web/src/app/api/admin/articles/bulk-requeue/route.ts
//
// POST /api/admin/articles/bulk-requeue   { article_ids: string[] }
//   "→ 소스 GET" 일괄 — LCP admin_bulk_requeue_books 동등 로직 (서버사이드, service_role).
//   글 DELETE → library_article_vocabularies CASCADE + draft 단어장 DELETE + seed 완전 unlock.
//   가드: 발행 단어장 / 사용자 학습 텍스트(texts.source_url='article:{id}') 있으면 스킵.
//
// RPC(admin_bulk_requeue_articles) 가 아니라 라우트에서 직접 수행 — DEV_ADMIN_BYPASS 환경에서
//   SECURITY DEFINER RPC 의 is_admin_or_curator()=false 함정 회피 (delete 라우트와 동일 패턴).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requireAdmin } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body {
  article_ids?: string[]
}

const ELIGIBLE = new Set([
  'queued',
  'ingesting',
  'normalizing',
  'analyzing',
  'curating',
  'ready',
  'failed',
])

export async function POST(request: Request): Promise<NextResponse> {
  await requireAdmin('/admin/articles')

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const ids = (body.article_ids ?? []).filter((s): s is string => typeof s === 'string' && s.length > 0)
  if (ids.length === 0) {
    return NextResponse.json({ error: 'article_ids required' }, { status: 400 })
  }

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'ServerConfig', message: 'SUPABASE keys 누락' }, { status: 500 })
  }
  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: arts, error: fetchErr } = await client
    .from('library_articles')
    .select('id, status')
    .in('id', ids)
  if (fetchErr) {
    return NextResponse.json({ error: 'DBError', message: fetchErr.message }, { status: 500 })
  }
  const rows = (arts ?? []) as Array<{ id: string; status: string }>

  let deleted = 0
  let setsDeleted = 0
  let seedUnlocked = 0
  let blockedByUsers = 0
  let blockedByPublished = 0

  for (const a of rows) {
    if (!ELIGIBLE.has(a.status)) continue // 부적격(published/archived) → skipped 로 집계

    // 1) 발행 단어장 가드
    const { count: pubCount } = await client
      .from('shared_word_sets')
      .select('id', { count: 'exact', head: true })
      .eq('category', 'library_article')
      .eq('curation_query->>article_id', a.id)
      .eq('is_published', true)
    if ((pubCount ?? 0) > 0) {
      blockedByPublished += 1
      continue
    }

    // 2) 사용자 학습 텍스트 가드
    const { count: userCount } = await client
      .from('texts')
      .select('id', { count: 'exact', head: true })
      .eq('source_url', `article:${a.id}`)
    if ((userCount ?? 0) > 0) {
      blockedByUsers += 1
      continue
    }

    // 3) draft 단어장 DELETE
    const { data: ds } = await client
      .from('shared_word_sets')
      .delete()
      .eq('category', 'library_article')
      .eq('curation_query->>article_id', a.id)
      .eq('is_published', false)
      .select('id')
    setsDeleted += (ds ?? []).length

    // 4) seed 완전 unlock (재-GET 가능하도록)
    const { data: su } = await client
      .from('library_article_seed_catalog')
      .update({ imported_to_articles: false, imported_article_id: null, curation_status: 'pending' })
      .eq('imported_article_id', a.id)
      .select('id')
    seedUnlocked += (su ?? []).length

    // 5) 글 DELETE (library_article_vocabularies CASCADE)
    const { error: delErr } = await client.from('library_articles').delete().eq('id', a.id)
    if (delErr) {
      return NextResponse.json({ error: 'DBError', message: delErr.message }, { status: 500 })
    }
    deleted += 1
  }

  return NextResponse.json({
    ok: true,
    deleted_count: deleted,
    skipped_count: ids.length - deleted,
    word_sets_deleted: setsDeleted,
    seed_unlocked: seedUnlocked,
    blocked_by_users: blockedByUsers,
    blocked_by_published: blockedByPublished,
  })
}
