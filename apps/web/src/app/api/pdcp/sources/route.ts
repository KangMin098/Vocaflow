// apps/web/src/app/api/pdcp/sources/route.ts
//
// 소스 어댑터 목록 + 능력표. Admin 이 "이 사이트는 뭘 할 수 있나"를 표로 보게 한다.
//
// 어댑터 정의는 파이프라인(scripts/comic/pd/sources)에 있고 앱은 그걸 읽기만 한다 —
// 능력표를 앱에 복제하면 즉시 drift 한다(아케이드 카탈로그에서 이미 겪은 실패).

import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { loadAdapters } from '@/lib/pd-comic/pipeline-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  try {
    const adapters = await loadAdapters()
    return NextResponse.json({
      adapters: adapters.map((a) => ({
        id: a.id,
        label: a.label,
        caps: a.caps,
        profile: a.profile,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
