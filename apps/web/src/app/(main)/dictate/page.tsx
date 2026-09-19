// apps/web/src/app/(main)/dictate/page.tsx
// Dictation Hub — /dictate
//
// ── 2026-09-06 — 이 파일이 서버 컴포넌트가 됐다 ────────────────────────
// 이 파일이 `'use client'` 였던 이유는 없었다(그냥 클라이언트 컴포넌트 하나를 감싸고
// 있었다). 그런데 그 한 줄 때문에 **서버가 그리는 것이 하나도 없었고**, 하이드레이션
// 뒤에 `DictationHubClient` 가 페처 5종을 불러 브라우저 데이터 요청이 **15건**이었다 —
// 학습자 화면 중 가장 많았다. 조회는 전부 `lib/dictation/hub-query.ts` 로 내렸다.
//
// ⚠️ 실패를 빈 상태로 내리지 않는다 — `failed` 를 그대로 넘겨 화면이
//    「못 불러왔어요 + 다시 시도」를 말한다(CONVENTIONS 「조용한 실패」).

import { redirect } from 'next/navigation'

import { Screen } from '@/components/ui/ios'
import { DictationHubClient } from '@/components/dictation/DictationHubClient'
import { loadDictationHubData } from '@/lib/dictation/hub-query'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DictationHubPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 미들웨어(`lib/auth/protected-routes`)가 이미 막지만, 화면이 스스로도 막는다 —
  // 이 화면은 개인 학습 이력만 그리므로 세션 없이 도달하면 빈 화면이 된다.
  if (!user) redirect('/login?next=%2Fdictate')

  const data = await loadDictationHubData(supabase, user.id)

  return (
    <Screen width="content" background="bg2" padX="md">
      <DictationHubClient data={data} />
    </Screen>
  )
}
