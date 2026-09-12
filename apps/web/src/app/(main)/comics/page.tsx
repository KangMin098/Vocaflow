// apps/web/src/app/(main)/comics/page.tsx
//
// /comics 진입 시 첫 탭(Adapted — 도서 각색 만화) 으로 자동 리다이렉트 — ComicsTabs 순서 정합.
// /library 와 동일한 패턴(진입 라우트는 리다이렉트, 실제 화면은 탭 하위).

import { redirect } from 'next/navigation'

export default function ComicsIndexPage(): never {
  redirect('/comics/adapted')
}
