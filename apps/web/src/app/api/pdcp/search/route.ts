// apps/web/src/app/api/pdcp/search/route.ts
//
// 소스별 검색 — 대량 취득의 1단계. 후보를 훑고 PD 판정 힌트를 함께 본다.
//
// 검색 자체가 소스마다 다르다: IA 만 검색 API 가 있고, local-dir 는 수동,
// IIIF 는 통합 검색이 없다. 어댑터가 그 사실을 예외로 알려주면 그대로 노출한다
// (앱이 "검색 안 됨"을 자체 판단하면 어댑터가 늘 때마다 앱을 고쳐야 한다).

import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { getAdapter } from '@/lib/pd-comic/pipeline-bridge'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  let body: { source?: string; query?: string; limit?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const source = String(body.source ?? '')
  const query = String(body.query ?? '').trim()
  const limit = Math.min(50, Math.max(1, Number(body.limit) || 20))
  if (!source || !query) {
    return NextResponse.json({ error: 'source 와 query 가 필요합니다' }, { status: 400 })
  }

  try {
    const ad = await getAdapter(source)
    if (!ad.caps.bulk) {
      return NextResponse.json(
        { error: `${ad.label} 은 자동 대량 취득을 지원하지 않습니다 (${ad.caps.discovery}).` },
        { status: 400 },
      )
    }
    const items = await ad.search(query, limit)

    // 이미 큐/서가에 있는 식별자는 중복 적재를 막기 위해 표시한다
    const client = createAdminClient() as unknown as SupabaseClient
    const { data: existing } = await client
      .from('pd_comic_issues')
      .select('source_identifier, status')
      .eq('source_adapter', source)
      .in('source_identifier', items.map((i) => i.identifier))
    const known = new Map(
      ((existing ?? []) as Array<{ source_identifier: string; status: string }>).map((r) => [
        r.source_identifier,
        r.status,
      ]),
    )

    return NextResponse.json({
      source: { id: ad.id, label: ad.label },
      items: items.map((it) => {
        const hint = ad.pdHint(it)
        return {
          identifier: it.identifier,
          title: it.title,
          seriesTitle: it.seriesTitle ?? null,
          issueNo: it.issueNo ?? null,
          publishedYear: it.publishedYear ?? null,
          pageCount: it.pageCount ?? null,
          url: it.url,
          pdBasis: hint.basis,
          pdNote: hint.note,
          existingStatus: known.get(it.identifier) ?? null,
        }
      }),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
