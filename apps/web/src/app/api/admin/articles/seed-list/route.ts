// apps/web/src/app/api/admin/articles/seed-list/route.ts
// v06.46 — ACP article seed catalog 조회 (LCP library_seed_catalog list 동형).
//
// GET /api/admin/articles/seed-list?source=voa&includeImported=false&limit=200
//
// BulkArticlesTab 이 초기 마운트 시 호출 → 새로고침해도 GET 한 목록 보존됨.

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'
import { listArticleSeeds, type SeedSource } from '@/lib/acp/seed-upsert'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_SOURCES: SeedSource[] = [
  'voa',
  'nasa',
  'nih',
  'wikinews',
  'the_conversation',
  'simple_wikipedia',
]

export async function GET(req: NextRequest) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const sp = req.nextUrl.searchParams
  const sourcesParam = sp.get('sources') ?? sp.get('source') ?? ''
  const sources = sourcesParam
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is SeedSource => (VALID_SOURCES as string[]).includes(s))

  const feedId = sp.get('feed_id') ?? undefined
  const includeImported = sp.get('includeImported') === 'true'
  const limit = Math.min(500, Math.max(1, parseInt(sp.get('limit') ?? '200', 10) || 200))

  const supabase = await createClient()
  const seeds = await listArticleSeeds(supabase, {
    sources: sources.length > 0 ? sources : undefined,
    feedId,
    includeImported,
    limit,
  })

  return NextResponse.json({
    count: seeds.length,
    items: seeds,
  })
}
