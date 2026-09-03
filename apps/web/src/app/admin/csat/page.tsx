// apps/web/src/app/admin/csat/page.tsx
// 기출 분석(CSAT) 콘솔 — 회차별 독해 실점 0 커버리지 · 유형별 진행 · 드레인 절차. 듣기는 다루지 않는다.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadCsatOverview } from '@/lib/csat/client'

import { CsatConsoleClient } from './CsatConsoleClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatPage() {
  await requireAdmin('/admin/csat')
  const overview = await loadCsatOverview()
  return <CsatConsoleClient {...overview} />
}
