// apps/web/src/app/(main)/text/page.tsx
//
// My Library — Server Component (metadata + 면 해석 + **서버만 읽을 수 있는 면**의 조립).
// 내 책·본문·구독 세트는 클라이언트가 SWR 로 가져온다(`TextHubContent`).
//
// ⚠️ Textbooks 면만 다르다: 담은 교재는 RLS 가 걸린 서버 조회라 클라이언트가 읽을 수 없고,
//    권의 제목·학령·유형은 `SERIES_SPINE`(서버 패키지)이 소유한다. 그래서 이 면의 **본문은
//    여기서 그려서 노드로 내려보낸다** — 탭줄은 여전히 레지스트리 하나가 소유한다.

import { Screen } from '@/components/ui/ios'
import { MyTextbooks } from '@/components/library/textbooks/MyTextbooks'
import { TextHubContent } from '@/components/textviewer/TextHubContent'
import { MY_LIBRARY_VIEW_PARAM, parseMyLibraryView } from '@/lib/library/tabs'
import { fetchMyTextbooks } from '@/lib/textbook/my-shelf-query'
import { fetchTextbookShelf } from '@/lib/textbook/shelf-query'

export const metadata = {
  title: '내 라이브러리 · Vocaflow',
  description: '내 책 · 본문 · 구독 단어장 · 담은 교재',
}

/**
 * `?view=books|scripts|vocab|textbooks` — 네 면 중 어디로 착지할지. 사이드바 `My Library`
 * 서브메뉴가 이 파라미터로 곧장 들어온다. 값이 없거나 모르는 값이면 화면이 자기 기본 면을 쓴다.
 */
export default async function TextViewerHubPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const raw = searchParams?.[MY_LIBRARY_VIEW_PARAM]
  const view = parseMyLibraryView(Array.isArray(raw) ? raw[0] : raw)

  // 담은 교재는 어느 면에 있든 **탭 뱃지·히어로 지표**로 쓰이므로 항상 읽는다.
  // 서가(계단 정의 + 재고)는 그 목록을 권으로 바꾸는 데 필요하다.
  const [mine, shelf] = await Promise.all([fetchMyTextbooks(), fetchTextbookShelf()])

  return (
    <Screen width="wide" background="bg2" padX="md">
      <TextHubContent
        view={view}
        // 못 읽었을 때 0 을 세지 않는다 — 0 권과 "확인 못 함" 은 다른 말이다(MyTextbooks 가 구별해 말한다).
        textbookCount={mine.available ? mine.steps.length : 0}
        textbooksSlot={<MyTextbooks shelf={shelf} mine={mine} />}
      />
    </Screen>
  )
}
