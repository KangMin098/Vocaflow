// apps/web/src/app/(main)/library/books/[bookId]/page.tsx
// LCP v2.0 Phase 11 — 사용자 책 미리보기

import { notFound, redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { listChapters } from '@/lib/library/reader-queries';
import { isBookEnrolled } from '@/lib/library/resume-queries';
import { UserPreviewClient } from './UserPreviewClient';

interface PageProps {
  params: { bookId: string };
}

export default async function LibraryBookPreviewPage({ params }: PageProps) {
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

  // enroll한 사용자는 학습 재개 라우트로 자동 redirect (미리보기 우회)
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user) {
    const enrolled = await isBookEnrolled(client, user.id, params.bookId);
    if (enrolled) {
      redirect(`/my/books/${params.bookId}`);
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

  const chapters = await listChapters(client, b.id);

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
      />
    </div>
  );
}
