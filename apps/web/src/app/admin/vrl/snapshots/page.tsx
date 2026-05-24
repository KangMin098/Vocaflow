// apps/web/src/app/admin/vrl/snapshots/page.tsx
// VRL Pipeline · Level Snapshots Audit (Phase 2 — stub)

import { requireAdmin } from '@/lib/auth/require-admin'
import { StubPage } from '@/components/dev/StubPage'

export const metadata = {
  title: 'VRL Snapshots — Vocaflow Admin',
  description: 'user_level_snapshots 감사 로그',
}

export default async function VrlSnapshotsPage() {
  await requireAdmin('/admin/vrl/snapshots')
  return (
    <StubPage
      title="VRL Level Snapshots Audit"
      description="user_level_snapshots 전체 chain 감사. snapshot_type · triggered_by · trigger_details · previous_snapshot_id 기반 audit 추적. 현재 2 initial snapshots."
      upcoming={[
        'snapshot_type · triggered_by · taken_reason 필터',
        'previous_snapshot_id chain 시각화 (delta · zone 변화)',
        'JSONB trigger_details 펼침 보기',
        'user별 history view',
      ]}
    />
  )
}
