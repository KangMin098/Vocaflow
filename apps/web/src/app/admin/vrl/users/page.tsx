// apps/web/src/app/admin/vrl/users/page.tsx
// VRL Pipeline · User V-Levels (Phase 2 — stub)

import { requireAdmin } from '@/lib/auth/require-admin'
import { StubPage } from '@/components/dev/StubPage'

export const metadata = {
  title: 'VRL Users — Vocaflow Admin',
  description: '사용자 V-Level 분포 + 상세',
}

export default async function VrlUsersPage() {
  await requireAdmin('/admin/vrl/users')
  return (
    <StubPage
      title="VRL User Levels"
      description="user_profiles.current_v_level + meta JSONB 기반 사용자 분포. 현재 2 profiles (모두 system_default L0)."
      upcoming={[
        'V-Level 분포 12 막대 차트',
        '사용자 목록 (user_id · segment · V-Level · source · last_active)',
        '진단 완료 비율 (diagnostic_completed_at)',
        '사용자 클릭 → /admin/vrl/users/[user_id] 상세 + 히스토리',
      ]}
    />
  )
}
