// apps/web/src/app/(main)/library/scripts/page.tsx
//
// v06.31 — 폐기. /library/books 로 통합 (사용자 명시).
// 북마크/외부 링크 보존을 위해 redirect 유지 (Phase 2 에서 완전 삭제 예정).

import { redirect } from 'next/navigation'

export default function LibraryScriptsRedirect(): never {
  redirect('/library/books')
}
