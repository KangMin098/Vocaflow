// apps/web/src/app/(main)/diagnostic/page.tsx
// VRL Placement v1 진단 페이지 — 40문항 V-Level 측정
//
// Phase 2 활용 시스템 진입점:
//   - 사용자 진단 → user_profiles.current_v_level 셋팅
//   - interests 선택 → specialty 단어장 추천
//   - WordVault hub 추천 카드 활성화 + Library Krashen i+1 weight

import { Screen } from '@/components/ui/ios'
import { DiagnosticClient } from '@/components/diagnostic/DiagnosticClient'

export const metadata = {
  title: '진단 — Vocaflow',
  description: '5분 진단으로 당신의 V-Level을 측정하고 맞춤 단어장을 추천받으세요.',
}

export default function DiagnosticPage() {
  return (
    <Screen width="full" background="bg2" padX="none">
      <DiagnosticClient />
    </Screen>
  )
}
