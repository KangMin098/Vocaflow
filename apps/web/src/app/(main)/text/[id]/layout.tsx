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
import { pickChapterAudio, type ChapterAudio } from '@/lib/workspace/chapter-audio';

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
  /** v06.34 — 사용자 직접 입력 책 그룹 식별자 */
  user_book_group_id: string | null;
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
  chapter_count: number | null;
  librivox_audio: unknown;
  /** v06.53 — 그림책 페이지별 삽화 (StoryWeaver 등). [{idx,url,alt}] */
  illustrations: BookIllustration[] | null;
  /** v06.53 — 단일 스트림 낭독 오디오 (StoryWeaver readalong). */
  audio_url: string | null;
}

/** 그림책 삽화 (library_books.illustrations) — 본문 문단 idx 정합 */
interface BookIllustration {
  idx: number;
  url: string;
  alt?: string;
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
      'id, user_id, title, cefr_level, status, library_book_id, user_book_group_id, chapter_idx, chapter_title, content, paragraph_offsets, sentence_offsets, chapter_word_count',
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
  // v06.x — 현재 챕터의 LibriVox 보이스 (큐레이터가 "챕터 일치" 확인 후 저장한 경우만)
  let chapterAudio: ChapterAudio | null = null;
  // v06.53 — 그림책 페이지별 삽화 (StoryWeaver 등) — 현재 챕터에 노출
  let illustrations: BookIllustration[] | null = null;

  if (text?.library_book_id && text.chapter_idx != null) {
    const [{ data: bookData }, { data: siblingsData }] = await Promise.all([
      client
        .from('library_books')
        .select('id, title, author, cefr_level, chapter_count, librivox_audio, illustrations, audio_url')
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

      // 정합 게이트 통과 시에만 현재 챕터 오디오 노출 (섹션 수 == 도서 챕터 수)
      chapterAudio = pickChapterAudio(
        book.librivox_audio,
        text.chapter_idx,
        book.chapter_count ?? siblings.length,
      );

      // v06.53 — StoryWeaver 등 단일 스트림 낭독: LibriVox 매핑 없을 때 audio_url fallback.
      if (!chapterAudio && typeof book.audio_url === 'string' && /^https?:\/\//.test(book.audio_url)) {
        chapterAudio = {
          url: book.audio_url,
          title: book.title,
          reader: null,
          secs: null,
          librivoxUrl: null,
          consistency: 'solo',
          sectionNumber: text.chapter_idx,
          sectionCount: book.chapter_count ?? siblings.length,
          parts: [{ url: book.audio_url, title: book.title, reader: null, secs: null }],
        };
      }

      // v06.53 — 그림책 삽화: 단일 챕터(그림책 본체) 기준 본문 문단 idx 정합.
      //   삽화 idx 는 책 전체 문단 순서 → 1챕터 그림책에서 챕터 문단과 직접 일치.
      //   (다챕터 책은 ch1 만 정합 — 그림책은 사실상 1챕터라 안전.)
      if (
        Array.isArray(book.illustrations) &&
        book.illustrations.length > 0 &&
        text.chapter_idx === 1
      ) {
        illustrations = book.illustrations as BookIllustration[];
      }
    }
  } else if (text?.user_book_group_id && text.chapter_idx != null) {
    // v06.34 — 사용자 직접 입력 책 그룹: library_books 메타 없음, 형제 chapters 만 fetch.
    //   첫 chapter 의 title/author 를 책 메타로 합성.
    const { data: siblingsData } = await client
      .from('texts')
      .select('id, chapter_idx, chapter_title, status, title, author')
      .eq('user_id', text.user_id)
      .eq('user_book_group_id', text.user_book_group_id)
      .order('chapter_idx', { ascending: true });

    const siblings = (siblingsData ?? []) as Array<
      SiblingRow & { title: string | null; author: string | null }
    >;
    if (siblings.length > 0) {
      const first = siblings[0]!;
      // user book context — library_books 가 없으므로 synthetic book object
      const syntheticBook: BookRow = {
        id: text.user_book_group_id,
        title: first.title ?? '내 책',
        author: first.author,
        cefr_level: text.cefr_level,
        chapter_count: siblings.length,
        librivox_audio: null,
        illustrations: null,
        audio_url: null,
      };
      bookContext = {
        book: syntheticBook,
        chapters: siblings.map((s) => ({
          textId: s.id,
          chapterIdx: s.chapter_idx,
          chapterTitle: s.chapter_title,
          status: s.status as ChapterStatus,
        })),
        currentChapterIdx: text.chapter_idx,
      };
      bookAuthor = first.author;
      // librivox_audio 없음 — chapterAudio NULL (TTS fallback)
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

  // 4.6. v06.34 — 현재 챕터의 단어장 set + 도서의 모든 챕터 단어장 (workspace "단어" pill 진입용)
  //   - currentChapterWordSet: filter=set:{id} 즉시 적용
  //   - allChapterWordSets   : WordVault Browse 의 prev/next chapter 네비
  let currentChapterWordSet: { id: string; title: string } | null = null;
  let allChapterWordSets: Array<{ id: string; chapterIdx: number; title: string }> = [];
  if (text?.library_book_id) {
    const { data: sets } = await client
      .from('shared_word_sets')
      .select('id, title, curation_query')
      .eq('is_published', true)
      .eq('category', 'library_book')
      .eq('curation_query->>book_id', text.library_book_id);
    const rows = (sets ?? []) as Array<{
      id: string;
      title: string;
      curation_query: Record<string, unknown> | null;
    }>;
    allChapterWordSets = rows
      .map((r) => ({
        id: r.id,
        title: r.title,
        chapterIdx: Number(r.curation_query?.chapter_idx ?? 0),
      }))
      .sort((a, b) => a.chapterIdx - b.chapterIdx);
    if (text.chapter_idx != null) {
      const match = allChapterWordSets.find((s) => s.chapterIdx === text.chapter_idx);
      if (match) currentChapterWordSet = { id: match.id, title: match.title };
    }
  }

  // 4.7. v06.51 — direct-script(글) 보이스 + 단어장 (book context 없는 article 파생 텍스트).
  //   texts.source_url = 'article:{uuid}' 마커 → library_articles.audio_url(보이스) + 글 단어장(pill).
  //   책의 librivox chapterAudio / chapter word set 경로에 대응 (글=단일 섹션).
  if (text && !text.library_book_id && !text.user_book_group_id) {
    const { data: srcRow } = await client
      .from('texts')
      .select('source_url')
      .eq('id', text.id)
      .maybeSingle();
    const marker = (srcRow as { source_url: string | null } | null)?.source_url ?? '';
    const m = marker.match(/^article:([0-9a-fA-F-]{36})$/);
    if (m) {
      const articleId = m[1];
      const [{ data: artRow }, { data: setRow }] = await Promise.all([
        client
          .from('library_articles')
          .select('audio_url, title, source_url')
          .eq('id', articleId)
          .maybeSingle(),
        client
          .from('shared_word_sets')
          .select('id, title')
          .eq('is_published', true)
          .eq('category', 'library_article')
          .eq('curation_query->>article_id', articleId)
          .maybeSingle(),
      ]);
      const art = artRow as {
        audio_url: string | null;
        title: string | null;
        source_url: string | null;
      } | null;
      // 보이스: 단일 스트림 ChapterAudio (FloatingAudioPlayer '원어민 성우' 소스로 노출)
      if (art?.audio_url && /^https?:\/\//i.test(art.audio_url)) {
        chapterAudio = {
          url: art.audio_url,
          title: art.title ?? null,
          reader: null,
          secs: null,
          librivoxUrl: art.source_url ?? null,
          consistency: 'solo',
          sectionNumber: 1,
          sectionCount: 1,
          parts: [{ url: art.audio_url, title: art.title ?? null, reader: null, secs: null }],
        };
      }
      // 단어장: 글 단어장 1개 → workspace "단어" pill
      const set = setRow as { id: string; title: string } | null;
      if (set) {
        currentChapterWordSet = { id: set.id, title: set.title };
        allChapterWordSets = [{ id: set.id, chapterIdx: 1, title: set.title }];
        // P5 — 인라인 단어 주석 풀 적용: 발행 단어장 shared_words → chapterWords.
        //   VOA=PD 파생 자유 · preview==publish==workspace 동일 어휘로 본문 enrich.
        const { data: swData } = await client
          .from('shared_words')
          .select('word, meaning_ko, part_of_speech, cefr_level, example_en, source_sentence')
          .eq('set_id', set.id)
          .order('sort_order', { ascending: true });
        chapterWords = (
          (swData ?? []) as Array<{
            word: string;
            meaning_ko: string | null;
            part_of_speech: string | null;
            cefr_level: string | null;
            example_en: string | null;
            source_sentence: string | null;
          }>
        ).map((w) => ({
          word: w.word,
          meaning: w.meaning_ko,
          pos: w.part_of_speech,
          cefrLevel: w.cefr_level,
          vLevel: null,
          exampleSentence: w.source_sentence ?? w.example_en,
          baseLearningValue: 0,
          frequencyInChapter: 0,
        }));
      }
    }
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
      currentChapterWordSet,
      allChapterWordSets,
      chapterAudio,
      illustrations,
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
