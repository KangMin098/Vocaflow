// apps/web/src/app/(main)/layout.tsx

import { FlowNav } from '@/components/layout/FlowNav'
import { GlobalBodyReset } from '@/components/layout/GlobalBodyReset'
import { SessionFrame } from '@/components/layout/SessionFrame'
import { Sidebar } from '@/components/layout/Sidebar'
import { fetchGrowthStats } from '@/lib/learner/growth-stats'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // 전역 셸 실데이터 (streak·기억분포·주간일수) — cache() 라 dashboard 와 요청 공유
  const growth = await fetchGrowthStats()

  return (
    <div className="flex min-h-screen bg-[var(--bg2)]">
      {/* 라우트 변경 시 body.style.overflow / focus-mode 강제 reset (sidebar 클릭 결함 차단) */}
      <GlobalBodyReset />
      <Sidebar streak={growth?.streak ?? 0} />
      <div className="flex min-w-0 flex-1 flex-col">
        <FlowNav
          momentum={
            growth
              ? { streak: growth.streak, mastery: growth.memory, weekDays: growth.weekDays }
              : null
          }
        />
        <main className="min-w-0 flex-1">
          <SessionFrame>{children}</SessionFrame>
        </main>
      </div>
    </div>
  )
}
