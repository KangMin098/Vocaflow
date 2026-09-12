// apps/web/src/app/api/pdcp/curate/route.ts
//
// 학습 적합도 자동 큐레이션 — "사전 지식 자동화". 사용자가 컬렉션 ID·연도·검색어를 몰라도,
// 아는 명작 하나(또는 트랙)만 고르면 CANON 매칭 + CI 감지 + 분량 + PD 위험도로 자동 랭킹한다.
// curate.mjs(CLI)와 동일한 curate-core.mjs 점수 로직 재사용. dev·admin.
//   GET  → { tracks, canon }         (UI 출발점 칩)
//   POST { source?, query, top? } → { candidates: [...ranked with fit·why·pdRisk·existingStatus] }

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { getAdapter, loadCurateCore } from '@/lib/pd-comic/pipeline-bridge'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError
  const core = await loadCurateCore()
  return NextResponse.json({ tracks: core.CURATE_TRACKS, canon: core.CANON.map(([, title]) => title) })
}

export async function POST(request: Request): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const body = (await request.json().catch(() => ({}))) as { source?: string; query?: string; top?: number }
  const source = body.source || 'internet-archive'
  const query = String(body.query || '').trim()
  const top = Math.min(Math.max(Number(body.top) || 8, 1), 20)
  if (!query) return NextResponse.json({ error: 'query 가 필요합니다' }, { status: 400 })

  let ranked: Array<Record<string, unknown>>
  try {
    const ad = (await getAdapter(source)) as unknown as { search: (q: string, n: number, f: Record<string, unknown>) => Promise<unknown[]> }
    // sort=downloads: 인기순으로 40건 받아 그 안에서 학습 적합도로 재랭킹(연도 상한 등 위험 재정렬은 어댑터가 이미 적용)
    const items = await ad.search(query, 40, { sort: 'downloads' })
    const core = await loadCurateCore()
    ranked = core.rank(items, top)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || '큐레이션 실패' }, { status: 500 })
  }

  // 중복 표시 — 이미 큐에 있는 identifier
  const ids = ranked.map((r) => String(r.identifier)).filter(Boolean)
  const existing = new Map<string, string>()
  if (ids.length) {
    const client = createAdminClient() as unknown as SupabaseClient
    const { data } = await client
      .from('pd_comic_issues')
      .select('source_identifier, status')
      .eq('source_adapter', source)
      .in('source_identifier', ids)
    for (const r of (data ?? []) as Array<{ source_identifier: string; status: string }>) existing.set(r.source_identifier, r.status)
  }

  const candidates = ranked.map((r) => ({
    identifier: r.identifier,
    title: r.canon || r.title || r.identifier,
    canon: r.canon ?? null,
    isCI: Boolean(r.isCI),
    fit: r.fit,
    why: (r.why as string[]) ?? [],
    pageCount: r.pageCount ?? null,
    publishedYear: r.publishedYear ?? null,
    pdRisk: r.pdRisk ?? null,
    existingStatus: existing.get(String(r.identifier)) ?? null,
  }))

  return NextResponse.json({ source, query, count: candidates.length, candidates })
}
