// apps/web/src/app/(main)/library/page.tsx
//
// /library 진입 시 /library/scripts 로 자동 리다이렉트.

import { redirect } from 'next/navigation'

export default function LibraryIndexPage(): never {
  redirect('/library/scripts')
}
