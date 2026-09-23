// apps/web/src/app/admin/csat/sources/page.tsx
//
// ⚠️ 이 화면은 **커밋된 스냅샷**을 그린다(본문을 읽어야 나오는 판정이 들어 있어 요청마다
//   다시 할 수 없다). 2026-09-23 부터 그 옆에 **지금 DB 와의 차이**를 함께 싣는다 —
//   그 전에는 드레인을 돌려도 화면이 안 움직여서 관리자가 「안 늘었다」를 보고 안 해도 될
//   일을 또 했다(실측: 스냅샷 87,716 vs DB 87,720). DD-74.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadEligibilityDrift } from '@/lib/textbook/eligibility-drift'
import { buildSourceEligibilityPanel } from '@/lib/textbook/source-eligibility-view'
import { buildSourceInventoryPanel } from '@/lib/textbook/source-inventory-view'
import { parseSourceWorkspace } from '@/lib/textbook/source-workspace'
import { SourceEligibilityClient } from './SourceEligibilityClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatSourcesPage({ searchParams }: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  await requireAdmin('/admin/csat/sources')
  const panel = buildSourceEligibilityPanel()
  // 화면이 이미 읽은 스냅샷 값을 그대로 넘긴다 — 여기서 파일을 다시 읽으면
  // 두 곳이 다른 스냅샷을 보게 된다.
  const drift = await loadEligibilityDrift(panel.measuredAt, panel.total.byGrade)
  return (
    <SourceEligibilityClient
      panel={panel}
      inventory={buildSourceInventoryPanel()}
      initialState={parseSourceWorkspace(searchParams)}
      drift={drift}
    />
  )
}
