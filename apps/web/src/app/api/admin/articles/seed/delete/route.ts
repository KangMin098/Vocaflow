// apps/web/src/app/api/admin/articles/seed/delete/route.ts
//
// POST /api/admin/articles/seed/delete   { seed_ids: string[], hard?: boolean }
//
// v06.74 — LCP 대량 list 에서 row 삭제. 분기:
//   • 미발행 seed (imported_to_articles=false 또는 article 없음):
//       - hard=false (default): seed.curation_status='hidden' (soft hide — 다시 GET 시 재노출)
//       - hard=true: seed_catalog 영구 삭제
//   • 발행된 seed (article 존재):
//       - admin_delete_article 동등 로직 (article + word_sets 정리)
//       - seed.curation_status='hidden' + imported_to_articles=false 해제 → 다시 GET 가능
//
// 응답: { ok, deleted: number, hidden: number, articleDeleted: number, errors: [] }

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body {
  seed_ids?: string[]
  hard?: boolean
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
  const seedIds = (body.seed_ids ?? []).filter((s): s is string => typeof s === 'string')
  if (seedIds.length === 0) {
    return NextResponse.json({ error: 'seed_ids required' }, { status: 400 })
  }
  const hard = body.hard === true

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

  // 1) seed rows fetch (imported_article_id 확인)
  const { data: seeds, error: seedErr } = await client
    .from('library_article_seed_catalog')
    .select('id, imported_article_id, imported_to_articles')
    .in('id', seedIds)
  if (seedErr) {
    return NextResponse.json({ error: 'DBError', message: seedErr.message }, { status: 500 })
  }
  const seedRows = (seeds ?? []) as Array<{
    id: string
    imported_article_id: string | null
    imported_to_articles: boolean
  }>

  const articleIds = seedRows.map((s) => s.imported_article_id).filter((id): id is string => !!id)

  let articleDeleted = 0
  const errors: string[] = []

  // 2) article 삭제 (있으면)
  if (articleIds.length > 0) {
    // article status 확인 — published 제외 (revert 먼저 안내)
    const { data: articles, error: artFetchErr } = await client
      .from('library_articles')
      .select('id, status, title')
      .in('id', articleIds)
    if (artFetchErr) {
      return NextResponse.json({ error: 'DBError', message: artFetchErr.message }, { status: 500 })
    }
    const arts = (articles ?? []) as Array<{ id: string; status: string; title: string }>

    const deletable = arts.filter((a) =>
      ['ready', 'archived', 'queued', 'failed', 'normalizing', 'analyzing', 'curating'].includes(
        a.status,
      ),
    )
    const blocked = arts.filter((a) => a.status === 'published')
    for (const b of blocked) {
      errors.push(`"${b.title}" — published 상태는 먼저 검토대기로 되돌려야 삭제 가능`)
    }

    // 삭제 가능 article 들의 word_sets 정리 + 본체 삭제
    if (deletable.length > 0) {
      const delIds = deletable.map((a) => a.id)
      // shared_word_sets 정리 (이전 발행분 잔존)
      await client
        .from('shared_word_sets')
        .delete()
        .eq('category', 'library_article')
        .in('curation_query->>article_id', delIds)

      // library_articles DELETE (CASCADE 로 vocabularies, SET NULL 로 seed unlock)
      const { error: delArtErr, count } = await client
        .from('library_articles')
        .delete({ count: 'exact' })
        .in('id', delIds)
      if (delArtErr) {
        return NextResponse.json({ error: 'DBError', message: delArtErr.message }, { status: 500 })
      }
      articleDeleted = count ?? deletable.length
    }
  }

  // 3) seed 정리
  let deleted = 0
  let hidden = 0
  if (hard) {
    const { error: delSeedErr, count } = await client
      .from('library_article_seed_catalog')
      .delete({ count: 'exact' })
      .in('id', seedIds)
    if (delSeedErr) {
      return NextResponse.json({ error: 'DBError', message: delSeedErr.message }, { status: 500 })
    }
    deleted = count ?? 0
  } else {
    const { error: hideErr, count } = await client
      .from('library_article_seed_catalog')
      .update(
        {
          curation_status: 'hidden',
          imported_to_articles: false,
          imported_article_id: null,
        },
        { count: 'exact' },
      )
      .in('id', seedIds)
    if (hideErr) {
      return NextResponse.json({ error: 'DBError', message: hideErr.message }, { status: 500 })
    }
    hidden = count ?? 0
  }

  return NextResponse.json({
    ok: errors.length === 0,
    deleted,
    hidden,
    articleDeleted,
    errors: errors.slice(0, 20),
  })
}
