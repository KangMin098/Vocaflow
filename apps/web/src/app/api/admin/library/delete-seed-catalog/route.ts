// apps/web/src/app/api/admin/library/delete-seed-catalog/route.ts
//
// POST /api/admin/library/delete-seed-catalog   { ids: string[] }
//   library_seed_catalog 행 삭제 (admin 전용, service role).
//   - 주 용도: SE 가 같은 책을 가진 Gutenberg 중복 행(삭제 대상) 제거.
//   - 이미 큐에 enqueue 된 행(imported_to_books=true)은 link 보호 위해 스킵.
// 응답: 200 { ok, deleted, skipped }

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
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

  let ids: string[] = []
  try {
    const body = (await request.json()) as { ids?: unknown }
    if (Array.isArray(body.ids)) ids = body.ids.filter((x): x is string => typeof x === 'string')
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: 'NoIds', message: 'ids 배열이 비어있습니다' }, { status: 400 })
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 큐에 들어간(imported) 행은 보호 — 삭제 대상에서 제외
  const { data: rows, error: selErr } = await client
    .from('library_seed_catalog')
    .select('id, imported_to_books')
    .in('id', ids)
  if (selErr) {
    return NextResponse.json({ error: 'DBError', message: selErr.message }, { status: 500 })
  }

  const deletable = (rows ?? [])
    .filter((r) => !(r as { imported_to_books: boolean }).imported_to_books)
    .map((r) => (r as { id: string }).id)
  const skipped = ids.length - deletable.length

  if (deletable.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, skipped })
  }

  const { error: delErr } = await client
    .from('library_seed_catalog')
    .delete()
    .in('id', deletable)
  if (delErr) {
    return NextResponse.json({ error: 'DBError', message: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted: deletable.length, skipped })
}
