// apps/web/src/app/(main)/library/textbooks/[series]/page.tsx
//
// **한 시리즈의 서가** — 서점의 코너.
//
// ── 왜 이 주소가 생겼나 (2026-09-12) ────────────────────────────────
// 시리즈 셋(독해·어휘·구문)이 정의되고 권의 주소에 시리즈가 들어갔는데
// (`/library/textbooks/[series]/[step]`) **코너로 가는 주소가 없었다.** 주소를 직접 타야
// 어휘 권에 닿을 수 있었고, 그건 찾을 수 없다는 뜻이다.
//
// 옛 주소(`/library/textbooks`)는 **그대로 독해 서가로 둔다** — 공개 표면이고 색인 대상이라
// (`sitemap`) 리다이렉트로 바꾸면 색인이 옮겨지고 랜딩에서 오는 링크가 한 번 더 돈다.
// 화면은 `ShelfScreen` 하나라 두 주소가 같은 것을 그린다.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SERIES_CATALOG } from '@vocaflow/library-pipeline/textbook-series-catalog'

import { ShelfScreen, buildLevelChart } from '@/components/library/textbooks/ShelfScreen'
import { fetchMyTextbooks } from '@/lib/textbook/my-shelf-query'
import { fetchTextbookShelf } from '@/lib/textbook/shelf-query'

/** 카탈로그에 있는 시리즈만 정적으로 준비한다 — 나머지는 404 다. */
export function generateStaticParams() {
  return SERIES_CATALOG.map((s) => ({ series: s.id }))
}

export async function generateMetadata({
  params,
}: {
  params: { series: string }
}): Promise<Metadata> {
  const def = SERIES_CATALOG.find((s) => s.id === params.series)
  if (!def) return { title: '찾을 수 없는 교재 서가' }
  return {
    // 레이아웃이 ' | Vocaflow' 를 붙인다 — 여기서 또 붙이면 두 번 나온다.
    // ⚠️ 시리즈마다 **다른 제목**이어야 한다. 셋이 같으면 탭·북마크·검색 결과에서 구별되지 않는다.
    title: `${def.brand} — 학년을 잇는 영어 교재 시리즈`,
    // 물음은 카탈로그가 소유한다 — 화면이 짓지 않는다.
    description: `${def.question} 초등·중등·고등 매대에서 학령·수준·유형으로 골라 담으세요.`,
  }
}

export default async function SeriesShelfPage({ params }: { params: { series: string } }) {
  // ⚠️ **카탈로그에 없는 시리즈는 404 다.** 조용히 독해를 그리면 「어휘 서가를 열었는데
  //   독해가 보인다」가 된다 — 조판기·매대·권 상세에서 같은 모양의 사고를 고쳤다.
  if (!SERIES_CATALOG.some((s) => s.id === params.series)) notFound()

  const [shelf, mine] = await Promise.all([
    fetchTextbookShelf(params.series),
    // 담김도 **그 시리즈의 것만** 읽는다 — 표의 키가 (사용자, 시리즈, 단) 이다.
    fetchMyTextbooks(params.series),
  ])

  return <ShelfScreen shelf={shelf} mine={mine} chart={buildLevelChart(shelf.volumes)} />
}
