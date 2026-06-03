// apps/web/src/app/(main)/library/page.tsx
//
// /library 진입 시 첫 탭(도서) 로 자동 리다이렉트 — LibraryTabs 순서 정합.

import { redirect } from 'next/navigation'

export default function LibraryIndexPage(): never {
  redirect('/library/books')
}
