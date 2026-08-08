// apps/web/src/app/api/pdcp/drain/route.ts
//
// 드레인 — 큐의 호를 **한 번에 한 단계씩** 전진시킨다.
//
// 왜 한 단계씩인가:
//   한 호(52p) 전 단계를 한 요청에 처리하면 수십 분이라 어떤 타임아웃에도 안 들어간다.
//   그래서 호출 1회 = 호 1개의 다음 단계 1개. UI 가 반복 호출하며 진행을 보여준다
//   (CCP 의 dev-drain-queue 와 같은 구조).
//
// 단계 전이:
//   queued → acquire.mjs   → acquired
//   acquired → restore.mjs → restored
//   restored → segment.mjs → segmented
//   segmented → ocr(-local).mjs → ocr
//   ocr → (사람 검수) → review → published
//
// dev 전용: 앱 프로세스가 ffmpeg/tesseract 를 돌리는 건 로컬에서만 허용한다.

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { getAdapter, hasLocalOcr, runPipeline, workDir } from '@/lib/pd-comic/pipeline-bridge'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const NEXT_STATUS: Record<string, string> = {
  queued: 'acquired',
  acquired: 'restored',
  restored: 'segmented',
  segmented: 'ocr',
  ocr: 'review',
}

function readJson(f: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch {
    return null
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: '드레인은 dev 전용입니다 — 배포 환경은 CLI 로 실행하세요' },
      { status: 403 },
    )
  }
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  let body: { issueId?: string; dryRun?: boolean }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const client = createAdminClient() as unknown as SupabaseClient

  // 처리 대상 1건 — 지정이 없으면 큐에서 가장 오래된 것.
  // `last_error` 가 있는 행은 자동 선택에서 제외한다: 같은 실패를 무한 반복하지 않도록.
  // (사람이 '재시도'로 last_error 를 지우거나 issueId 를 지정하면 다시 대상이 된다)
  let q = client
    .from('pd_comic_issues')
    .select('id, slug, status, source_adapter, source_identifier, acquire_pages, attempts')
    .in('status', Object.keys(NEXT_STATUS))
    .is('last_error', null)
    .order('created_at', { ascending: true })
    .limit(1)
  if (body.issueId) {
    q = client
      .from('pd_comic_issues')
      .select('id, slug, status, source_adapter, source_identifier, acquire_pages, attempts')
      .eq('id', body.issueId)
      .limit(1)
  }
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const row = (data ?? [])[0] as
    | {
        id: string
        slug: string
        status: string
        source_adapter: string
        source_identifier: string
        acquire_pages: number | null
        attempts: number
      }
    | undefined
  if (!row) return NextResponse.json({ done: true, message: '큐가 비었습니다' })

  const nextStatus = NEXT_STATUS[row.status]
  if (!nextStatus) {
    return NextResponse.json({ done: true, message: `${row.status} 는 드레인 대상이 아닙니다` })
  }

  const root = workDir(row.slug)
  const ad = await getAdapter(row.source_adapter)
  const p = ad.profile

  // 단계 → 실행할 스크립트와 인자
  const plan: Record<string, { script: string; args: string[] }> = {
    queued: {
      script: 'acquire.mjs',
      args: [
        '--source', row.source_adapter,
        '--id', row.source_identifier,
        '--out', root,
        ...(row.acquire_pages ? ['--pages', String(row.acquire_pages)] : []),
      ],
    },
    acquired: {
      script: 'restore.mjs',
      args: [
        '--in', path.join(root, 'pages'), '--out', path.join(root, 'restored'),
        '--sat', String(p.saturation), '--scale', String(p.upscale),
        ...(p.denoise ? [] : ['--no-denoise']),
        ...(p.needsCrop ? [] : ['--no-crop']),
      ],
    },
    restored: {
      script: 'segment.mjs',
      args: [
        '--in', path.join(root, 'restored'), '--out', path.join(root, 'panels'),
        '--analysis', String(p.segmentAnalysis), '--dilate', String(p.segmentDilate),
      ],
    },
    segmented: {
      // tesseract 가 있으면 컷 직접 OCR(정확도 33%), 없으면 소스 hOCR(24%)
      script: hasLocalOcr() ? 'ocr-local.mjs' : 'ocr.mjs',
      args: ['--intake', root],
    },
  }

  const step = plan[row.status]
  if (!step) {
    // ocr → review 는 실행할 스크립트가 없다(사람 검수 대기로 넘김)
    await client
      .from('pd_comic_issues')
      .update({ status: nextStatus, last_run_at: new Date().toISOString() })
      .eq('id', row.id)
    return NextResponse.json({ issueId: row.id, slug: row.slug, from: row.status, to: nextStatus, ran: null })
  }

  if (body.dryRun) {
    return NextResponse.json({
      dryRun: true,
      issueId: row.id,
      slug: row.slug,
      from: row.status,
      to: nextStatus,
      command: `node scripts/comic/pd/${step.script} ${step.args.join(' ')}`,
    })
  }

  const started = Date.now()
  const r = await runPipeline(step.script, step.args, { timeoutMs: 280_000 })

  if (!r.ok) {
    // **status 는 건드리지 않는다.** 'failed' 로 덮으면 어느 단계에서 멈췄는지가 사라져
    // 재시도할 지점을 복원할 수 없다(실측: 복원 단계 ffmpeg 부재로 실패한 호가
    // 되돌릴 단계 정보를 잃고 큐에서 영구 이탈). 실패는 last_error 로만 표시한다.
    await client
      .from('pd_comic_issues')
      .update({
        last_error:
          (r.timedOut ? '타임아웃(280s) — CLI 로 직접 실행하세요\n' : '') +
          (r.stderr || r.stdout).slice(-800),
        last_run_at: new Date().toISOString(),
        attempts: row.attempts + 1,
      })
      .eq('id', row.id)
    return NextResponse.json(
      { issueId: row.id, slug: row.slug, from: row.status, ok: false, timedOut: r.timedOut, error: (r.stderr || r.stdout).slice(-800) },
      { status: 200 },
    )
  }

  // 산출물에서 진행 지표를 읽어 큐 화면에 반영
  const patch: Record<string, unknown> = {
    status: nextStatus,
    last_run_at: new Date().toISOString(),
    last_error: null,
    attempts: row.attempts + 1,
  }
  const panels = readJson(path.join(root, 'panels', 'panels.manifest.json'))
  if (Array.isArray(panels?.panels)) patch.panels_total = (panels!.panels as unknown[]).length
  const bubbles =
    readJson(path.join(root, 'bubbles.local.manifest.json')) ??
    readJson(path.join(root, 'bubbles.manifest.json'))
  const srcMf = readJson(path.join(root, 'source.manifest.json'))
  patch.qc = {
    ...(bubbles?.stats ? { ocr: bubbles.stats } : {}),
    ...(srcMf?.legal ? { legal: srcMf.legal } : {}),
    lastStage: nextStatus,
    tookMs: Date.now() - started,
  }
  await client.from('pd_comic_issues').update(patch).eq('id', row.id)

  return NextResponse.json({
    issueId: row.id,
    slug: row.slug,
    from: row.status,
    to: nextStatus,
    ok: true,
    tookMs: Date.now() - started,
    tail: r.stdout.split('\n').filter(Boolean).slice(-4),
  })
}
