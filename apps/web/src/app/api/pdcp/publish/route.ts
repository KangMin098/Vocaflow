// apps/web/src/app/api/pdcp/publish/route.ts
//
// 발행 — 검수(review)→발행(published). DB 게이트(pd_basis·pd_checked_at·pd_checked_by·source_url)를
// 콘솔에서 안전하게 통과시킨다. dev·admin.
//   POST { issueId, action:'confirm-pd', pdBasis, pdEvidenceUrl? }  → PD 근거 확정(법적 게이트 메타)
//   POST { issueId, action:'publish' }                              → published 전이(콘텐츠 서빙 준비 필요)
//
// ⚠️ 콘텐츠 서빙 미구현: 학습자 리더는 published 이미지를 공개 URL 로 받아야 하는데, 현재 컷 image_url 은
//   work 상대경로(dev artifact 전용)다. 공개 스토리지 업로드 전에는 발행하면 학습자에게 깨진 이미지가
//   나가므로, 'publish' 는 콘텐츠 준비가 안 되면 거부한다(깨진 발행 방지). 'confirm-pd' 는 항상 안전.

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PD_BASES = new Set(['pre-1929', 'no-renewal', 'explicit-license'])

// 컷 image_url 이 공개 URL(http)인지 — work 상대경로면 학습자에게 서빙 불가.
async function contentServable(client: SupabaseClient, issueId: string): Promise<boolean> {
  const { data } = await client.from('pd_comic_panels').select('image_url').eq('issue_id', issueId).limit(1)
  const url = (data?.[0] as { image_url?: string } | undefined)?.image_url
  return typeof url === 'string' && /^https?:\/\//.test(url)
}

export async function POST(request: Request): Promise<NextResponse> {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

  const body = (await request.json().catch(() => ({}))) as { issueId?: string; action?: string; pdBasis?: string; pdEvidenceUrl?: string }
  const issueId = body.issueId
  if (!issueId) return NextResponse.json({ error: 'issueId 가 필요합니다' }, { status: 400 })

  const client = createAdminClient() as unknown as SupabaseClient
  const { data: row } = await client
    .from('pd_comic_issues')
    .select('id, slug, status, pd_basis, pd_checked_at, pd_checked_by, source_url, qc')
    .eq('id', issueId)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: '해당 호가 없습니다' }, { status: 404 })
  const r = row as { id: string; slug: string; status: string; pd_basis: string | null; pd_checked_at: string | null; pd_checked_by: string | null; source_url: string | null; qc: { workDir?: string } | null }

  // ── PD 근거 확정 (법적 게이트 메타) — 항상 안전 ──
  if (body.action === 'confirm-pd') {
    const pdBasis = String(body.pdBasis || '')
    if (!PD_BASES.has(pdBasis)) return NextResponse.json({ error: `pdBasis 는 ${[...PD_BASES].join('/')} 중 하나` }, { status: 400 })
    const patch: Record<string, unknown> = {
      pd_basis: pdBasis,
      pd_checked_at: new Date().toISOString(),
      pd_checked_by: admin.id,
    }
    if (body.pdEvidenceUrl) patch.pd_evidence_url = body.pdEvidenceUrl
    const { error } = await client.from('pd_comic_issues').update(patch).eq('id', issueId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'confirm-pd', pdBasis })
  }

  // ── 발행 (published 전이) ──
  if (body.action === 'publish') {
    // 게이트 요건 재확인 (DB 제약과 동일 — 사용자에게 무엇이 빠졌는지 알려줌)
    const missing: string[] = []
    if (!r.pd_basis) missing.push('PD 근거')
    if (!r.pd_checked_at || !r.pd_checked_by) missing.push('PD 검증 기록')
    if (!r.source_url) missing.push('출처 URL')
    if (missing.length) return NextResponse.json({ error: `발행 게이트 미충족: ${missing.join(', ')} — 먼저 PD 근거를 확정하세요` }, { status: 409 })

    // 콘텐츠 서빙 — 공개 URL 이어야 학습자에게 정상 노출. 미구현이면 깨진 발행이므로 거부.
    if (!(await contentServable(client, issueId))) {
      return NextResponse.json({
        error: '콘텐츠 서빙 미구현 — 컷 이미지가 공개 스토리지에 업로드되지 않았습니다. 발행하면 학습자에게 깨진 이미지가 나갑니다. (스토리지 업로드 단계 필요)',
        blocked: 'content-serving',
      }, { status: 409 })
    }

    const { error } = await client.from('pd_comic_issues').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', issueId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'publish', slug: r.slug })
  }

  // ── 발행 준비 상태 조회(기본) ──
  const wd = r.qc?.workDir
  const hasModern = typeof wd === 'string' && fs.existsSync(wd) && (fs.existsSync(path.join(wd, 'page-modern')) || fs.existsSync(path.join(wd, 'modern')))
  return NextResponse.json({
    issueId, slug: r.slug, status: r.status,
    checklist: {
      pdBasis: Boolean(r.pd_basis),
      pdChecked: Boolean(r.pd_checked_at && r.pd_checked_by),
      sourceUrl: Boolean(r.source_url),
      modernized: Boolean(hasModern),
      contentServable: await contentServable(client, issueId),
    },
    pdBasis: r.pd_basis,
  })
}
