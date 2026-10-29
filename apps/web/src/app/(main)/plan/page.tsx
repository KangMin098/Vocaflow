// apps/web/src/app/(main)/plan/page.tsx
// 학습 계획 — 자료(도서/스크립트/공용단어장)별 활동을 선택해 나만의 계획을 구성 (리틀팍스형).
// 수능 D-day 폐기(P1 재설계). 서버에서 계획 항목 + 추가 가능 자료 주입 → 클라이언트가 구성/수정.

import { PlanClient } from '@/components/plan/PlanClient'
import { Screen } from '@/components/ui/ios'
import { fetchAvailableMaterials, fetchStudyPlanSnapshot } from '@/lib/learner/plan-actions'

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
  // 읽기 facade(T-0240) — 목록 · 실패 · 그 목록을 읽은 viewer 를 한 번의 조회로. 기존 fetchStudyPlanItems 는 부르지 않는다(중복 조회 0)
  const [plan, materials] = await Promise.all([
    fetchStudyPlanSnapshot(),
    fetchAvailableMaterials(),
  ])

  return (
    <Screen width="wide" background="bg2" padX="md">
      {/* key 로 재마운트하지 않는다(r5) — 일시 인증 실패(viewer null)가 마지막 확인 계획 · 미저장 선택을 지우지 않게.
          소유자 변경 판정(확정된 다른 viewer 면 경계를 닫음)은 PlanClient 안쪽 guard 가 한다 */}
      <PlanClient
        initialItems={plan.items}
        initialFailed={plan.failed}
        viewerId={plan.viewerId}
        materials={materials}
        todayWeekday={kstWeekday()}
        weekDates={kstWeekDates()}
      />
    </Screen>
  )
}
