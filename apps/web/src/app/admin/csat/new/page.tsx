// apps/web/src/app/admin/csat/new/page.tsx
// 새 교재 만들기 — 준비된 자산으로 한 권을 발주까지 끌고 가는 네 걸음.
// 공정 화면 여덟이 「공장 전체가 어떤가」를 말한다면, 여기는 **「이 한 권」**만 말한다.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadOrderView } from '@/lib/csat/order-view'

import { OrderWizard } from './OrderWizard'

export const dynamic = 'force-dynamic'

export default async function AdminCsatNewPage() {
  await requireAdmin('/admin/csat/new')
  const view = await loadOrderView()
  return <OrderWizard {...view} />
}
