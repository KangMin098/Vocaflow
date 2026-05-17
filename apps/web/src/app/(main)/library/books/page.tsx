// apps/web/src/app/(main)/library/books/page.tsx
// LCP v2.0 Phase 11 — 사용자 라이브러리 도서 목록 (큐레이션된 PD 책)

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { LibraryGrid, type PublishedBook } from '@/components/library/LibraryGrid';

export const metadata = {
  title: '도서 — Vocaflow Library',
  description: '큐레이션된 영어 학습 자료',
};

export const revalidate = 60;

export default async function LibraryBooksPage() {
  const client = (await createClient()) as unknown as SupabaseClient;

  const { data, error } = await client
    .from('library_books')
    .select(
      'id, title, author, cefr_level, word_count, chapter_count, reading_minutes',
    )
    .eq('status', 'published')
    .eq('copyright_safe_in_kr', true)
    .order('published_at', { ascending: false });

  const books: PublishedBook[] = error
    ? []
    : ((data ?? []) as unknown as PublishedBook[]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[22px] font-[700] text-[var(--t1)]">
          📚 도서
        </h1>
        <p className="font-body text-[13px] text-[var(--t3)]">
          큐레이션된 PD 도서로 자유롭게 학습을 시작하세요.
          {books.length > 0 && (
            <span className="ml-2 font-mono text-[12px] text-[var(--t5)]">
              {books.length}권
            </span>
          )}
        </p>
      </header>

      <LibraryGrid books={books} />
    </div>
  );
}
