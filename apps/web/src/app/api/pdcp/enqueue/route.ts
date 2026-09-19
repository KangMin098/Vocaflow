// apps/web/src/app/api/pdcp/enqueue/route.ts
//
// 대량 큐 적재 — 검색 결과에서 고른 호들을 `status='queued'` 로 만든다.
// 이 시점엔 **아직 아무것도 받지 않았다**. 이미지는 드레인이 받아온다.
//
// PD 근거는 여기서 확정하지 않는다. 어댑터 힌트(pre-1929 등)만 미리 채우고,
// 1930~1963 처럼 갱신 확인이 필요한 건 null 로 둔다 —
// 발행 시점에 DB 제약이 근거 없는 호를 막는다.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { getAdapter } from '@/lib/pd-comic/pipeline-bridge'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'issue'

export async function POST(request: Request): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  let body: { source?: string; identifiers?: string[]; pages?: number | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const source = String(body.source ?? '')
  const ids = Array.isArray(body.identifiers) ? body.identifiers.slice(0, 50) : []
  // 테스트 모드: 앞 N장만. null = 전권.
  const pages = body.pages == null ? null : Math.max(1, Math.min(200, Number(body.pages)))
  if (!source || ids.length === 0) {
    return NextResponse.json({ error: 'source 와 identifiers 가 필요합니다' }, { status: 400 })
  }

  const ad = await getAdapter(source)
  const client = createAdminClient() as unknown as SupabaseClient
  const results: Array<{ identifier: string; ok: boolean; slug?: string; error?: string }> = []

  for (const identifier of ids) {
    try {
      const meta = await ad.metadata(identifier)
      const hint = ad.pdHint(meta)
      const base = slugify(
        meta.seriesTitle && meta.issueNo != null
          ? `${meta.seriesTitle}-${String(meta.issueNo).padStart(3, '0')}-${meta.title}`
          : meta.title,
      )
      const { error } = await client.from('pd_comic_issues').insert({
        slug: `${base}-${identifier.slice(-6).toLowerCase()}`,
        title: meta.title,
        series_title: meta.seriesTitle ?? null,
        issue_no: meta.issueNo ?? null,
        published_year: meta.publishedYear ?? null,
        source_adapter: ad.id,
        source_identifier: identifier,
        source_url: meta.url,
        pd_basis: hint.basis, // 확정된 것만. 나머지는 사람이 검수에서 입력
        status: 'queued',
        acquire_pages: pages,
        panels_total: 0,
      })
      if (error) {
        // 이미 적재된 호는 실패가 아니라 "이미 있음"이다
        const dup = /duplicate key|unique/i.test(error.message)
        results.push({ identifier, ok: dup, error: dup ? '이미 큐에 있음' : error.message })
      } else {
        results.push({ identifier, ok: true, slug: base })
      }
    } catch (e) {
      results.push({ identifier, ok: false, error: (e as Error).message })
    }
  }

  return NextResponse.json({
    enqueued: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  })
}
