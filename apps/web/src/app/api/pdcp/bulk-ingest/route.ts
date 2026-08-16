// apps/web/src/app/api/pdcp/bulk-ingest/route.ts
//
// 대량 소스 GET — 컬렉션 **전량**을 유형·시리즈까지 분류해 큐에 적재한다.
//
// /api/pdcp/enqueue 와의 차이:
//   enqueue 는 "화면에 뜬 검색 결과 중 고른 것"(최대 50건, 호당 metadata 왕복 1회)을 넣는다.
//   여기는 컬렉션 전량을 검색 응답만으로 넣는다 — 969건 적재에 IA 요청 11회.
//   사람이 50번 클릭하는 대신 한 번 누른다.
//
//   GET  → 무엇이 적재될지 계획만 (네트워크는 치지만 DB 쓰기 0)
//   POST → 실제 적재
//
// dev 전용이 아니다 — 이미지 작업이 아니라 메타데이터 적재라 배포 환경에서도 안전하다.
// 다만 외부 사이트를 훑으므로 admin 권한을 요구한다.

import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { runPipeline } from '@/lib/pd-comic/pipeline-bridge'

export const runtime = 'nodejs'
// 1,000건 훑기 + 배치 적재. IA 페이지네이션 11회 + upsert 5배치 ≈ 30~60초.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

/** CLI 표준출력에서 사람이 볼 요약만 추린다 — 진행 점(.)은 버린다. */
function summarize(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((l) => l.replace(/\.+$/, '').trimEnd())
    .filter((l) => l.trim().length > 0)
}

async function run(args: string[]) {
  const r = await runPipeline('ingest-bulk.mjs', args, { timeoutMs: 280_000 })
  if (!r.ok) {
    return NextResponse.json(
      {
        error: r.timedOut
          ? '타임아웃 — CLI 로 실행하세요: node scripts/comic/pd/ingest-bulk.mjs'
          : (r.stderr || r.stdout).slice(-800),
      },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true, lines: summarize(r.stdout) })
}

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  return run(['--dry-run'])
}

export async function POST(request: Request): Promise<NextResponse> {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

  const body = (await request.json().catch(() => ({}))) as {
    collection?: string
    pages?: number | null
  }
  const args: string[] = []
  if (body.collection) args.push('--collection', String(body.collection))
  // pages 미지정/0 = 전권. 테스트 적재는 앞 N장만.
  if (body.pages != null && Number(body.pages) > 0) {
    args.push('--pages', String(Math.min(200, Math.max(1, Number(body.pages)))))
  }
  return run(args)
}
