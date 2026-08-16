// apps/web/src/app/(main)/text/page.tsx
//
// TextViewer 허브 — Server Component (metadata + 정적 wrapper)
// 실 데이터 페치는 TextHubContent (Client Component) 에 위임

import { Screen } from '@/components/ui/ios'
import { TextHubContent } from '@/components/textviewer/TextHubContent'
import { MY_LIBRARY_VIEW_PARAM, parseMyLibraryView } from '@/lib/library/tabs'

export const metadata = {
  title: '내 라이브러리 · Vocaflow',
  description: '내 책 · 본문 · 구독 단어장',
}

/**
 * `?view=books|scripts|vocab` — 세 면 중 어디로 착지할지. 사이드바 `My Library` 서브메뉴가
 * 이 파라미터로 곧장 들어온다. 값이 없거나 모르는 값이면 화면이 자기 기본 면(가장 많은 곳)을 쓴다.
 */
export default function TextViewerHubPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const raw = searchParams?.[MY_LIBRARY_VIEW_PARAM]
  const view = parseMyLibraryView(Array.isArray(raw) ? raw[0] : raw)

  return (
    <Screen width="wide" background="bg2" padX="md">
      <TextHubContent view={view} />
    </Screen>
  )
}
