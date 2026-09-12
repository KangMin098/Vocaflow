// apps/web/src/app/api/admin/csat/items/route.ts
//
// GET /api/admin/csat/items            → 문항 감사 한 벌 (802행)
// GET /api/admin/csat/items?item=<id>  → 그 문항의 분석 전문
//
// 콘솔의 「문항 분석」 탭이 읽는다. 목록은 탭을 열 때, 전문은 한 줄을 열 때 부른다 —
// 802문항의 서술을 전부 첫 응답에 실으면 몇 MB 가 된다.
//
// ⚠️ admin 게이트 뒤에 둔다. 평가원 지문·선지 원문은 조회 컬럼에서 이미 빠져 있고,
//    나가는 것은 분석(우리 저작물)과 그 안의 짧은 인용까지다.

import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { loadCsatItemAudit, loadCsatItemFull } from '@/lib/csat/items'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const itemId = new URL(req.url).searchParams.get('item')

  if (itemId) {
    const { item, error } = await loadCsatItemFull(itemId)
    if (error || !item) return NextResponse.json({ ok: false, error: error ?? '문항이 없다' }, { status: 404 })
    return NextResponse.json({ ok: true, item }, { headers: { 'cache-control': 'no-store' } })
  }

  const { page, error } = await loadCsatItemAudit()
  if (error || !page) {
    return NextResponse.json({ ok: false, error: error ?? '문항 감사를 만들지 못했다' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, ...page }, { headers: { 'cache-control': 'no-store' } })
}
