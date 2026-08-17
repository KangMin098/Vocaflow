// apps/web/src/app/api/pdcp/pd-check/route.ts
//
// PD 근거 확인 작업면 — **판정은 사람이 하고, 이 API 는 판정을 기록 가능하게 만든다.**
//
// ── 왜 시리즈 단위인가 ───────────────────────────────────────────
//   저작권 갱신은 호마다 따로 판단하는 것이 아니라 **간행물(시리즈) 단위로 등록**된다.
//   `Catalog of Copyright Entries` 의 정기간행물 갱신 편도 간행물 이름으로 묶여 있다.
//   그래서 운영자가 실제로 하는 일은 "Whiz Comics 의 1967~1968년 갱신 목록을 봤다" 이고,
//   그 한 번의 확인이 그 시리즈의 여러 호에 적용된다. 호마다 969번 누르게 만들면
//   같은 확인을 969번 적는 것이고, 그러면 아무도 안 한다.
//
//   다만 **연도 범위는 호마다 다르다** — 갱신 창은 발행 27~28년 뒤라, 1940년 호와 1953년 호는
//   봐야 할 갱신 편이 다르다. 그래서 GET 이 호별 확인 창을 계산해 함께 돌려준다.
//
// ── 이 API 가 하지 않는 것 ───────────────────────────────────────
//   PD 여부를 스스로 판정하지 않는다. `pdBasis` 와 근거 URL 은 **입력**이고,
//   근거가 필요한 토큰은 URL 없이 저장되지 않는다. 감사 기록(누가·언제)은 서버가 붙인다.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { PD_BASES, pdBasisSpec, renewalLookups, renewalWindow } from '@/lib/pd-comic/model'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 확인이 필요한 호 — 검수 이상 단계인데 근거가 비어 있는 것. */
export async function GET(request: Request): Promise<NextResponse> {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

  const url = new URL(request.url)
  const kind = url.searchParams.get('kind')
  const client = createAdminClient() as unknown as SupabaseClient

  let q = client
    .from('pd_comic_issues')
    .select('id, slug, title, series_key, issue_no, published_year, kind, status, pd_basis, pd_evidence_url, pd_checked_at, panels_total')
    .in('status', ['ocr', 'review', 'published'])
  if (kind) q = q.eq('kind', kind)
  const { data, error } = await q.order('series_key').order('issue_no', { nullsFirst: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as Array<Record<string, unknown>>

  // 시리즈로 묶는다 — 운영자가 실제로 확인하는 단위.
  const bySeries = new Map<string, {
    seriesKey: string
    kind: string | null
    years: number[]
    issues: Array<Record<string, unknown>>
  }>()
  for (const r of rows) {
    const key = String(r.series_key ?? '(미분류)')
    let b = bySeries.get(key)
    if (!b) {
      b = { seriesKey: key, kind: (r.kind as string) ?? null, years: [], issues: [] }
      bySeries.set(key, b)
    }
    if (r.published_year) b.years.push(Number(r.published_year))
    b.issues.push({
      id: r.id,
      slug: r.slug,
      title: r.title,
      issueNo: r.issue_no,
      publishedYear: r.published_year,
      status: r.status,
      pdBasis: r.pd_basis,
      pdEvidenceUrl: r.pd_evidence_url,
      pdCheckedAt: r.pd_checked_at,
      panelsTotal: r.panels_total,
      // 이 호를 확인하려면 몇 년도 갱신 편을 봐야 하는가
      renewalWindow: renewalWindow((r.published_year as number) ?? null),
    })
  }

  // 시리즈 마스터에서 사람이 읽는 이름을 가져온다(조회처 링크에 쓴다).
  const keys = [...bySeries.keys()]
  const { data: sData } = await client
    .from('pd_comic_series')
    .select('key, title, publisher')
    .in('key', keys.length ? keys : ['__none__'])
  const titleOf = new Map((sData ?? []).map((s) => [String((s as Record<string, unknown>).key), s as Record<string, unknown>]))

  const series = [...bySeries.values()].map((b) => {
    const meta = titleOf.get(b.seriesKey)
    const title = (meta?.title as string) ?? b.seriesKey
    const yFrom = b.years.length ? Math.min(...b.years) : null
    const yTo = b.years.length ? Math.max(...b.years) : null
    const confirmed = b.issues.filter((i) => i.pdBasis).length
    return {
      seriesKey: b.seriesKey,
      seriesTitle: title,
      publisher: (meta?.publisher as string) ?? null,
      kind: b.kind,
      yearFrom: yFrom,
      yearTo: yTo,
      // 시리즈 전체를 덮는 갱신 확인 범위 — 가장 이른 호부터 가장 늦은 호까지
      renewalRange: yFrom && yTo ? [yFrom + 27, yTo + 28] : null,
      lookups: renewalLookups(title, yFrom),
      total: b.issues.length,
      confirmed,
      issues: b.issues,
    }
  })

  return NextResponse.json({
    bases: PD_BASES,
    series: series.sort((a, b) => b.total - a.total),
    totals: {
      issues: rows.length,
      confirmed: rows.filter((r) => r.pd_basis).length,
      series: series.length,
    },
  })
}

/**
 * 확정 기록.
 *   { seriesKey } 또는 { issueIds: [...] } 중 하나 + { pdBasis, pdEvidenceUrl }
 *
 * 근거가 필요한 토큰은 URL 없이 저장되지 않는다 — 확인했다는 주장에는 어디서 확인했는지가 붙어야
 * 나중에 재검증할 수 있다. 재검증할 수 없는 기록은 게이트를 통과시키는 형식일 뿐이다.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

  const body = (await request.json().catch(() => ({}))) as {
    seriesKey?: string
    issueIds?: string[]
    pdBasis?: string
    pdEvidenceUrl?: string
    note?: string
  }

  const spec = pdBasisSpec(String(body.pdBasis ?? ''))
  if (!spec) {
    return NextResponse.json(
      { error: `pdBasis 는 ${PD_BASES.map((b) => b.key).join(' / ')} 중 하나여야 합니다` },
      { status: 400 },
    )
  }
  const evidence = String(body.pdEvidenceUrl ?? '').trim()
  if (spec.needsEvidence) {
    if (!evidence) {
      return NextResponse.json(
        { error: `'${spec.label}' 는 근거 URL 이 필요합니다 — 어디서 확인했는지 없이는 기록할 수 없습니다` },
        { status: 400 },
      )
    }
    if (!/^https?:\/\//i.test(evidence)) {
      return NextResponse.json({ error: '근거 URL 은 http(s) 주소여야 합니다' }, { status: 400 })
    }
  }

  const client = createAdminClient() as unknown as SupabaseClient
  const patch: Record<string, unknown> = {
    pd_basis: spec.key,
    pd_checked_at: new Date().toISOString(),
    pd_checked_by: admin.id,
  }
  if (evidence) patch.pd_evidence_url = evidence

  let q = client.from('pd_comic_issues').update(patch)
  if (body.seriesKey) {
    q = q.eq('series_key', body.seriesKey)
  } else if (Array.isArray(body.issueIds) && body.issueIds.length) {
    q = q.in('id', body.issueIds.slice(0, 500))
  } else {
    return NextResponse.json({ error: 'seriesKey 또는 issueIds 가 필요합니다' }, { status: 400 })
  }

  const { data, error } = await q.select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    updated: data?.length ?? 0,
    pdBasis: spec.key,
    pdEvidenceUrl: evidence || null,
  })
}
