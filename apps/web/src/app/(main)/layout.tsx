// apps/web/src/app/(main)/layout.tsx
//
// 전역 셸. 상태는 **CompassRibbon 하나**가 맡는다 (ADR 0006 D2 계승) —
// 이전에는 Sidebar·FlowNav·HubHero 가 각자 streak 을 그렸다(한 화면에 3중).
//
// v06.34 — 띠를 `StatusRibbon` 에서 `CompassRibbon` 으로 바꿨다.
//   실측 2026-09-05: 이전 띠는 학습자 라우트 9곳에서 1040×69px(뷰포트 6.2%)를 쓰면서
//   칩 하나(`새 단어 8`)만 그렸고, 9곳의 텍스트가 100% 동일했다 — 어디에 서 있든
//   같은 숫자 하나. 지금은 같은 자리에서 위치·단계·다음 걸음을 말하고,
//   가치·동기·성장은 「나의 자리」를 펴면 나온다(`wayfinder.ts` 머리 주석).

import { GlobalBodyReset } from '@/components/layout/GlobalBodyReset'
import { ScreenViewTracker } from '@/components/layout/ScreenViewTracker'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { MobileUtilityBar } from '@/components/layout/MobileUtilityBar'
import { SessionFrame } from '@/components/layout/SessionFrame'
import { Sidebar } from '@/components/layout/Sidebar'
import { CompassRibbon } from '@/components/layout/CompassRibbon'
import { computeTodayStatus } from '@/lib/learner/today-status'
import { fetchWayfinder } from '@/lib/learner/wayfinder-query'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // 셸 상태 1회 조회 — 내부적으로 fetchGrowthStats·fetchTodayPrescription 을 재사용한다(cache()).
  // 나침반으로 바뀌면서 답하는 질문은 1개 → 6개가 됐지만 **왕복 수는 그대로다**:
  // 예보는 growth-stats 가 이미 읽고 버리던 행에서, V-Level 은 처방이 이미 읽던 컬럼에서,
  // 사정권은 사용자 무관 전역값이라 프로세스 TTL 캐시에서 온다(wayfinder-query 머리 주석).
  const wayfinder = await fetchWayfinder()

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
      {/* 화면 진입 계측(D2) — 화면마다 심지 않고 셸 한 곳에서 경로 변경을 듣는다. */}
      <ScreenViewTracker group="main" />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 레일 밖 유틸리티(Class·Settings)의 모바일 유일 통로 — 사이드바는 `hidden md:flex` 라
            폰에서는 이 줄이 없으면 두 화면으로 가는 길이 아예 없다. 상태 띠 위에 둔다:
            띠 안에 넣으면 ADR 0006 D2(띠는 상태 표면 하나)가 되돌아간다. */}
        <MobileUtilityBar signedIn={wayfinder !== null} />
        <CompassRibbon data={wayfinder} />
        {/* `tabIndex={-1}` 이 있어야 건너뛰기 링크가 실제로 여기에 포커스를 놓는다 —
            없으면 주소만 바뀌고 포커스는 그대로라, 다음 Tab 이 다시 셸로 돌아간다. */}
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          <SessionFrame>{children}</SessionFrame>
        </main>
        {/* 탭 자체는 fixed 이고, 콘텐츠 끝을 가리지 않게 하는 여백은 이 컴포넌트가 같이 낸다.
            여백을 여기 레이아웃에 두면 **탭이 없는 풀스크린 세션에도** 남아 세션 화면이
            뷰포트보다 길어진다(첫 구현이 그랬고 `20-mobile-shell` D 가 잡았다). */}
        {/* 하단 탭의 진행 실(thread)은 "오늘 몇/몇" 하나만 필요하다. 나침반 데이터에서
            그 둘을 뽑되 **접는 규칙은 `computeTodayStatus` 정본을 부른다** — isEmpty 판정을
            여기서 손으로 다시 쓰면 두 곳이 어긋나는 것이 이 셸의 오래된 실패 방식이다. */}
        <MobileTabBar
          status={
            wayfinder
              ? computeTodayStatus({
                  progress: {
                    done: wayfinder.blocks.filter((b) => b.done).length,
                    total: wayfinder.blocks.length,
                  },
                  // `attention` 은 이미 risk+shaky 합이다 — 여기서는 risk 자리에 넣어
                  // 합을 보존한다(shaky 를 0으로 두면 같은 수가 나온다).
                  memory: { risk: wayfinder.counts.attention, shaky: 0, fresh: wayfinder.counts.fresh },
                  streak: wayfinder.past.streak,
                })
              : null
          }
        />
      </div>
    </div>
  )
}
