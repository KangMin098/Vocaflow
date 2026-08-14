// apps/web/src/app/(main)/layout.tsx

import { FlowNav } from '@/components/layout/FlowNav'
import { GlobalBodyReset } from '@/components/layout/GlobalBodyReset'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
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
        {/* 탭 자체는 fixed 이고, 콘텐츠 끝을 가리지 않게 하는 여백은 이 컴포넌트가 같이 낸다.
            여백을 여기 레이아웃에 두면 **탭이 없는 풀스크린 세션에도** 남아 세션 화면이
            뷰포트보다 길어진다(첫 구현이 그랬고 `20-mobile-shell` D 가 잡았다). */}
        <MobileTabBar />
      </div>
    </div>
  )
}
