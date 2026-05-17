// apps/web/src/app/(main)/my/books/page.tsx
// IA Refactor v06.26 — BookVault (enroll한 LCP 도서)

import { Suspense } from 'react';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'BookVault — Vocaflow',
  description: 'Library에서 추가한 책',
};

export const revalidate = 60;

export default function MyBooksPage() {
  return (
    <main className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-[20px] font-[700] text-[var(--t1)]">
          📦 BookVault
        </h2>
        <p className="font-body text-[13px] text-[var(--t3)]">
          Library에서 내 학습에 추가한 책
        </p>
      </header>
      <Suspense fallback={<Loading />}>
        <BookList />
      </Suspense>
    </main>
  );
}

interface EnrolledBookRow {
  library_book_id: string;
  status: string;
  library_books: {
    id: string;
    title: string;
    author: string | null;
    cefr_level: string | null;
    chapter_count: number | null;
    word_count: number | null;
  };
}

interface BookSummary {
  id: string;
  title: string;
  author: string | null;
  cefr_level: string | null;
  chapter_count: number;
  word_count: number;
  enrolled_chapters: number;
  completed_chapters: number;
  in_progress_chapters: number;
}

async function BookList() {
  const client = (await createClient()) as unknown as SupabaseClient;

  const { data, error } = await client
    .from('texts')
    .select(
      `
      library_book_id,
      status,
      library_books!inner (
        id, title, author, cefr_level, chapter_count, word_count
      )
    `,
    )
    .not('library_book_id', 'is', null)
    .order('updated_at', { ascending: false });

  if (error || !data) {
    return <Empty message="책 정보를 불러올 수 없습니다" />;
  }

  const bookMap = new Map<string, BookSummary>();

  for (const row of data as unknown as EnrolledBookRow[]) {
    const lbId = row.library_book_id;
    const lb = row.library_books;
    if (!lbId || !lb) continue;
    if (!bookMap.has(lbId)) {
      bookMap.set(lbId, {
        id: lb.id,
        title: lb.title,
        author: lb.author,
        cefr_level: lb.cefr_level,
        chapter_count: lb.chapter_count ?? 0,
        word_count: lb.word_count ?? 0,
        enrolled_chapters: 0,
        completed_chapters: 0,
        in_progress_chapters: 0,
      });
    }
    const entry = bookMap.get(lbId)!;
    entry.enrolled_chapters += 1;
    if (row.status === 'completed') entry.completed_chapters += 1;
    else if (row.status === 'in_progress') entry.in_progress_chapters += 1;
  }

  const books = Array.from(bookMap.values());

  if (books.length === 0) {
    return <Empty message="아직 추가한 책이 없습니다" />;
  }

  return (
    <ul role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {books.map((book) => {
        const progress =
          book.chapter_count > 0
            ? Math.round((book.completed_chapters / book.chapter_count) * 100)
            : 0;
        const progressColor =
          progress === 100
            ? 'var(--learn-known)'
            : progress > 0
              ? 'var(--p)'
              : 'var(--bg3)';
        return (
          <li key={book.id}>
            <Link
              href={`/my/books/${book.id}`}
              className="group flex h-full flex-col overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              <div className="flex flex-1 flex-col gap-2 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 font-display text-[15px] font-[700] text-[var(--t1)]">
                    {book.title}
                  </h3>
                  {book.cefr_level && (
                    <span
                      className="inline-flex shrink-0 items-center rounded-[var(--r-sm)] px-2 py-0.5 font-mono text-[10px] font-[700]"
                      style={{
                        backgroundColor: `var(--cefr-${book.cefr_level}-bg)`,
                        color: `var(--cefr-${book.cefr_level}-text)`,
                      }}
                    >
                      {book.cefr_level}
                    </span>
                  )}
                </div>
                {book.author && (
                  <p className="line-clamp-1 font-body text-[12px] text-[var(--t3)]">
                    {book.author}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1 border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[var(--t3)]">
                    {book.completed_chapters} / {book.chapter_count}장 완료
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-[var(--t3)]">
                    {progress}%
                  </span>
                </div>
                {book.in_progress_chapters > 0 && (
                  <span className="font-mono text-[9px] text-[var(--p)]">
                    +{book.in_progress_chapters}장 학습 중
                  </span>
                )}
                <div
                  className="h-1 overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div
                    className="h-full rounded-[var(--r-full)] transition-all duration-[var(--dur-normal)]"
                    style={{ width: `${progress}%`, backgroundColor: progressColor }}
                  />
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Loading() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-44 animate-pulse rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]"
        />
      ))}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-16 text-center"
    >
      <div className="select-none text-3xl" aria-hidden>
        📚
      </div>
      <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">{message}</h3>
      <Link
        href="/library/books"
        className="rounded-[var(--r-sm)] bg-[var(--p)] px-4 py-2 font-display text-[12px] font-[600] text-[var(--ti)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
      >
        Library에서 책 발견 →
      </Link>
    </div>
  );
}
