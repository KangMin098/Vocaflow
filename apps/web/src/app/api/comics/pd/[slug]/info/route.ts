// apps/web/src/app/api/comics/pd/[slug]/info/route.ts
//
// @auth public — /comics 카탈로그 공개 정책(발견·SEO). RPC 가 published 만 돌려주므로
//   미발행 호의 서지는 새지 않는다.
//
// 콘텐츠 정보 팝업 데이터 — 학습자 공개 경로.
//
// 왜 별도 라우트인가: 서가에 카드가 수십~수백 개인데 정보를 미리 다 실어 보내면 첫 페인트가
// 그만큼 느려진다. 팝업을 **열 때** 한 건만 가져온다(컴포넌트가 force-cache 로 재요청도 막는다).
//
// 인증 불필요 — /comics 카탈로그는 공개 유지(발견·SEO) 정책을 따른다. RPC 가 published 만 돌려주므로
// 미발행 호의 서지가 새어 나가지 않는다.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { selectPdComicInfo } from '@/lib/pd-comic/queries'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
): Promise<NextResponse> {
  const client = (await createClient()) as unknown as SupabaseClient
  const info = await selectPdComicInfo(client, params.slug)
  if (!info) {
    return NextResponse.json({ error: '해당 만화를 찾을 수 없습니다' }, { status: 404 })
  }
  return NextResponse.json(info, {
    // 발행된 호의 서지는 거의 바뀌지 않는다 — 팝업을 여러 번 열어도 왕복하지 않게.
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
  })
}
