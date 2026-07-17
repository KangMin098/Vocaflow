// apps/web/src/app/api/acp/dev-publish/route.ts
// ACP dev-only force-publish — service-role UPDATE (admin_force_publish_article 재현).
//
// 배경: admin_force_publish_article RPC 는 is_admin_or_curator()(auth.uid()) 경유라
//   DEV_ADMIN_BYPASS 환경에서 Forbidden. 본 라우트가 dev-enqueue/dev-process 와 동일 패턴
//   (service-role · NODE_ENV 가드)으로 dev 발행 검증을 가능케 함.
//   프로덕션은 정규 admin_force_publish_article 사용 — 본 라우트는 NODE_ENV='production' 차단.
//
// body: { article_id: string }
// 동작: copyright_safe_in_kr 확인 → status='published' UPDATE → trg_publish_article_word_set 발동
//   (NOT display_only AND lexical_noise≤0.08 일 때만 단어세트 발행).

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

import { requireAdmin } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface DevPublishBody {
  article_id?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'dev-publish disabled in production — use admin_force_publish_article' },
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

  let body: DevPublishBody
  try {
    body = (await request.json()) as DevPublishBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.article_id) {
    return NextResponse.json({ error: 'article_id required' }, { status: 400 })
  }

  const client = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: art, error: fErr } = await client
    .from('library_articles')
    .select('id, copyright_safe_in_kr, display_only, lexical_noise, status')
    .eq('id', body.article_id)
    .single()
  if (fErr || !art) {
    return NextResponse.json({ error: `article not found: ${body.article_id}` }, { status: 404 })
  }
  const a = art as {
    copyright_safe_in_kr: boolean | null
    display_only: boolean | null
    lexical_noise: string | number | null
  }
  if (a.copyright_safe_in_kr !== true) {
    return NextResponse.json({ error: 'Cannot publish: copyright not safe in KR' }, { status: 400 })
  }

  const { error: uErr } = await client
    .from('library_articles')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', body.article_id)
  if (uErr) {
    return NextResponse.json({ error: `publish failed: ${uErr.message}` }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    article_id: body.article_id,
    status: 'published',
    // 발행 트리거 게이트 상태 (참고 — 실제 발행 여부는 trg_publish_article_word_set 이 결정)
    display_only: a.display_only ?? false,
    lexical_noise: a.lexical_noise,
    word_set_expected: a.display_only !== true && Number(a.lexical_noise ?? 0) <= 0.08,
  })
}
