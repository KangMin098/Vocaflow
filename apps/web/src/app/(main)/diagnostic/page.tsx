// apps/web/src/app/(main)/diagnostic/page.tsx
// VRL Placement v1 진단 페이지 — 40문항 V-Level 측정
//
// Phase 2 활용 시스템 진입점:
//   - 사용자 진단 → user_profiles.current_v_level 셋팅
//   - interests 선택 → specialty 단어장 추천
//   - WordVault hub 추천 카드 활성화 + Library Krashen i+1 weight
//
// viewer(DIAG-RESUME-BIND-01): 서버가 쿠키 세션으로 확인한 본인 uid 를 넘긴다 — 하다 만 진단 보관분의 주인이며,
//   화면은 브라우저 신원이 이 uid 와 같을 때만 보관분을 보이고 · 잇고 · 제출한다. 비로그인이면 null(메모리만).

import { Screen } from '@/components/ui/ios'
import { DiagnosticClient } from '@/components/diagnostic/DiagnosticClient'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: '진단',
  description: '5분 진단으로 당신의 V-Level을 측정하고 맞춤 단어장을 추천받으세요.',
}

export default async function DiagnosticPage() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  return (
    <Screen width="full" background="bg2" padX="none">
      {/* viewer 가 바뀌면(RSC 갱신 등) 화면 상태를 통째로 새로 시작한다 — 이전 계정의 응답 · 제출 묶음이 남지 않는다 */}
      <DiagnosticClient key={user?.id ?? 'anon'} viewerId={user?.id ?? null} />
    </Screen>
  )
}
