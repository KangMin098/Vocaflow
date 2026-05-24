// apps/web/src/app/admin/vrl/concerns/page.tsx
// VRL Pipeline · Data Integrity Concerns (Phase 2 — stub)

import { requireAdmin } from '@/lib/auth/require-admin'
import { StubPage } from '@/components/dev/StubPage'

export const metadata = {
  title: 'VRL Concerns — Vocaflow Admin',
  description: 'VRL 데이터 정합 의심 단어 cleanup 콘솔',
}

export default async function VrlConcernsPage() {
  await requireAdmin('/admin/vrl/concerns')
  return (
    <StubPage
      title="VRL Concerns"
      description="vrl_data_integrity_concerns 테이블 기반 의심 단어 cleanup. 현재 0 open / 12 resolved (modal/linking family 등)."
      upcoming={[
        'Open / Resolved 필터 + type-별 분류',
        'word / type / detected_at 컬럼 표시',
        '단어 클릭 → shared_dictionary 상세 + DELETE / RESOLVE 액션',
        'Filter: type · resolved · date range',
      ]}
    />
  )
}
