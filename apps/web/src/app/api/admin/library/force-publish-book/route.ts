// apps/web/src/app/api/admin/library/force-publish-book/route.ts
//
// POST /api/admin/library/force-publish-book   { book_id }
//   admin_force_publish_book(uuid) RPC 래퍼.
//
// 배경 (v06.55): 기존 AdminReviewClient → forcePublishBook(client, id) 가 브라우저
//   createClient() 로 직접 RPC 호출했는데, DEV_ADMIN_BYPASS=1 환경에선 cookie 세션이
//   비어 auth.uid()=NULL → is_admin_or_curator()=false → RPC throw "Forbidden".
//   사용자 화면에선 footer 영역의 작은 에러로 표시돼 "게시 무반응" 처럼 보였다.
//
// 해결: 다른 admin write route (delete-seed-catalog, fetch-seed-batch 등) 와 동일하게
//   requireAdmin 가드 + service_role client 패턴.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requireAdmin } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body {
  book_id?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  await requireAdmin('/admin/curation')

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.book_id) {
    return NextResponse.json({ error: 'book_id required' }, { status: 400 })
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

  // service_role 은 is_admin_or_curator() 의 auth.uid() 검사를 통과 못 함.
  // RPC SECURITY DEFINER 의 가드를 우회하려면 RPC 를 호출하지 말고 동등 로직 직접 실행.
  //   - copyright_safe_in_kr 검증 + status='published' UPDATE.
  //   - admin_force_publish_book 의 가드는 requireAdmin (RSC) 으로 이미 통과한 상태.
  const { data: book, error: fetchErr } = await client
    .from('library_books')
    .select('id, copyright_safe_in_kr, status')
    .eq('id', body.book_id)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: 'DBError', message: fetchErr.message }, { status: 500 })
  }
  if (!book) {
    return NextResponse.json({ error: 'NotFound', message: `Book ${body.book_id} not found` }, { status: 404 })
  }
  const b = book as { id: string; copyright_safe_in_kr: boolean; status: string }
  if (!b.copyright_safe_in_kr) {
    return NextResponse.json(
      { error: 'CopyrightGate', message: '저작권 미확인 (copyright_safe_in_kr=false) — 게시 불가' },
      { status: 400 },
    )
  }
  if (b.status === 'published') {
    return NextResponse.json({ ok: true, already_published: true })
  }

  const { error: updErr } = await client
    .from('library_books')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', body.book_id)

  if (updErr) {
    return NextResponse.json({ error: 'DBError', message: updErr.message }, { status: 500 })
  }

  // trg_lb_publish_word_sets trigger 가 자동으로 publish_book_word_sets() 호출 → 챕터 단어장 생성.

  return NextResponse.json({ ok: true, published: true })
}
