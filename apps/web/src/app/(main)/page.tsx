// apps/web/src/app/main/page.tsx
// 메인 대시보드 — Round 3: 모든 컴포넌트 조립 (최종)

'use client'

import { ModuleAccuracyRing } from '@/components/dashboard/ModuleAccuracyRing'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { ScoreTrendChart } from '@/components/dashboard/ScoreTrendChart'
import { StatCard } from '@/components/dashboard/StatCard'
import { WeeklyHeatmap } from '@/components/dashboard/WeeklyHeatmap'
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner'
import { DashboardHeader, type Period } from '@/components/layout/DashboardHeader'
import { useToast } from '@/components/ui/Toast'
import { BookOpen, Clock, Flame, Target } from 'lucide-react'
import { useState } from 'react'
import { useMainLayout } from './layout'

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('30')
  const { openSidebar, theme, toggleTheme } = useMainLayout()
  const toast = useToast()

  return (
    <>
      <DashboardHeader
        title="학습 Dashboard"
        subtitle="마지막 업데이트 · 방금 전"
        period={period}
        onPeriodChange={setPeriod}
        onMenuClick={openSidebar}
        theme={theme}
        onThemeToggle={toggleTheme}
        onExport={() => toast.info('내보내기 (Phase 2에서 구현)')}
      />

      <main className="flex-1 overflow-y-auto p-s-4 lg:p-s-6">
        <div className="mx-auto max-w-page">
          {/* Welcome */}
          <WelcomeBanner userName="김민준" weekDays={5} weekWords={47} />

          {/* StatCard 4개 */}
          <div className="mb-s-6 grid grid-cols-1 gap-s-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="총 단어 수"
              value={342}
              unit="개"
              icon={BookOpen}
              accentColor="#8B5CF6"
              trend="up"
              trendText="+12"
              subtext="이번 주"
              onClick={() => toast.info('WordVault로 이동 (구현 예정)')}
            />
            <StatCard
              label="평균 정확도"
              value={87}
              unit="%"
              icon={Target}
              accentColor="#3B82F6"
              trend="up"
              trendText="+3%"
              subtext="지난 30일"
              onClick={() => toast.info('정확도 상세 (구현 예정)')}
            />
            <StatCard
              label="연속 학습"
              value={7}
              unit="일"
              icon={Flame}
              accentColor="#EC4899"
              trend="record"
              trendText="신기록"
              subtext="🔥 계속 이어가요"
            />
            <StatCard
              label="오늘 학습"
              value={12}
              unit="분"
              icon={Clock}
              accentColor="#10B981"
              trend="flat"
              trendText="진행 중"
              subtext="목표 30분"
            />
          </div>

          {/* 차트 그리드 — 2단 */}
          {/* 1행: Heatmap (큰) + AccuracyRing (작은) */}
          <div className="mb-s-4 grid grid-cols-1 gap-s-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <WeeklyHeatmap />
            </div>
            <div className="lg:col-span-1">
              <ModuleAccuracyRing />
            </div>
          </div>

          {/* 2행: ScoreTrend (큰) + RecentActivity (작은) */}
          <div className="mb-s-6 grid grid-cols-1 gap-s-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ScoreTrendChart />
            </div>
            <div className="lg:col-span-1">
              <RecentActivity />
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
