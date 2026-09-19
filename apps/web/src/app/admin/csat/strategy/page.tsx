// apps/web/src/app/admin/csat/strategy/page.tsx
// 공정 ② 기획 — 시중 대비 우위. 판정은 합본 평균이 아니라 구속점으로 한다.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadMarketView } from '@/lib/csat/factory-views'

import { MarketClient } from './MarketClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatStrategyPage() {
  await requireAdmin('/admin/csat/strategy')
  const view = await loadMarketView()
  return <MarketClient {...view} />
}
