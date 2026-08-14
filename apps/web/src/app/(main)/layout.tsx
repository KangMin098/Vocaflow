// apps/web/src/app/(main)/layout.tsx
//
// 전역 셸. 상태는 **StatusRibbon 하나**가 맡는다 (ADR 0006 D2) —
// 이전에는 Sidebar·FlowNav·HubHero 가 각자 streak 을 그렸다(한 화면에 3중).

import { GlobalBodyReset } from '@/components/layout/GlobalBodyReset'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { SessionFrame } from '@/components/layout/SessionFrame'
import { Sidebar } from '@/components/layout/Sidebar'
import { StatusRibbon } from '@/components/layout/StatusRibbon'
import { fetchTodayStatus } from '@/lib/learner/today-status-query'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // 셸 상태 1회 조회 — 내부적으로 fetchGrowthStats·fetchTodayPrescription 을 재사용한다(cache()).
  const status = await fetchTodayStatus()

  return (
    <div className="flex min-h-screen bg-[var(--bg2)]">
      {/* 라우트 변경 시 body.style.overflow / focus-mode 강제 reset (sidebar 클릭 결함 차단) */}
      <GlobalBodyReset />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <StatusRibbon status={status} />
        <main className="min-w-0 flex-1">
          <SessionFrame>{children}</SessionFrame>
        </main>
        {/* 탭 자체는 fixed 이고, 콘텐츠 끝을 가리지 않게 하는 여백은 이 컴포넌트가 같이 낸다.
            여백을 여기 레이아웃에 두면 **탭이 없는 풀스크린 세션에도** 남아 세션 화면이
            뷰포트보다 길어진다(첫 구현이 그랬고 `20-mobile-shell` D 가 잡았다). */}
        <MobileTabBar status={status} />
      </div>
    </div>
  )
}
