// apps/web/src/app/admin/csat/new/page.tsx
// 새 교재 만들기 — 준비된 자산으로 한 권을 발주까지 끌고 가는 네 걸음.
// 공정 화면 여덟이 「공장 전체가 어떤가」를 말한다면, 여기는 **「이 한 권」**만 말한다.
//
// 2026-09-24 — 맨 위에 「어떤 교재를 만드나요?」(다섯 갈래)를 얹었다. 새 시리즈 · 브랜드 · 단행본은
// 화면 버튼으로 끝나지 않아서, 그 절차가 도움말 산문에만 있었고 사용자는 방법을 몰랐다.

import { requireAdmin } from '@/lib/auth/require-admin'
import { loadOrderView } from '@/lib/csat/order-view'

import { MakeGuide } from './MakeGuide'
import { OrderWizard } from './OrderWizard'

export const dynamic = 'force-dynamic'

export default async function AdminCsatNewPage() {
  await requireAdmin('/admin/csat/new')
  const view = await loadOrderView()
  // 학년 이름은 독해 시리즈의 계단(학령 정본 SERIES_SPINE 의 순서)에서 가져온다 — 여기서 짓지 않는다.
  const grades = [...new Set(view.volumes.filter((v) => v.seriesId === 'reading').map((v) => v.schoolBand))]
  return <OrderWizard {...view} guide={<MakeGuide grades={grades} seriesList={view.seriesList} />} />
}
