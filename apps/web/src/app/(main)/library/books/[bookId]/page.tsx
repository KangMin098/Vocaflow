// apps/web/src/app/(main)/library/books/[bookId]/page.tsx
// LCP v2.0 Phase 11 — 사용자 책 미리보기

import { notFound, redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { listChapters } from '@/lib/library/reader-queries';
import { getResumeTarget } from '@/lib/library/resume-queries';
import { fetchBookChapterSets } from '@/lib/library/books/queries';
import { fetchUserSubscriptions } from '@/lib/library/vocab/queries';
import type { ChapterSet } from '@/components/library/books/BookDetailClient';
import { UserPreviewClient } from './UserPreviewClient';

interface PageProps {
  params: { bookId: string };
  searchParams: { preview?: string };
}

export default async function LibraryBookPreviewPage({
  params,
  searchParams,
}: PageProps) {
  const client = (await createClient()) as unknown as SupabaseClient;

  const { data: book } = await client
    .from('library_books')
    .select(
      'id, title, author, cefr_level, cefr_band, book_v_level, ' +
        'v_level_centroid_precise, cefrj_level, cefrj_confidence, ' +
        'flesch_kincaid_grade, flesch_reading_ease, ' +
        'word_count, chapter_count, reading_minutes, vrl_components',
    )
    .eq('id', params.bookId)
    .eq('status', 'published')
    .eq('copyright_safe_in_kr', true)
    .maybeSingle();

  if (!book) notFound();

  // enroll한 사용자는 학습 재개 대상(/text)으로 직접 redirect (미리보기 우회).
  // getResumeTarget 이 null → 미enroll 과 동치이므로 별도 enrollment 쿼리 불필요.
  // (이전: /my/books/[bookId] 재개 라우트를 한 번 더 거쳐 이중 redirect + texts 중복 조회)
  // v06.34 — ?preview=1 escape hatch: workspace "단어" pill → 도서 단어장 페이지
  //   직접 진입 의도 명시 (학습 재개 우회 차단)
  const {
    data: { user },
  } = await client.auth.getUser();
  const skipEnrollRedirect = searchParams?.preview === '1';
  if (user && !skipEnrollRedirect) {
    const target = await getResumeTarget(client, user.id, params.bookId);
    if (target) {
      redirect(`/text/${target.textId}?mode=read`);
    }
  }

  const b = book as unknown as {
    id: string;
    title: string;
    author: string | null;
    cefr_level: string | null;
    cefr_band: string | null;
    book_v_level: number | null;
    v_level_centroid_precise: string | null;
    cefrj_level: string | null;
    cefrj_confidence: string | null;
    flesch_kincaid_grade: string | null;
    flesch_reading_ease: string | null;
    word_count: number | null;
    chapter_count: number | null;
    reading_minutes: number | null;
    vrl_components: Record<string, unknown> | null;
  };

  const [chapters, chapterSets, subscribedSet] = await Promise.all([
    listChapters(client, b.id),
    fetchBookChapterSets(
      client as unknown as Parameters<typeof fetchBookChapterSets>[0],
      b.id,
    ) as Promise<ChapterSet[]>,
    fetchUserSubscriptions(
      client as unknown as Parameters<typeof fetchUserSubscriptions>[0],
      user?.id ?? null,
    ),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <UserPreviewClient
        bookId={b.id}
        title={b.title}
        author={b.author}
        cefrLevel={b.cefr_level}
        cefrBand={b.cefr_band}
        bookVLevel={b.book_v_level}
        vLevelCentroid={b.v_level_centroid_precise}
        cefrjLevel={b.cefrj_level}
        cefrjConfidence={b.cefrj_confidence}
        fleschKincaidGrade={b.flesch_kincaid_grade}
        fleschReadingEase={b.flesch_reading_ease}
        lemmaCoveragePct={
          typeof b.vrl_components?.lemma_coverage_pct === 'number'
            ? b.vrl_components.lemma_coverage_pct
            : null
        }
        totalWordCount={b.word_count ?? 0}
        readingMinutes={b.reading_minutes ?? 0}
        chapters={chapters}
        chapterSets={chapterSets}
        subscribedIds={Array.from(subscribedSet)}
        isLoggedIn={!!user}
      />
    </div>
  );
}
