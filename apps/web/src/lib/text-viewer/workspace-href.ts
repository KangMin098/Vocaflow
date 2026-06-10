// apps/web/src/lib/text-viewer/workspace-href.ts
//
// LibraryText → 워크스페이스 진입 href 단일 출처.
//
// ⚠️ 도서 단위 카드(aggregateBookChapters)는 id = library_book_id 다.
//    그대로 /text/[id] 로 보내면 워크스페이스 layout 이 v_text_content 를
//    texts.id 로 조회 → null → 페이지가 MOCK 'The Great Gatsby' 로 fallback 한다.
//    → resume 챕터의 texts.id(nextTextId)로 직진하고, 없으면(이론상 unreachable)
//      /my/books/[bookId] 서버 resume 라우트로 우회.
//    직접 스크립트/파일(bookId null)은 id 가 곧 texts.id.

import type { LibraryText } from '@/types/library'

export function workspaceHref(t: LibraryText): string {
  if (t.bookId) {
    return t.nextTextId
      ? `/text/${t.nextTextId}?mode=read`
      : `/my/books/${t.bookId}`
  }
  // v06.34 — 사용자 직접 입력 책 (user_book_group_id) — resume 챕터로 직진.
  // nextTextId 가 항상 채워져 있어야 정상 (aggregateUserBookChapters 가 설정).
  if (t.userBookGroupId && t.nextTextId) {
    return `/text/${t.nextTextId}?mode=read`
  }
  return `/text/${t.id}?mode=read`
}
