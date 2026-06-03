// apps/web/src/app/(main)/text/[id]/layout.tsx
// IA G1+G2 + Phase 11.6 — Workspace RSC wrapper
//
// 비침투 패턴: 기존 page.tsx (468 lines, 'use client', mock data) 변경 0.
// layout.tsx가 RSC로 실 데이터 fetch + status 자동 변경 + BookContext 띠 주입
// + TextContentProvider로 본문 데이터 client에 전달 (Phase 11.6).

import type { ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { markChapterStarted } from '@/lib/library/mark-progress';
import { activateChapterLearning } from '@/lib/library/activate-chapter';
import type {
  BookContextChapter,
  ChapterStatus,
} from '@/components/workspace/WorkspaceBookContext';
import type { CEFRLevel, LibraryText } from '@/types/library';
import { TextContentProvider, type TextContentData } from './text-content-context';
import { buildParagraphsFromContent } from './text-content-helpers';
import {
  getChapterWords,
  type ChapterWord,
} from '@/lib/library/chapter-words-queries';
import { fetchBookWordSetSubscriptionStats } from '@/lib/library/books/queries';

interface LayoutProps {
  children: ReactNode;
  params: { id: string };
}

interface TextContentRow {
  id: string;
  user_id: string;
  title: string | null;
  cefr_level: string | null;
  status: string | null;
  library_book_id: string | null;
  chapter_idx: number | null;
  chapter_title: string | null;
  content: string | null;
  paragraph_offsets: number[] | null;
  sentence_offsets: number[] | null;
  chapter_word_count: number | null;
}

interface BookRow {
  id: string;
  title: string;
  author: string | null;
  cefr_level: string | null;
}

interface SiblingRow {
  id: string;
  chapter_idx: number;
  chapter_title: string | null;
  status: string;
}

const VALID_CEFR: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function toCefrLevel(value: string | null): CEFRLevel | undefined {
  return value && (VALID_CEFR as string[]).includes(value)
    ? (value as CEFRLevel)
    : undefined;
}

export default async function TextWorkspaceLayout({ children, params }: LayoutProps) {
  const client = (await createClient()) as unknown as SupabaseClient;

  // 1. v_text_content view — 메타 + 본문 + offsets 한 번에 fetch
  const { data: textData } = await client
    .from('v_text_content')
    .select(
      'id, user_id, title, cefr_level, status, library_book_id, chapter_idx, chapter_title, content, paragraph_offsets, sentence_offsets, chapter_word_count',
    )
    .eq('id', params.id)
    .maybeSingle();

  const text = textData as TextContentRow | null;

  // 2. G2 — status 자동 변경 (멱등)
  if (text) {
    await markChapterStarted(text.id);
  }

  // 2-B. Phase 2A — library chapter 진입 시 학습 활성화 (멱등)
  //      personalizeChapter (reading_sessions) + adaptiveExtractWords (vocabularies)
  //      VRL v3 user current_v_level 기반 i+1 zone 단어 부각.
  if (
    text?.library_book_id &&
    text.chapter_idx != null &&
    text.chapter_word_count != null
  ) {
    await activateChapterLearning(client, {
      userId: text.user_id,
      textId: text.id,
      libraryBookId: text.library_book_id,
      chapterIdx: text.chapter_idx,
      chapterWordCount: text.chapter_word_count,
    });
  }

  // 3. G1 — library_book_id 있을 때만 BookContext fetch
  let bookContext: {
    book: BookRow;
    chapters: BookContextChapter[];
    currentChapterIdx: number;
  } | null = null;

  let bookAuthor: string | null = null;

  if (text?.library_book_id && text.chapter_idx != null) {
    const [{ data: bookData }, { data: siblingsData }] = await Promise.all([
      client
        .from('library_books')
        .select('id, title, author, cefr_level')
        .eq('id', text.library_book_id)
        .maybeSingle(),
      client
        .from('texts')
        .select('id, chapter_idx, chapter_title, status')
        .eq('user_id', text.user_id)
        .eq('library_book_id', text.library_book_id)
        .order('chapter_idx', { ascending: true }),
    ]);

    const book = bookData as BookRow | null;
    const siblings = (siblingsData ?? []) as SiblingRow[];

    if (book && siblings.length > 0) {
      bookContext = {
        book,
        chapters: siblings.map((s) => ({
          textId: s.id,
          chapterIdx: s.chapter_idx,
          chapterTitle: s.chapter_title,
          status: s.status as ChapterStatus,
        })),
        currentChapterIdx: text.chapter_idx,
      };
      bookAuthor = book.author;
    }
  }

  // 4. Phase 11.7 — chapter words fetch (library_book chapter만)
  let chapterWords: ChapterWord[] = [];
  if (text?.library_book_id && text.chapter_idx != null) {
    chapterWords = await getChapterWords(client, text.library_book_id, text.chapter_idx, 30);
  }

  // 4.5. v06.30 — workspace UnifiedHeader 챕터 단어장 구독 통계 (library_book only)
  let bookWordSetStats: { subscribed: number; total: number } | null = null;
  if (text?.library_book_id) {
    bookWordSetStats = await fetchBookWordSetSubscriptionStats(
      client as unknown as Parameters<typeof fetchBookWordSetSubscriptionStats>[0],
      text.library_book_id,
      text.user_id,
    );
  }

  // 5. Phase 11.6 + 11.7 — TextContentProvider 데이터 정합
  let textContentValue: TextContentData | null = null;

  if (text) {
    const content = text.content ?? '';
    const paragraphOffsets = text.paragraph_offsets ?? [];

    const displayTitle = text.chapter_title ?? text.title ?? '';
    const cefr = toCefrLevel(text.cefr_level ?? bookContext?.book.cefr_level ?? null);

    const partial: Partial<LibraryText> = {
      title: displayTitle,
      ...(bookAuthor ? { author: bookAuthor } : {}),
      ...(cefr ? { cefrLevel: cefr } : {}),
      wordCount: text.chapter_word_count ?? 0,
      totalPages: 1,
    };

    textContentValue = {
      textId: text.id,
      libraryBookId: text.library_book_id,
      chapterIdx: text.chapter_idx,
      chapters: bookContext?.chapters.map((c) => ({
        textId: c.textId,
        chapterIdx: c.chapterIdx,
        chapterTitle: c.chapterTitle,
        status: c.status,
      })) ?? [],
      book: bookContext
        ? {
            id: bookContext.book.id,
            title: bookContext.book.title,
            author: bookContext.book.author,
            cefrLevel: bookContext.book.cefr_level,
          }
        : null,
      currentChapterStatus: text.status ?? 'not_started',
      bookWordSetStats,
      text: partial,
      paragraphs: buildParagraphsFromContent(content, paragraphOffsets, chapterWords),
    };
  }

  // Phase 11.16 — WorkspaceBookContext 호출 제거. UnifiedHeader가 page.tsx에서
  // TextContentProvider 데이터 + 페이지 인터랙티브 state를 합쳐 단일 sticky header로 렌더.
  const body = <>{children}</>;

  return textContentValue ? (
    <TextContentProvider value={textContentValue}>{body}</TextContentProvider>
  ) : (
    body
  );
}
