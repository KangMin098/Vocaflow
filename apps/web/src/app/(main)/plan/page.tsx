// apps/web/src/app/(main)/plan/page.tsx
// 학습 계획 — 자료(도서/스크립트/공용단어장)별 활동을 선택해 나만의 계획을 구성 (리틀팍스형).
// 수능 D-day 폐기(P1 재설계). 서버에서 계획 항목 + 추가 가능 자료 주입 → 클라이언트가 구성/수정.

import { PlanClient } from '@/components/plan/PlanClient'
import { Screen } from '@/components/ui/ios'
import { fetchAvailableMaterials, fetchStudyPlanItems } from '@/lib/learner/plan-actions'

export const metadata = {
  title: '학습 계획 · Vocaflow',
  description: '도서·스크립트·단어장별로 할 활동을 골라 나만의 학습 계획을 만들어요',
}

export default async function PlanPage() {
  const [items, materials] = await Promise.all([
    fetchStudyPlanItems(),
    fetchAvailableMaterials(),
  ])

  return (
    <Screen width="content" background="bg2" padX="md">
      <PlanClient initialItems={items} materials={materials} />
    </Screen>
  )
}
