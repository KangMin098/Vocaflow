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
//   segmented → ocr.mjs      → ocr   (소스 hOCR 이 있을 때만. 없으면 실행 없이 통과)
//   ocr → (사람 검수) → review → published
//   modernized → (스크립트 없음) → review   ← 현대화(선택 트랙)를 누른 호의 출구.
//     이 줄이 없어서 현대화한 호가 전진도 후퇴도 못 하고 갇혀 있었다.
//
// dev 전용: 앱 프로세스가 ffmpeg 를 돌리는 건 로컬에서만 허용한다.

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { PD_DRAIN_CHAIN } from '@/lib/pd-comic/model'
import { getAdapter, runPipeline, workDir } from '@/lib/pd-comic/pipeline-bridge'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// 전이표 정본은 model.ts — 여기에 사본을 두면 갈린다.
// 실제로 갈려서, modernize 라우트가 만든 'modernized' 행을 이 표가 몰라 큐에서 영영 빠졌다.
const NEXT_STATUS = PD_DRAIN_CHAIN

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
  }

  // ④ 대사 — 소스가 준 hOCR 좌표를 컷에 배분하는 경로가 **유일하다**(로컬 OCR 실행은 제거됨).
  // hOCR 이 없는 어댑터(own-ocr: browser-assist·iiif·local-dir)에서 ocr.mjs 를 부르면 exit 1 →
  // last_error 가 박혀 그 호는 자동 드레인에서 영구 제외된다. 이미지·컷은 멀쩡한데 큐만 막히는 것이라,
  // 실행하지 않고 그대로 다음 단계(사람 검수)로 넘긴다. 대사는 검수에서 사람이 넣는다.
  const hocrPath = path.join(root, 'ocr', 'source.hocr')
  const canOcr = fs.existsSync(hocrPath)
  if (canOcr) {
    plan.segmented = { script: 'ocr.mjs', args: ['--intake', root] }
  }

  const step = plan[row.status]
  if (!step) {
    const skipNote =
      row.status === 'segmented'
        ? p.ocrStrategy === 'own-ocr'
          ? 'own-ocr 어댑터 — 소스가 hOCR 을 주지 않아 대사 추출을 건너뜁니다(검수에서 수동 입력)'
          : `${p.ocrStrategy} 전략인데 ${hocrPath} 가 없습니다 — 대사 추출을 건너뜁니다`
        : row.status === 'modernized'
          ? '현대화 산출물은 그대로 두고 사람 검수로 넘깁니다 — 실행되는 스크립트는 없습니다'
          : null
    // ocr → review 는 실행할 스크립트가 없다(사람 검수 대기로 넘김).
    // **dryRun 은 여기서도 쓰지 않는다** — 스크립트가 없다고 상태만 슬쩍 전진시키면
    // "계획만 보려던" 호출이 큐를 실제로 움직인다(계획과 실행의 구분이 무너진다).
    if (body.dryRun) {
      return NextResponse.json({
        dryRun: true,
        issueId: row.id,
        slug: row.slug,
        from: row.status,
        to: nextStatus,
        command: null,
        ...(skipNote ? { skipped: skipNote } : {}),
      })
    }
    await client
      .from('pd_comic_issues')
      .update({ status: nextStatus, last_run_at: new Date().toISOString() })
      .eq('id', row.id)
    return NextResponse.json({
      issueId: row.id,
      slug: row.slug,
      from: row.status,
      to: nextStatus,
      ran: null,
      ...(skipNote ? { skipped: skipNote } : {}),
    })
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
