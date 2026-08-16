// apps/web/src/app/api/pdcp/doctor/route.ts
//
// 도구 점검 — 드레인이 실패하는 이유의 대부분은 코드가 아니라 **외부 도구 부재**다
// (ffmpeg 없음 / 소스 접근 차단).
// 큐가 계속 failed 로 떨어질 때 여기부터 보게 한다.

import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { runPipeline } from '@/lib/pd-comic/pipeline-bridge'

export const runtime = 'nodejs'
export const maxDuration = 90
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const r = await runPipeline('pipeline.mjs', ['--doctor'], { timeoutMs: 70_000 })
  return NextResponse.json({
    ok: r.ok,
    timedOut: r.timedOut,
    // CLI 표 출력을 파싱하지 않고 원문을 넘긴다 — 포맷에 의존하면 조용히 깨진다
    output: (r.stdout || r.stderr).slice(-6000),
    env: {
      ffmpegBin: process.env.FFMPEG_BIN ?? '(PATH)',
      nodeEnv: process.env.NODE_ENV,
    },
  })
}
