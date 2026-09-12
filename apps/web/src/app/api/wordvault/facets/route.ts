// apps/web/src/app/api/wordvault/facets/route.ts
//
// 내 단어의 **면 분포 + 가장 뒤처진 면** — WordVault 허브가 읽는다.
//
// 왜 API 를 두는가:
//   계산은 `learning_records` 전량을 훑는다. WordVault 허브는 클라이언트 컴포넌트라
//   서버 컴포넌트를 끼워 넣을 수 없는데, 그렇다고 클라이언트가 직접 훑으면 **학습자의
//   인출 이력이 통째로 브라우저에 실린다**(RLS 로 본인 것이긴 하나 실을 이유가 없다).
//   그래서 서버가 접어서 요약만 내려보낸다 — 실제로 오가는 것은 면 6개의 카운트뿐이다.
//
// 인증: 세션 클라이언트를 쓰므로 RLS 가 그대로 적용된다. 비로그인은 401.

import { NextResponse } from 'next/server'

import { fetchFacetSummary } from '@/lib/framework/word-progress-query'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const summary = await fetchFacetSummary(supabase, user.id)
    return NextResponse.json(summary)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'facet summary failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
