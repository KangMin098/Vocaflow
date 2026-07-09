// apps/web/src/app/api/ctp/dev-generate-items/route.ts
// CTP DCP T2 dev — published 콘텐츠에서 결정론 order/insert 문항 생성 + csat_dcp_items INSERT.
//
// 배치 사전 계산(런타임 LLM 0). generateDcpItems(결정론·멱등) → upsert(재실행 안전).
// dev-only(NODE_ENV 가드). 프로덕션은 pg_cron 배치(추후).
//
// body: { registers?: string[]; limit?: number }  (기본 argumentative — S3 킬러 register)

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { generateDcpItems } from '@vocaflow/library-pipeline'

import { requireAdmin } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

interface Body {
  registers?: string[]
  limit?: number
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'dev-generate-items disabled in production' }, { status: 403 })
  }
  await requireAdmin('/admin/curation')

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'SUPABASE env missing' }, { status: 500 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    body = {}
  }
  const registers = body.registers ?? ['argumentative']
  const limit = Math.min(50, Math.max(1, body.limit ?? 20))

  const client = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // DCP 입력 게이트(설계 §T2) — 파생 가능 콘텐츠만: NOT display_only(ND 제외) +
  //   license_class ∈ (pd,cc0,cc_by,cc_by_sa) + lexical_noise≤0.08. ND(The Conversation)는 읽기 전용.
  const { data: articles, error: fErr } = await client
    .from('library_articles')
    .select('id, source_id, content, article_v_level, register')
    .eq('status', 'published')
    .eq('display_only', false)
    .in('license_class', ['public_domain', 'cc0', 'cc_by', 'cc_by_sa'])
    .lte('lexical_noise', 0.08)
    .in('register', registers)
    .limit(limit)
  if (fErr) {
    return NextResponse.json({ error: `fetch failed: ${fErr.message}` }, { status: 500 })
  }

  let totalItems = 0
  const perArticle: Array<{ id: string; register: string; items: number; error?: string }> = []

  for (const a of (articles ?? []) as Array<{
    id: string
    source_id: string
    content: string
    article_v_level: number | null
    register: string
  }>) {
    const items = generateDcpItems(a.content ?? '', a.source_id)
    if (items.length === 0) {
      perArticle.push({ id: a.id, register: a.register, items: 0 })
      continue
    }
    const rows = items.map((it) => ({
      kind: 'article',
      ref_id: a.id,
      type: it.type,
      item_role: 'practice',
      payload: it.payload,
      answer_key: it.answer_key,
      paragraph_idx: it.paragraph_idx,
      v_level: a.article_v_level,
    }))
    const { error } = await client
      .from('csat_dcp_items')
      .upsert(rows, { onConflict: 'kind,ref_id,type,paragraph_idx' })
    if (error) {
      perArticle.push({ id: a.id, register: a.register, items: 0, error: error.message })
    } else {
      totalItems += rows.length
      perArticle.push({ id: a.id, register: a.register, items: rows.length })
    }
  }

  return NextResponse.json({
    ok: true,
    articles: (articles ?? []).length,
    total_items: totalItems,
    per_article: perArticle,
  })
}
