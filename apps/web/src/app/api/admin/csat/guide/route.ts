// apps/web/src/app/api/admin/csat/guide/route.ts
//
// GET /api/admin/csat/guide?format=json|md
//
// 기출 분석에서 뽑은 **학습 가이드 원천 자료**를 그대로 내준다.
// 콘솔의 「가이드 원천」 탭이 이것을 읽고, 같은 URL 이 교재 집필용 다운로드도 된다 —
// 화면이 보는 것과 내려받는 것이 갈라지지 않게 경로를 하나로 둔다.
//
// ⚠️ admin 게이트 뒤에 둔다. 자료 자체에 평가원 지문 원문은 없지만(조회 컬럼에서 이미 뺐다),
//    분석 서술 전량은 우리 콘텐츠 자산이라 공개 경로로 내보내지 않는다.

import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { loadCsatGuideSource } from '@/lib/csat/guide'
import { renderGuideMarkdown } from '@/lib/csat/guide-fold'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const sp = new URL(req.url).searchParams
  const format = sp.get('format') === 'md' ? 'md' : 'json'
  // 탭이 읽을 때는 그냥 JSON, 「내려받기」로 누르면 파일로 떨어진다 — 경로를 둘로 나누지 않는다
  const asFile = sp.get('download') === '1'

  const { source, error } = await loadCsatGuideSource()
  if (error || !source) {
    return NextResponse.json({ ok: false, error: error ?? '가이드 원천을 만들지 못했다' }, { status: 500 })
  }

  const stamp = source.generated_at.slice(0, 10).replace(/-/g, '')

  if (format === 'md') {
    return new NextResponse(renderGuideMarkdown(source), {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="csat-guide-source-${stamp}.md"`,
        'cache-control': 'no-store',
      },
    })
  }

  return NextResponse.json(
    { ok: true, source },
    {
      headers: {
        'cache-control': 'no-store',
        ...(asFile
          ? { 'content-disposition': `attachment; filename="csat-guide-source-${stamp}.json"` }
          : {}),
      },
    },
  )
}
