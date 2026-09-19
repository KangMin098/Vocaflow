// apps/web/src/app/(main)/library/textbooks/page.tsx
//
// 공용 서가 — **교재(Textbooks)** 면. 이 주소는 **독해 코너**다.
//
// 왜 `/library` 아래인가: 이 면이 파는 것은 "내가 넣은 것" 이 아니라 **우리가 발행한 것**이다.
// My Library(`/text?view=`)는 내 것을 관리하는 곳이고, 여기는 고르는 곳이다.
// 서가는 비로그인에도 열려 있다(발견·SEO — apps/web/CLAUDE.md 공개 표면 표).
//
// 데이터는 실측 재고에서 나온다 — 목업이 없다. 재고가 비면 그 계단은 '근간 예정' 으로
// 정직하게 표시된다(`shelf.ts` 의 status 판정).
//
// ── 왜 시리즈 주소가 따로 있는데 이 주소를 남기나 (2026-09-12) ──────
// 시리즈가 셋이 되면서 코너마다 주소를 줬다(`/library/textbooks/[series]`). 이 주소를
// `reading` 으로 리다이렉트하는 편이 깔끔해 보이지만 **그러지 않는다**:
//   · 이 주소는 **공개 표면이자 색인 대상**이다(`sitemap`). 리다이렉트로 바꾸면 색인이 옮겨진다.
//   · 랜딩·`/text`·도움말이 이 주소를 가리킨다 — 한 번 더 도는 링크가 된다.
// 화면은 `ShelfScreen` **하나뿐**이라 두 주소가 같은 것을 그린다(드리프트가 생길 자리가 없다).

import { ShelfScreen, buildLevelChart } from '@/components/library/textbooks/ShelfScreen'
import { fetchMyTextbooks } from '@/lib/textbook/my-shelf-query'
import { fetchTextbookShelf } from '@/lib/textbook/shelf-query'

export const metadata = {
  // 레이아웃이 ' | Vocaflow' 를 붙인다 — 여기서 또 붙이면 두 번 나온다(실측).
  title: '영어 독해 교재 — 초등·중등·고등',
  description:
    '학년을 잇는 독해 교재 시리즈. 초등·중등·고등 매대에서 학령·수준·유형으로 골라 담으세요.',
}

export default async function TextbooksPage() {
  // 인자 없이 부르면 독해다(`fetchTextbookShelf` 의 기본값) — 이 주소가 뜻하는 그 코너다.
  const [shelf, mine] = await Promise.all([fetchTextbookShelf(), fetchMyTextbooks()])

  return <ShelfScreen shelf={shelf} mine={mine} chart={buildLevelChart(shelf.volumes)} />
}
