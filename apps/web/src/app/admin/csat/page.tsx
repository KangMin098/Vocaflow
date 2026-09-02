// apps/web/src/app/admin/csat/page.tsx
// 기출 분석(CSAT) 콘솔 — 회차별 99점 커버리지 · 유형별 진행 · 드레인 절차.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadCsatOverview } from '@/lib/csat/client'

import { CsatConsoleClient } from './CsatConsoleClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatPage() {
  await requireAdmin('/admin/csat')
  const overview = await loadCsatOverview()
  return <CsatConsoleClient {...overview} />
}
