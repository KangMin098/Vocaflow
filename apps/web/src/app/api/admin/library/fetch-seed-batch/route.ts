// POST /api/admin/library/fetch-seed-batch
// body: { source, sort?, genre?, language?, offset?, limit?, ...advanced }
// → 외부 소스에서 fetch + library_seed_catalog UPSERT, inserted/skipped 반환
//
// v06.34 — advanced 파라미터 전체 전달 (Gutendex / Standard Ebooks / Wikibooks / LibriVox).
// fetcher 가 알아서 소스별로 매핑 (모르는 키는 무시).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { FETCHERS, type SeedSource } from '@/lib/library/seed-fetchers'
import type { FetchBatchParams } from '@/lib/library/seed-fetchers/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Body extends Partial<FetchBatchParams> {
  source: SeedSource
}

export async function POST(request: Request): Promise<NextResponse> {
  await requireAdmin('/admin/curation')

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const fetcher = FETCHERS[body.source]
  if (!fetcher) {
    return NextResponse.json({ error: `Unknown source: ${body.source}` }, { status: 400 })
  }

  let result
  try {
    result = await Promise.race([
      fetcher.fetchBatch({
        sort: body.sort,
        genre: body.genre ?? null,
        // v06.34 — Vocaflow 영어 학습 플랫폼: language 무조건 'en' 강제 (클라이언트 입력 무시)
        language: 'en',
        offset: body.offset ?? 0,
        limit: body.limit ?? 50,
        // ── advanced ──
        search: body.search ?? null,
        // languages multi 무시 (영어 강제)
        authorYearStart: body.authorYearStart ?? null,
        authorYearEnd: body.authorYearEnd ?? null,
        copyright: body.copyright ?? null,
        ids: body.ids,
        mimeType: body.mimeType ?? null,
        subjectSlug: body.subjectSlug ?? null,
        featuredOnly: body.featuredOnly,
        genreId: body.genreId ?? null,
        publishedSince: body.publishedSince ?? null,
        author: body.author ?? null,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Timeout 25s — ${body.source} 가 응답하지 않습니다 (네트워크/소스 차단 가능)`,
              ),
            ),
          25_000,
        ),
      ),
    ])
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'fetch failed' },
      { status: 502 },
    )
  }

  if (result.fetched.length === 0) {
    return NextResponse.json({
      source: body.source,
      inserted: 0,
      skipped: 0,
      total_available: result.total_available,
      next_offset: result.next_offset,
    })
  }

  // dev-bypass 모드(또는 cookie 세션 없는 admin 호출)에서 RLS 거부 방지 위해
  // service_role client 사용 — 다른 admin write route 와 동일 패턴.
  // requireAdmin 으로 이미 가드 통과한 상태.
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

  // 실제 신규 vs 기존 구분 — upsert(ignoreDuplicates:false) 는 insert+update 를 모두
  // 반환해 카운트가 항상 전량 "신규" 로 부정확. 사전 조회로 정확히 구분한다.
  const ids = result.fetched.map((r) => r.source_id)
  const { data: existingRows } = await client
    .from('library_seed_catalog' as never)
    .select('source_id')
    .eq('source', body.source)
    .in('source_id', ids)
  const existing = new Set(
    ((existingRows ?? []) as Array<{ source_id: string }>).map((e) => e.source_id),
  )
  const insertedCount = result.fetched.filter((r) => !existing.has(r.source_id)).length

  // upsert 는 기존 행 메타 갱신 겸용으로 그대로 유지 (ignoreDuplicates:false)
  const { error } = await client
    .from('library_seed_catalog' as never)
    .upsert(result.fetched as never, {
      onConflict: 'source,source_id',
      ignoreDuplicates: false,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    source: body.source,
    inserted: insertedCount,
    skipped: result.fetched.length - insertedCount,
    fetched: result.fetched.length,
    total_available: result.total_available,
    next_offset: result.next_offset,
  })
}
