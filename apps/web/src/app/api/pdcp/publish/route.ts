// apps/web/src/app/api/pdcp/publish/route.ts
//
// 발행 — 검수(review)→발행(published). DB 게이트(pd_basis·pd_checked_at·pd_checked_by·source_url)를
// 콘솔에서 안전하게 통과시킨다. dev·admin.
//   POST { issueId, action:'confirm-pd', pdBasis, pdEvidenceUrl? }  → PD 근거 확정(법적 게이트 메타)
//   POST { issueId, action:'publish' }                              → published 전이(콘텐츠 서빙 준비 필요)
//   POST { issueId, action:'archive' }                              → published → archived (발행 회수)
//   POST { issueId, action:'restore' }                              → archived → review   (다시 검수로)
//
// 왜 회수 경로가 필요한가: 발행본은 DELETE 가 409 로 막히고 "먼저 보관 처리하세요" 라 안내하는데
// **보관으로 내리는 길이 어디에도 없었다.** 한 번 발행하면 영구 고착이었다. `archived` 는 DB
// CHECK(`pd_issues_status_chk`)가 이미 허용하는 값이라 마이그레이션 없이 열 수 있다(실측 19행 존재).
//
// ⚠️ 콘텐츠 서빙 미구현: 학습자 리더는 published 이미지를 공개 URL 로 받아야 하는데, 현재 컷 image_url 은
//   work 상대경로(dev artifact 전용)다. 공개 스토리지 업로드 전에는 발행하면 학습자에게 깨진 이미지가
//   나가므로, 'publish' 는 콘텐츠 준비가 안 되면 거부한다(깨진 발행 방지). 'confirm-pd' 는 항상 안전.

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import {
  PD_ACTION_STATES,
  PD_BASIS_CHOICES,
  pdActionAllowed,
  pdStatusLabel,
} from '@/lib/pd-comic/model'
import { runPipeline } from '@/lib/pd-comic/pipeline-bridge'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 토큰 목록은 model.ts 가 정본 — 여기에 또 적으면 갈린다(실제로 갈려 있었다:
// 파이프라인이 내는 'term-expired' 를 이 화이트리스트가 400 으로 거부했다).

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

  // 상태 게이트는 정본(model.ts)이 정한다 — 화면 버튼 노출 조건과 같은 집합을 본다.
  const gate = (action: 'confirm-pd' | 'upload' | 'publish' | 'archive' | 'restore') =>
    pdActionAllowed(action, r.status)
      ? null
      : NextResponse.json(
          {
            error: `'${action}' 는 ${[...PD_ACTION_STATES[action]].map(pdStatusLabel).join(' · ')} 상태에서만 가능합니다 (현재 ${pdStatusLabel(r.status)})`,
          },
          { status: 409 },
        )

  // ── PD 근거 확정 (법적 게이트 메타) ──
  if (body.action === 'confirm-pd') {
    const blocked = gate('confirm-pd')
    if (blocked) return blocked
    const pdBasis = String(body.pdBasis || '')
    // 신규 확정은 **선택지 정본**만 받는다 — 레거시 토큰(pre-1929)은 DB 에 남아 있는 옛 값이지
    // 지금 골라도 되는 값이 아니다. 화면 select 도 같은 배열에서 나온다.
    const spec = PD_BASIS_CHOICES.find((b) => b.key === pdBasis) ?? null
    if (!spec) {
      return NextResponse.json(
        { error: `pdBasis 는 ${PD_BASIS_CHOICES.map((b) => b.key).join('/')} 중 하나` },
        { status: 400 },
      )
    }
    // "갱신 기록이 없다"는 **어딘가를 찾아봤다는 주장**이다. 어디를 봤는지 없이는 기록하지 않는다 —
    // 근거 URL 없는 확정은 나중에 아무도 재확인할 수 없고, 그 순간 게이트는 형식만 남는다.
    if (spec.needsEvidence && !body.pdEvidenceUrl) {
      return NextResponse.json(
        { error: `'${spec.label}' 는 근거 URL 이 필요합니다 — 어디서 확인했는지 없이는 기록할 수 없습니다` },
        { status: 400 },
      )
    }
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

  // ── 콘텐츠 업로드 (현대화 산출물 → 공개 버킷 comic/pd/<slug>/ + pd_comic_panels 갱신) ──
  if (body.action === 'upload') {
    const blocked = gate('upload')
    if (blocked) return blocked
    const wd = typeof r.qc?.workDir === 'string' ? r.qc.workDir : null
    if (!wd) return NextResponse.json({ error: 'work 디렉터리가 없습니다' }, { status: 400 })
    const run = await runPipeline('publish-upload.mjs', ['--workdir', wd, '--slug', r.slug, '--issue-id', r.id], { timeoutMs: 300_000 })
    if (!run.ok) return NextResponse.json({ error: `업로드 실패: ${(run.stderr || run.stdout || '').split('\n').filter(Boolean).slice(-2).join(' ')}` }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'upload', tail: (run.stdout || '').split('\n').filter(Boolean).slice(-3) })
  }

  // ── 발행 회수 (published → archived) ──
  //
  // 삭제가 아니라 보관이다: 학습자 서가 RPC 는 published 만 내보내므로 보관 즉시 노출이 끊기고,
  // 컷·PD 근거·출처는 그대로 남아 되돌릴 수 있다. `published_at` 은 지운다 — 남겨 두면
  // "발행 중" 으로 읽히는 날짜가 보관된 호에 붙는다.
  if (body.action === 'archive') {
    const blocked = gate('archive')
    if (blocked) return blocked
    const { error } = await client
      .from('pd_comic_issues')
      .update({ status: 'archived', published_at: null })
      .eq('id', issueId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'archive', slug: r.slug, status: 'archived' })
  }

  // ── 보관 복원 (archived → review) ──
  // 발행으로 바로 되돌리지 않는다 — 회수한 이유(깨진 이미지·근거 재확인)가 아직 살아 있을 수 있어
  // 발행 게이트를 다시 통과시킨다.
  if (body.action === 'restore') {
    const blocked = gate('restore')
    if (blocked) return blocked
    const { error } = await client
      .from('pd_comic_issues')
      .update({ status: 'review', last_error: null })
      .eq('id', issueId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'restore', slug: r.slug, status: 'review' })
  }

  // ── 발행 (published 전이) ──
  if (body.action === 'publish') {
    const blocked = gate('publish')
    if (blocked) return blocked
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
    // 화면이 어떤 버튼을 그릴지 **서버가 답한다** — 조건을 화면이 다시 적으면 갈린다.
    actions: Object.fromEntries(
      (Object.keys(PD_ACTION_STATES) as Array<keyof typeof PD_ACTION_STATES>).map((a) => [
        a,
        pdActionAllowed(a, r.status),
      ]),
    ),
  })
}
