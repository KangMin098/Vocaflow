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
      {/*
        건너뛰기 링크 — **키보드만 쓰는 학습자의 첫 번째 문.**

        ⚠️ 실측 2026-08-23(`27-keyboard-reach`): 본문 컨트롤에 닿기까지 Tab 이
           **중앙값 19번**(최대 23번) 걸렸다. 화면을 옮길 때마다 사이드바·리본·탭바를
           전부 지나야 한다는 뜻이다. 마우스 쓰는 사람에게는 0초인 일이,
           키보드 학습자에게는 **화면마다 19번**이다.

        Calm UI 라 평소에는 보이지 않는다. 다만 `sr-only` 로 숨기기만 하면
        **포커스됐을 때도 안 보여서** 어디에 있는지 알 수 없다 — 포커스되는 순간 드러난다.
      */}
      <a
        href="#main-content"
        className="sr-only rounded-[var(--r-md)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:flex focus:min-h-11 focus:items-center focus:bg-[var(--p)] focus:px-4 focus:font-display focus:text-[13px] focus:font-[700] focus:text-[var(--on-p)] focus:shadow-[var(--sh-md)] focus:outline-none focus:ring-2 focus:ring-[var(--p)] focus:ring-offset-2"
      >
        본문으로 건너뛰기
      </a>
      {/* 라우트 변경 시 body.style.overflow / focus-mode 강제 reset (sidebar 클릭 결함 차단) */}
      <GlobalBodyReset />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <StatusRibbon status={status} />
        {/* `tabIndex={-1}` 이 있어야 건너뛰기 링크가 실제로 여기에 포커스를 놓는다 —
            없으면 주소만 바뀌고 포커스는 그대로라, 다음 Tab 이 다시 셸로 돌아간다. */}
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
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
