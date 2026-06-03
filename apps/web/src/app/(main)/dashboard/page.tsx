// apps/web/src/app/(main)/dashboard/page.tsx
// 대시보드 — 학습자에게 필요한 정보만 (Calm UI · Implicit Progress · Cognitive Load).
//
// 구성 (중복·과분석 제거):
//   1. TodayHero      — 오늘 목표 진행 + 인사 + 이어서 학습 (오늘 한 가지)
//   2. WeeklyHeatmap  — 28일 활동 + 연속(streak)  (성장·모멘텀)
//   3. MemoryStatus   — 기억 4상태 분포 + 복습 CTA (가장 actionable)
//   4. RecentActivity — 최근 학습 (회고)
//
// 제거: 중복 KPI 그리드(streak·단어 3중복) · ModuleAccuracyRing · ScoreTrendChart
//       (모듈별 정확도·점수추이는 일상 학습에 불필요한 과분석 — Calm UI 정합).
// metadata 는 dashboard/layout.tsx 에 분리.

import { MemoryStatus } from '@/components/dashboard/MemoryStatus'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { TodayHero } from '@/components/dashboard/TodayHero'
import { WeeklyHeatmap } from '@/components/dashboard/WeeklyHeatmap'

export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
      <TodayHero userName="학습자" todayWords={23} goal={30} />

      <WeeklyHeatmap />

      <MemoryStatus />

      <RecentActivity />

      {/* Calm closing — 정서적 부호화 */}
      <footer className="mt-6 text-center">
        <p className="font-english text-[14px] italic leading-relaxed text-[var(--t3)]">
          “Slow is smooth, smooth is fast.”
        </p>
        <p className="mt-1 font-body text-[12px] text-[var(--t3)]">
          오늘도 차분한 페이스로 잘 해내고 있어요.
        </p>
      </footer>
    </div>
  )
}
