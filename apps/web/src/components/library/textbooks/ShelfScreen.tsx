// apps/web/src/components/library/textbooks/ShelfScreen.tsx
//
// **한 시리즈의 서가 화면** — 두 주소가 같은 것을 그린다.
//
// ── 왜 컴포넌트로 뺐나 (2026-09-12) ─────────────────────────────────
// 시리즈가 자기 주소를 갖게 되면서(`/library/textbooks/[series]`) 서가를 그리는 자리가
// **둘**이 됐다: 옛 주소(`/library/textbooks` = 독해, 공개 표면이자 색인 대상이라 그대로 둔다)와
// 시리즈 주소. 같은 화면을 두 파일에 적으면 한쪽만 고쳐질 때 **같은 서가가 두 모습으로 산다** —
// 이 저장소가 반복해서 겪은 드리프트다(조판기 vs 서지의 브랜드가 바로 그랬다).
//
// 그래서 화면은 여기 하나뿐이고, 두 라우트는 **시리즈 id 만 다르게** 넘긴다.

import { LevelChart } from '@/components/library/textbooks/LevelChart'
import { SeriesTabs } from '@/components/library/textbooks/SeriesTabs'
import { TextbookShelf } from '@/components/library/textbooks/TextbookShelf'
import { Screen } from '@/components/ui/ios'
import { ComponentVideo } from '@/components/video/ComponentVideo'
import { seriesVideo } from '@/lib/video/catalog'
import type { MySelection } from '@/lib/textbook/my-shelf-query'
import type { Shelf } from '@/lib/textbook/shelf'
import { buildLevelChart } from '@vocaflow/library-pipeline'

export function ShelfScreen({
  shelf,
  mine,
  chart,
}: {
  shelf: Shelf
  mine: MySelection
  /** 레벨 차트는 **서버에서** 만든다 — 시장 규격이 클라이언트로 갈 이유가 없다. */
  chart: ReturnType<typeof buildLevelChart>
}) {
  return (
    <Screen width="wide" background="bg2" padX="md">
      {/* ⚠️ 이 화면에는 **보이는 제목이 없다** — Calm UI 라 그렇게 설계했다.
          그래도 이름은 있어야 한다: h1 이 없으면 스크린리더로 "여기가 어디" 를 물을 방법이 없다
          (실측 2026-08-23: 학습자 화면 3곳이 그랬다).
          시리즈가 셋이 됐으므로 **어느 서가인지**를 이름에 넣는다 — 「교재 서가」 셋이 같은
          이름을 가지면 탭·북마크·스크린리더에서 구별되지 않는다. */}
      <h1 className="sr-only">{shelf.brand} 교재 서가</h1>
      <div className="flex flex-col gap-4 py-6 md:py-8">
        {/* 코너 표지판이 매대보다 **먼저** 온다 — 어느 서가인지 모르고 권을 고를 수는 없다. */}
        <SeriesTabs current={shelf.seriesId} />

        {/*
          이 코너가 **무엇을 파는 곳인지** 12초로 답하는 영상.

          작게 둔 이유: 매대(책)가 이 화면의 증명이고 영상은 보조다. 히어로로 키우면
          "말하는 것" 이 "보이는 것" 을 밀어낸다(§3 증명 먼저).
          아직 발행 전이면 `ComponentVideo` 가 **아무것도 그리지 않는다** — 빈 자리를 두지 않는다.
        */}
        <ComponentVideo video={seriesVideo(shelf.seriesId)} maxWidth={420} />

        <TextbookShelf
          shelf={shelf}
          picked={mine.steps}
          canPick={mine.available}
          signedIn={mine.signedIn}
        />

        {/* Progressive Disclosure — 레벨 차트는 고르다가 막혔을 때 펼치는 것이지
            매대보다 먼저 나올 것이 아니다. 닫혀 있어도 DOM 에는 있어 검색·스크린리더가 찾는다. */}
        <details className="group rounded-ios-2xl bg-[var(--bg)] px-5 py-4 shadow-ios-2 md:px-8">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 font-display text-[13px] font-[700] text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden
              className="inline-block motion-safe:transition-transform group-open:rotate-90"
            >
              ›
            </span>
            교재 레벨 차트 — 내 학년은 몇 계단일까요?
          </summary>
          <div className="pt-3">
            <LevelChart chart={chart} />
          </div>
        </details>
      </div>
    </Screen>
  )
}

/** 차트 계산을 화면과 같은 파일에서 내보낸다 — 라우트가 둘이라 각자 부르면 갈릴 수 있다. */
export { buildLevelChart }
