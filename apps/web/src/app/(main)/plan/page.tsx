// apps/web/src/app/(main)/plan/page.tsx
// 학습 계획 — 자료(도서/스크립트/공용단어장)별 활동을 선택해 나만의 계획을 구성 (리틀팍스형).
// 수능 D-day 폐기(P1 재설계). 서버에서 계획 항목 + 추가 가능 자료 주입 → 클라이언트가 구성/수정.

import { PlanClient } from '@/components/plan/PlanClient'
import { Screen } from '@/components/ui/ios'
import { fetchAvailableMaterials, fetchStudyPlanItems } from '@/lib/learner/plan-actions'

export const metadata = {
  title: '학습 계획',
  description: '요일별로 도서(챕터)·스크립트·단어장·내 글을 골라 나만의 학습 계획을 만들어요',
}

/** KST 기준 오늘 요일 — 1=월 .. 7=일 (서버 산출 → 하이드레이션 불일치 방지). */
function kstWeekday(): number {
  const day = new Date(Date.now() + 9 * 3_600_000).getUTCDay() // 0=일 .. 6=토
  return day === 0 ? 7 : day
}

/** KST 기준 이번 주(월~일) 날짜 'M/D' 7개 — index 0=월 (서버 산출 → 하이드레이션 안전). */
function kstWeekDates(): string[] {
  const kstNow = Date.now() + 9 * 3_600_000
  const weekday = kstWeekday()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(kstNow + (i + 1 - weekday) * 86_400_000)
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
  })
}

export default async function PlanPage() {
  const [items, materials] = await Promise.all([
    fetchStudyPlanItems(),
    fetchAvailableMaterials(),
  ])

  return (
    <Screen width="wide" background="bg2" padX="md">
      <PlanClient
        initialItems={items}
        materials={materials}
        todayWeekday={kstWeekday()}
        weekDates={kstWeekDates()}
      />
    </Screen>
  )
}
