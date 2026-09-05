// apps/web/src/app/api/lcp/dev-enqueue-book/route.ts
// LCP dev-only book enqueue — service-role INSERT (admin_enqueue_book 재현).
//
// 배경: admin_enqueue_book RPC(SECURITY DEFINER · is_admin_or_curator()) 는 DEV_ADMIN_BYPASS
//   환경(auth.uid()=NULL)에서 Forbidden. dev-process/force-publish-book 와 동일 패턴
//   (requireAdminApi 가드 + service-role · NODE_ENV 가드)으로 enqueue 갭을 해소.
//   프로덕션은 정규 admin_enqueue_book 사용 — 본 라우트는 NODE_ENV='production' 차단.
//
// body: { source, source_id, title?, author?, license? }
// 동작: (source, source_id) dedup → library_books INSERT(status='queued'). 트리거가 pgmq enqueue
//   (dev 는 worker 부재 → dev-process 로 수동 처리). copyright_safe_in_kr 는 license 트리거가 산정.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body {
  source?: string
  source_id?: string
  title?: string
  author?: string
  license?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'dev-enqueue-book disabled in production — use admin_enqueue_book' },
      { status: 403 },
    )
  }
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 500 },
    )
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.source || !body.source_id) {
    return NextResponse.json({ error: 'source, source_id required' }, { status: 400 })
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // dedup (source, source_id) — 멱등.
  const { data: existing } = await client
    .from('library_books')
    .select('id, status')
    .eq('source', body.source)
    .eq('source_id', body.source_id)
    .maybeSingle()
  if (existing) {
    const e = existing as { id: string; status: string }
    return NextResponse.json({ ok: true, book_id: e.id, existed: true, status: e.status })
  }

  const { data, error } = await client
    .from('library_books')
    .insert({
      source: body.source,
      source_id: body.source_id,
      title: body.title ?? body.source_id,
      author: body.author ?? null,
      license: body.license ?? 'PD-US',
      status: 'queued',
    })
    .select('id')
    .single()
  if (error) {
    return NextResponse.json({ error: `library_books insert failed: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, book_id: (data as { id: string }).id, existed: false })
}
