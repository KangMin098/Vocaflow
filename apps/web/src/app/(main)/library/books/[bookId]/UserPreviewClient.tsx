// apps/web/src/app/(main)/library/books/[bookId]/UserPreviewClient.tsx
// LCP v2.0 Phase 11 — user-preview 모드 + enroll CTA

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookPlus, Loader2, AlertCircle } from 'lucide-react';
import type { ChapterListItem } from '@/lib/library/reader-queries';
import { createClient } from '@/lib/supabase/client';
import { enrollBook } from '@/lib/library/enroll';
import { BookContentReader } from '@/components/library/reader/BookContentReader';

interface Props {
  bookId: string;
  title: string;
  author: string | null;
  cefrLevel: string | null;
  totalWordCount: number;
  readingMinutes: number;
  chapters: ChapterListItem[];
}

export function UserPreviewClient({
  bookId,
  title,
  author,
  cefrLevel,
  totalWordCount,
  readingMinutes,
  chapters,
}: Props) {
  const router = useRouter();
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnroll() {
    setEnrolling(true);
    setError(null);
    try {
      const client = createClient();
      const textIds = await enrollBook(client, bookId);
      const firstTextId = textIds[0];
      if (firstTextId) {
        router.push(`/text/${firstTextId}`);
      } else {
        router.push('/');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
      setEnrolling(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <Link
          href="/library/books"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] px-3 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <ArrowLeft size={14} aria-hidden />
          도서로
        </Link>
        {readingMinutes > 0 && (
          <span className="font-mono text-[11px] text-[var(--t3)]">
            예상 학습 시간 약 {Math.round(readingMinutes / 60)}시간
          </span>
        )}
      </div>

      <BookContentReader
        libraryBookId={bookId}
        bookTitle={title}
        bookAuthor={author}
        cefrLevel={cefrLevel}
        totalWordCount={totalWordCount}
        chapters={chapters}
        mode="user-preview"
        footerSlot={
          <div className="flex flex-wrap items-center justify-between gap-3">
            {error ? (
              <span className="inline-flex items-center gap-1.5 font-body text-[12px] text-[var(--learn-error)]">
                <AlertCircle size={12} aria-hidden /> {error}
              </span>
            ) : (
              <span className="font-body text-[12px] text-[var(--t3)]">
                내 학습에 추가하면 모든 장을 chapter 단위로 학습할 수 있어요.
              </span>
            )}
            <button
              type="button"
              onClick={handleEnroll}
              disabled={enrolling}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-[var(--r-sm)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-[var(--ti)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enrolling ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <BookPlus size={14} aria-hidden />
              )}
              {enrolling ? '추가 중…' : '내 학습에 추가'}
            </button>
          </div>
        }
      />
    </>
  );
}
