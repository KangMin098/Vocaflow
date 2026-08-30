// apps/web/src/app/(main)/library/textbooks/page.tsx
//
// 공용 서가 — **교재(Textbooks)** 면.
//
// 왜 `/library` 아래인가: 이 면이 파는 것은 "내가 넣은 것" 이 아니라 **우리가 발행한 것**이다.
// My Library(`/text?view=`)는 내 것을 관리하는 곳이고, 여기는 고르는 곳이다.
// 서가는 비로그인에도 열려 있다(발견·SEO — apps/web/CLAUDE.md 공개 표면 표).
//
// 데이터는 실측 재고에서 나온다 — 목업이 없다. 재고가 비면 그 계단은 '근간 예정' 으로
// 정직하게 표시된다(`shelf.ts` 의 status 판정).

import { buildLevelChart } from '@vocaflow/library-pipeline'

import { Screen } from '@/components/ui/ios'
import { LevelChart } from '@/components/library/textbooks/LevelChart'
import { TextbookShelf } from '@/components/library/textbooks/TextbookShelf'
import { fetchMyTextbooks } from '@/lib/textbook/my-shelf-query'
import { fetchTextbookShelf } from '@/lib/textbook/shelf-query'

export const metadata = {
  // 레이아웃이 ' | Vocaflow' 를 붙인다 — 여기서 또 붙이면 두 번 나온다(실측).
  title: '영어 독해 교재 — 초등·중등·고등',
  description:
    '학년을 잇는 독해 교재 시리즈. 초등·중등·고등 매대에서 학령·수준·유형으로 골라 담으세요.',
}

export default async function TextbooksPage() {
  const [shelf, mine] = await Promise.all([fetchTextbookShelf(), fetchMyTextbooks()])

  // 레벨 차트는 **서버에서** 만든다 — 시장 규격(market-spec.json)이 클라이언트로 갈 이유가 없다.
  const chart = buildLevelChart(shelf.volumes)

  return (
    <Screen width="wide" background="bg2" padX="md">
      {/* ⚠️ 이 화면에는 **보이는 제목이 없다** — Calm UI 라 그렇게 설계했다.
          그래도 이름은 있어야 한다: h1 이 없으면 스크린리더로 "여기가 어디" 를 물을 방법이 없다
          (실측 2026-08-23: 학습자 화면 3곳이 그랬다).
          보이는 디자인은 그대로 두고 **프로그램에만** 이름을 붙인다. */}
      <h1 className="sr-only">교재 서가</h1>
      <div className="flex flex-col gap-4 py-6 md:py-8">
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
