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

import { Screen } from '@/components/ui/ios'
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
      </div>
    </Screen>
  )
}
