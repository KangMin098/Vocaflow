// apps/web/src/app/admin/vrl/diagnostic/page.tsx
// VRL Pipeline · Diagnostic System (Phase 2 — stub)

import { requireAdmin } from '@/lib/auth/require-admin'
import { StubPage } from '@/components/dev/StubPage'

export const metadata = {
  title: 'VRL Diagnostic — Vocaflow Admin',
  description: 'VRL 진단 테스트/문항 관리 콘솔',
}

export default async function VrlDiagnosticPage() {
  await requireAdmin('/admin/vrl/diagnostic')
  return (
    <StubPage
      title="VRL Diagnostic System"
      description="vrl_diagnostic_tests / vrl_diagnostic_questions 관리. 현재 0 tests / 0 questions / 0 results — 시드 대기."
      upcoming={[
        'V-Level 진단 테스트 시드 (V1-V11 시그니처 단어, V0 skip)',
        'Track / Domain 진단 테스트 (6 tracks × 10 / 8 domains × 5)',
        '문항 편집 UI (target_v_level · difficulty_weight)',
        'user_diagnostic_results 결과 분석 대시',
      ]}
    />
  )
}
