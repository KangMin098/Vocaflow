// apps/web/src/app/api/admin/library/backfill-covers/route.ts
//
// POST /api/admin/library/backfill-covers
//   cover_image_url 이 비어있는 Gutenberg/SE 도서에 원천 표지 URL 일괄 채움.
//   - Gutenberg: pg{id}.cover.medium.jpg (HEAD 200 확인)
//   - Standard Ebooks: ebook 페이지 og:image
//   재실행 안전 (이미 채워진 도서는 건너뜀). admin 전용.
//
// body(옵션): { only_published?: boolean (default true), limit?: number (default 100) }
// 응답: 200 { ok, scanned, updated, results: [{id, title, cover_image_url|null}] }

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { resolveCoverImageUrlWithSeed } from '@/lib/library/cover-image'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'ServerConfig', message: 'SUPABASE_URL / SERVICE_ROLE_KEY 누락' },
      { status: 500 },
    )
  }

  let onlyPublished = true
  let limit = 100
  try {
    const body = (await request.json()) as { only_published?: boolean; limit?: number }
    if (typeof body.only_published === 'boolean') onlyPublished = body.only_published
    if (typeof body.limit === 'number' && body.limit > 0) limit = Math.min(500, body.limit)
  } catch {
    // body 없음 — 기본값
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 소스를 gutenberg/SE 로 제한하지 않는다 — 시드가 표지를 갖고 있으면 어느 소스든 채울 수 있다.
  // (제한하던 동안 pressbooks·lit2go 등은 백필 대상에서 아예 빠져 있었다.)
  let query = client
    .from('library_books')
    .select('id, title, source, source_id')
    .is('cover_image_url', null)
    .not('source_id', 'is', null)
    .limit(limit)
  if (onlyPublished) query = query.eq('status', 'published')

  const { data: rows, error } = await query
  if (error) {
    return NextResponse.json({ error: 'DBError', message: error.message }, { status: 500 })
  }

  const books = (rows ?? []) as Array<{
    id: string
    title: string
    source: string
    source_id: string | null
  }>

  const results: Array<{
    id: string
    title: string
    cover_image_url: string | null
    via: 'seed' | 'origin' | 'none' | 'seed-dead'
  }> = []
  let updated = 0
  let fromSeed = 0
  for (const b of books) {
    let coverUrl: string | null = null
    let via: 'seed' | 'origin' | 'none' | 'seed-dead' = 'none'
    try {
      const r = await resolveCoverImageUrlWithSeed(client, {
        source: b.source,
        sourceId: b.source_id,
      })
      coverUrl = r.url
      via = r.via
    } catch {
      coverUrl = null
    }
    if (coverUrl) {
      await client.from('library_books').update({ cover_image_url: coverUrl }).eq('id', b.id)
      updated += 1
      if (via === 'seed') fromSeed += 1
    }
    results.push({ id: b.id, title: b.title, cover_image_url: coverUrl, via })
  }

  // via 를 응답에 싣는 이유: 시드에서 온 것과 원천에서 받아온 것을 구분해야
  // "시드가 비어 있는 소스가 어디인가" 를 백필 한 번으로 알 수 있다.
  return NextResponse.json({ ok: true, scanned: books.length, updated, fromSeed, results })
}
