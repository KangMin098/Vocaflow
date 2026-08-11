// apps/web/src/app/api/pdcp/modernize/route.ts
//
// 현대화 콘솔 트리거 — 그동안 CLI 전용이던 현대화를 이슈별로 콘솔에서 실행. 드레인과 같은 구조
// (앱이 아니라 파이프라인 CLI 가 무거운 일을 함). dev·admin.
//   POST { issueId, track }
//     track='preserve' (작화 보존) → page-modern.mjs(MAX) → page-html.mjs   [CPU·$0]
//     track='restyle'  (AI 리스타일) → modernize.mjs(qwen @ runpod-4090)     [GPU·COMFY_URL 필요]
//     track='erase-preview' → modernize.mjs --erase-only                     [GPU 미사용]
//
// erase-preview 가 왜 필요한가: 모델 트랙의 유일한 비가역 비용은 GPU 시간인데,
// 지우기에서 남은 글자를 모델이 **가짜 글자로 재현**한다. 태우기 전에 눈으로 확인해야 한다.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { runPipeline } from '@/lib/pd-comic/pipeline-bridge'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 모델·환경은 여기 한 곳에만 적는다. CLI 인자와 DB 기록이 갈리면 감사 기록이 거짓이 된다.
const MODEL = 'qwen-image-edit-2511'
// edit 워크플로가 RunPod 에만 프로비저닝돼 있다(Kaggle T4 = t2i-only, 실측).
const ENV = 'runpod-4090'

const tail = (s: string, n = 6) => (s || '').split('\n').filter(Boolean).slice(-n)

export async function POST(request: Request): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'dev 전용' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as { issueId?: string; track?: string }
  const issueId = body.issueId
  const track =
    body.track === 'restyle' ? 'restyle' : body.track === 'erase-preview' ? 'erase-preview' : 'preserve'
  if (!issueId) return NextResponse.json({ error: 'issueId 가 필요합니다' }, { status: 400 })

  const client = createAdminClient() as unknown as SupabaseClient
  const { data: row } = await client.from('pd_comic_issues').select('slug, qc').eq('id', issueId).maybeSingle()
  const qc = (row?.qc ?? null) as { workDir?: string } | null
  const wd = typeof qc?.workDir === 'string' ? qc.workDir : null
  if (!wd) return NextResponse.json({ error: 'work 디렉터리가 없습니다 — 먼저 드레인(취득~OCR)을 완료하세요' }, { status: 400 })

  // 트랙별 실행 스텝 (드레인처럼 CLI spawn)
  const steps =
    track === 'erase-preview'
      ? [{ script: 'modernize.mjs', args: ['--workdir', wd, '--erase-only'], timeoutMs: 300_000 }]
      : track === 'restyle'
      ? [{ script: 'modernize.mjs', args: ['--workdir', wd, '--model', MODEL, '--env', ENV, '--limit', '8'], timeoutMs: 600_000 }]
      : [
          { script: 'page-modern.mjs', args: ['--workdir', wd, '--level', 'MAX'], timeoutMs: 300_000 },
          { script: 'page-html.mjs', args: ['--workdir', wd], timeoutMs: 120_000 },
        ]

  const results: Array<{ script: string; ok: boolean; tail: string[] }> = []
  for (const s of steps) {
    const r = await runPipeline(s.script, s.args, { timeoutMs: s.timeoutMs })
    results.push({ script: s.script, ok: r.ok, tail: tail(r.ok ? r.stdout : r.stderr || r.stdout) })
    if (!r.ok) {
      return NextResponse.json({
        ok: false, track, slug: row?.slug ?? null,
        error: `${s.script} 실패${r.timedOut ? ' (타임아웃)' : ''}`,
        steps: results,
      })
    }
  }

  // 어떤 트랙·모델로 만들었는지 남긴다 — 없으면 재현도 라이선스 감사도 불가능하다.
  // 지우기 확인은 산출물이 아니므로 기록하지 않는다(GPU 도 안 쓴다).
  if (track !== 'erase-preview') {
    await client
      .from('pd_comic_issues')
      .update({
        status: 'modernized',
        modernize_track: track,
        modernize_model: track === 'restyle' ? MODEL : null,
        modernize_env: track === 'restyle' ? ENV : null,
      })
      .eq('id', issueId)
  }

  return NextResponse.json({ ok: true, track, slug: row?.slug ?? null, steps: results })
}
