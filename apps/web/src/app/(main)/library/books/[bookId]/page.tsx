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
      'id, title, author, cefr_level, word_count, chapter_count, reading_minutes',
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

  const b = book as {
    id: string;
    title: string;
    author: string | null;
    cefr_level: string | null;
    word_count: number | null;
    chapter_count: number | null;
    reading_minutes: number | null;
  };

  const chapters = await listChapters(client, b.id);

  return (
    <div className="flex flex-col gap-4">
      <UserPreviewClient
        bookId={b.id}
        title={b.title}
        author={b.author}
        cefrLevel={b.cefr_level}
        totalWordCount={b.word_count ?? 0}
        readingMinutes={b.reading_minutes ?? 0}
        chapters={chapters}
      />
    </div>
  );
}
