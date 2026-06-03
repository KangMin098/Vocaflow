// apps/web/src/app/(main)/text/[id]/text-content-context.tsx
// Phase 11.6 — RSC layout → Client page 본문 데이터 전달용 context
//
// 헬퍼/타입은 text-content-helpers.ts (server/client 공용) 에서 export.
// 본 파일은 'use client' Provider + hook 만 정의.

'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { LibraryText } from '@/types/library';
import type { TextParagraph } from './text-content-helpers';

export type {
  TextParagraph,
  TextParagraphPart,
  TextParagraphSentence,
} from './text-content-helpers';

export interface ChapterNavItem {
  textId: string;
  chapterIdx: number;
  chapterTitle: string | null;
  status: string;
}

export interface BookInfo {
  /** library_books.id — breadcrumb /my/books/<id> 링크용 */
  id: string;
  title: string;
  author: string | null;
  cefrLevel: string | null;
}

export interface TextContentData {
  /** texts.id — Phase 11.7 WordVault 추가 시 provenance */
  textId: string;
  /** Phase 11.9 — WordBlitz 등 game mode가 chapter 단어 풀 fetch 시 사용 */
  libraryBookId: string | null;
  chapterIdx: number | null;
  /** Phase 11.15.2 — 하단 chapter nav용 같은 책의 chapter list */
  chapters: ChapterNavItem[];
  /** Phase 11.16 — UnifiedHeader 책 breadcrumb 표시용 (library book만) */
  book: BookInfo | null;
  /** Phase 11.16 — CompleteChapterButton currentStatus prop */
  currentChapterStatus: string;
  /** v06.30 — workspace UnifiedHeader 챕터 단어장 구독 chip (library_book only) */
  bookWordSetStats: { subscribed: number; total: number } | null;
  text: Partial<LibraryText>;
  paragraphs: TextParagraph[];
}

const TextContentContext = createContext<TextContentData | null>(null);

export function TextContentProvider({
  value,
  children,
}: {
  value: TextContentData;
  children: ReactNode;
}) {
  return (
    <TextContentContext.Provider value={value}>{children}</TextContentContext.Provider>
  );
}

/** Provider 부재 시 null. page.tsx에서 fallback과 함께 사용. */
export function useTextContentSafe(): TextContentData | null {
  return useContext(TextContentContext);
}
