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

import { AreaHero } from '@/components/layout/AreaHero'
import { LevelChart } from '@/components/library/textbooks/LevelChart'
import { SeriesTabs } from '@/components/library/textbooks/SeriesTabs'
import { MATERIAL_TONE } from '@/lib/design/tone'
import { TextbookShelf } from '@/components/library/textbooks/TextbookShelf'
import { Screen } from '@/components/ui/ios'
import { ComponentVideo } from '@/components/video/ComponentVideo'
import { seriesVideo } from '@/lib/video/catalog'
import type { MySelection } from '@/lib/textbook/my-shelf-query'
import type { Shelf } from '@/lib/textbook/shelf'
import { buildLevelChart } from '@vocaflow/library-pipeline'
import { SERIES_CATALOG } from '@vocaflow/library-pipeline/textbook-series-catalog'

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
      <div className="flex flex-col gap-4 py-6 md:py-8">
        {/* 이름은 **보여야 한다.** 2026-08-23 에는 sr-only h1 하나였다(Calm UI) — 스크린리더는
            "여기가 어디" 를 알 수 있었지만 눈으로 보는 학습자는 못 알아봤고, 이웃 서가(도서 ·
            기사)가 전부 이름 붙은 판을 갖게 되면서 교재만 이름 없는 화면으로 남았다.
            판 제목이 곧 h1 이다 — 시리즈 이름이 들어가 탭·북마크·스크린리더에서 서가 셋이 구별된다.
            DD-68 · tines-mapping §24. */}
        <AreaHero
          kicker="서가 · 교재"
          title={`${shelf.brand} 교재 서가`}
          sub={SERIES_CATALOG.find((s) => s.id === shelf.seriesId)?.question ?? '학년을 잇는 단계별 교재 서가.'}
          tile="tile-textbooks"
          tint={MATERIAL_TONE.textbook.tint}
          stats={
            shelf.volumes.length > 0
              ? [
                  { label: '권', value: `${shelf.volumes.length}` },
                  { label: '펼칠 수 있는 권', value: `${shelf.readyCount}` },
                ]
              : undefined
          }
        />
        {/* 코너 표지판이 매대보다 **먼저** 온다 — 어느 서가인지 모르고 권을 고를 수는 없다.
            시리즈마다 답하는 물음과 조판 여부가 붙으므로 판 아랫변 탭으로 접지 않는다. */}
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
