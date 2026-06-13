// apps/web/src/app/(main)/my/books/page.tsx
// IA Refactor v06.27 — BookVault (enroll한 LCP 도서) · Hero stats + Chapter dot sequence

import { Suspense } from 'react';
import Link from 'next/link';
import { BookOpen, Library, Sparkles } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'BookVault — Vocaflow',
  description: 'Library에서 추가한 책',
};

export const revalidate = 60;

export default function MyBooksPage() {
  return (
    <main className="mx-auto flex w-full max-w-[var(--ios-content-wide-max)] flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={<Loading />}>
        <BookList />
      </Suspense>
    </main>
  );
}

interface EnrolledBookRow {
  library_book_id: string;
  status: string;
  chapter_idx: number | null;
  updated_at: string | null;
  library_books: {
    id: string;
    title: string;
    author: string | null;
    cefr_level: string | null;
    /** CLAUDE.md v06.29 — V-Level Centroid 기반 CEFR 6-band (canonical) */
    cefr_band: string | null;
    book_v_level: number | null;
    chapter_count: number | null;
    word_count: number | null;
  };
}

type ChapterStatus = 'completed' | 'in_progress' | 'not_started' | 'other';

interface BookSummary {
  id: string;
  title: string;
  author: string | null;
  cefr_level: string | null;
  cefr_band: string | null;
  book_v_level: number | null;
  chapter_count: number;
  word_count: number;
  enrolled_chapters: number;
  completed_chapters: number;
  in_progress_chapters: number;
  /** index → status (chapter_idx 1..N 매핑) */
  chapterStatuses: Map<number, ChapterStatus>;
  /** 가장 최근 학습 시각 (어느 chapter 든 updated_at 최대) */
  lastStudiedAt: string | null;
  /** 다음에 만날 chapter (in_progress 우선, 없으면 첫 not_started) */
  nextChapterIdx: number | null;
}

function classifyStatus(s: string): ChapterStatus {
  if (s === 'completed') return 'completed';
  if (s === 'in_progress') return 'in_progress';
  if (s === 'not_started') return 'not_started';
  return 'other';
}

function relativeKo(iso: string | null): string | null {
  if (!iso) return null;
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diffMs = now - t;
  if (Number.isNaN(diffMs) || diffMs < 0) return null;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}주 전`;
  const mo = Math.floor(day / 30);
  return mo > 0 ? `${mo}개월 전` : `${day}일 전`;
}

async function BookList() {
  const client = (await createClient()) as unknown as SupabaseClient;

  const { data, error } = await client
    .from('texts')
    .select(
      `
      library_book_id,
      status,
      chapter_idx,
      updated_at,
      library_books!inner (
        id, title, author, cefr_level, cefr_band, book_v_level, chapter_count, word_count
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
        cefr_band: lb.cefr_band,
        book_v_level: lb.book_v_level,
        chapter_count: lb.chapter_count ?? 0,
        word_count: lb.word_count ?? 0,
        enrolled_chapters: 0,
        completed_chapters: 0,
        in_progress_chapters: 0,
        chapterStatuses: new Map(),
        lastStudiedAt: null,
        nextChapterIdx: null,
      });
    }
    const entry = bookMap.get(lbId)!;
    entry.enrolled_chapters += 1;
    const cs = classifyStatus(row.status);
    if (cs === 'completed') entry.completed_chapters += 1;
    else if (cs === 'in_progress') entry.in_progress_chapters += 1;
    if (row.chapter_idx != null) {
      entry.chapterStatuses.set(row.chapter_idx, cs);
    }
    if (
      row.updated_at &&
      (!entry.lastStudiedAt || row.updated_at > entry.lastStudiedAt)
    ) {
      entry.lastStudiedAt = row.updated_at;
    }
  }

  // 다음 chapter 결정 — in_progress 우선, 없으면 첫 not_started
  for (const book of bookMap.values()) {
    let inProg: number | null = null;
    let firstNotStarted: number | null = null;
    const sortedIdx = Array.from(book.chapterStatuses.keys()).sort((a, b) => a - b);
    for (const idx of sortedIdx) {
      const st = book.chapterStatuses.get(idx);
      if (st === 'in_progress' && inProg == null) inProg = idx;
      if (st === 'not_started' && firstNotStarted == null) firstNotStarted = idx;
    }
    book.nextChapterIdx = inProg ?? firstNotStarted;
  }

  const books = Array.from(bookMap.values());

  if (books.length === 0) {
    return (
      <>
        <Hero totalBooks={0} completedBooks={0} inProgressChapters={0} />
        <Empty message="아직 추가한 책이 없습니다" />
      </>
    );
  }

  // Vault stats
  const totalBooks = books.length;
  const completedBooks = books.filter(
    (b) => b.chapter_count > 0 && b.completed_chapters >= b.chapter_count,
  ).length;
  const inProgressChapters = books.reduce(
    (acc, b) => acc + b.in_progress_chapters,
    0,
  );

  return (
    <>
      <Hero
        totalBooks={totalBooks}
        completedBooks={completedBooks}
        inProgressChapters={inProgressChapters}
      />

      <ul role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((book) => (
          <li key={book.id}>
            <BookCard book={book} />
          </li>
        ))}
      </ul>
    </>
  );
}

function Hero({
  totalBooks,
  completedBooks,
  inProgressChapters,
}: {
  totalBooks: number;
  completedBooks: number;
  inProgressChapters: number;
}) {
  return (
    <header
      className="relative overflow-hidden rounded-[var(--r-xl)] border border-[var(--bd)] bg-gradient-to-br from-[var(--p-light)] via-[var(--bg)] to-[var(--bg2)] p-5 shadow-[var(--sh-sm)] md:p-6"
      aria-labelledby="bookvault-title"
    >
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[var(--p)]/[0.07] blur-2xl" aria-hidden />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 font-display text-[10.5px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
            <Library size={12} aria-hidden />
            BookVault
          </div>
          <h1
            id="bookvault-title"
            className="font-display text-[22px] font-[800] tracking-[-0.01em] text-[var(--t1)] md:text-[26px]"
          >
            내 책장
          </h1>
          <p className="font-body text-[12.5px] text-[var(--t3)]">
            Library 에서 내 학습에 추가한 책들 · chapter 단위로 이어 읽어요
          </p>
        </div>

        <dl className="flex shrink-0 gap-4 md:gap-6">
          <Stat label="총 권수" value={totalBooks} />
          <Stat label="완독" value={completedBooks} highlight={completedBooks > 0} />
          <Stat label="학습 중 장" value={inProgressChapters} />
        </dl>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5 md:items-start">
      <dd
        className={`font-display text-[22px] font-[800] leading-none tabular-nums md:text-[26px] ${
          highlight ? 'text-[var(--p)]' : 'text-[var(--t1)]'
        }`}
      >
        {value}
      </dd>
      <dt className="font-display text-[10.5px] font-[600] uppercase tracking-[0.08em] text-[var(--t3)]">
        {label}
      </dt>
    </div>
  );
}

function BookCard({ book }: { book: BookSummary }) {
  const progress =
    book.chapter_count > 0
      ? Math.round((book.completed_chapters / book.chapter_count) * 100)
      : 0;
  const isComplete = progress === 100;
  const last = relativeKo(book.lastStudiedAt);

  return (
    <Link
      href={`/my/books/${book.id}`}
      aria-label={`${book.title} 이어 읽기 · ${progress}% 진행`}
      className="group flex h-full flex-col overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 hover:border-[var(--p)]/40 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
    >
      <div className="flex flex-1 flex-col gap-2 p-5 pb-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-display text-[15px] font-[700] leading-snug text-[var(--t1)]">
            {book.title}
          </h3>
          <div className="flex shrink-0 items-center gap-1">
            {(book.cefr_band ?? book.cefr_level) && (
              <span
                className="inline-flex items-center rounded-[var(--r-sm)] px-2 py-0.5 font-mono text-[10px] font-[700]"
                style={{
                  backgroundColor: `var(--cefr-${book.cefr_band ?? book.cefr_level}-bg)`,
                  color: `var(--cefr-${book.cefr_band ?? book.cefr_level}-text)`,
                }}
                title={
                  book.cefr_band && book.cefr_level && book.cefr_band !== book.cefr_level
                    ? `centroid: ${book.cefr_band} · analyze: ${book.cefr_level}`
                    : undefined
                }
              >
                {book.cefr_band ?? book.cefr_level}
              </span>
            )}
            {book.book_v_level != null && (
              <span
                className="inline-flex items-center rounded-[var(--r-sm)] bg-[var(--bg3)] px-2 py-0.5 font-display text-[10px] font-[700] text-[var(--t2)]"
                title="V-Level (한국 학습자 어휘 부담)"
              >
                V{book.book_v_level}
              </span>
            )}
          </div>
        </div>
        {book.author && (
          <p className="line-clamp-1 font-body text-[12px] text-[var(--t3)]">
            {book.author}
          </p>
        )}

        {/* Next/Last hint — 학습 흐름 단서 */}
        <div className="mt-1 flex items-center gap-1.5 font-body text-[11.5px] text-[var(--t3)]">
          {isComplete ? (
            <span className="inline-flex items-center gap-1 font-[600] text-[var(--learn-known)]">
              <Sparkles size={11} aria-hidden /> 완독했어요
            </span>
          ) : book.nextChapterIdx != null ? (
            <span className="inline-flex items-center gap-1">
              <BookOpen size={11} aria-hidden className="text-[var(--p)]" />
              <span className="text-[var(--t2)]">
                다음 <strong className="font-display font-[700] text-[var(--t1)]">Chapter {book.nextChapterIdx}</strong>
              </span>
            </span>
          ) : (
            <span className="text-[var(--t3)]">시작 대기</span>
          )}
          {last && (
            <>
              <span className="text-[var(--t4)]" aria-hidden>·</span>
              <span>{last}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-3">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--t3)]">
            <strong className="font-[700] text-[var(--t1)]">{book.completed_chapters}</strong>
            <span className="text-[var(--t4)]"> / </span>
            {book.chapter_count}장 완료
          </span>
          <span
            className={`font-mono text-[11px] font-[700] tabular-nums ${
              isComplete ? 'text-[var(--learn-known)]' : 'text-[var(--p)]'
            }`}
          >
            {progress}%
          </span>
        </div>

        {/* Chapter dot sequence — 한눈에 어디까지 왔는지 */}
        <ChapterDotRow book={book} />
      </div>
    </Link>
  );
}

function ChapterDotRow({ book }: { book: BookSummary }) {
  const total = book.chapter_count;
  if (total <= 0) return null;

  // total 이 많을 경우 (60+) bucketing — 평균 15 단위로 잘라 status 우선순위 in_progress > completed > not_started
  const MAX_DOTS = 60;
  if (total <= MAX_DOTS) {
    return (
      <div
        className="flex flex-wrap items-center gap-[3px]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={book.completed_chapters}
        aria-label={`${total}장 중 ${book.completed_chapters}장 완료`}
      >
        {Array.from({ length: total }, (_, i) => {
          const idx = i + 1;
          const st = book.chapterStatuses.get(idx);
          return <ChapterDot key={idx} status={st} idx={idx} />;
        })}
      </div>
    );
  }

  // bucketing — total > MAX_DOTS
  const bucketSize = Math.ceil(total / MAX_DOTS);
  const buckets: ChapterStatus[] = [];
  for (let b = 0; b < MAX_DOTS; b++) {
    const start = b * bucketSize + 1;
    const end = Math.min(start + bucketSize - 1, total);
    let inProg = false;
    let anyCompleted = false;
    let anyEnrolled = false;
    for (let i = start; i <= end; i++) {
      const st = book.chapterStatuses.get(i);
      if (!st) continue;
      anyEnrolled = true;
      if (st === 'in_progress') inProg = true;
      if (st === 'completed') anyCompleted = true;
    }
    buckets.push(
      inProg
        ? 'in_progress'
        : anyCompleted
          ? 'completed'
          : anyEnrolled
            ? 'not_started'
            : 'other',
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-[3px]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={book.completed_chapters}
      aria-label={`${total}장 중 ${book.completed_chapters}장 완료`}
    >
      {buckets.map((st, i) => (
        <ChapterDot key={i} status={st} idx={i * bucketSize + 1} bucketed />
      ))}
    </div>
  );
}

function ChapterDot({
  status,
  idx,
  bucketed,
}: {
  status: ChapterStatus | undefined;
  idx: number;
  bucketed?: boolean;
}) {
  const tone = (() => {
    switch (status) {
      case 'completed':
        return { bg: 'var(--learn-known)', label: '완료' };
      case 'in_progress':
        return { bg: 'var(--p)', label: '학습 중' };
      case 'not_started':
        return { bg: 'var(--t4)', label: '미시작' };
      default:
        return { bg: 'var(--bg3)', label: '미등록' };
    }
  })();
  const isLive = status === 'in_progress';
  return (
    <span
      className={`block h-1.5 w-1.5 shrink-0 rounded-[1px] transition-colors duration-[var(--dur-normal)] ${
        isLive ? 'animate-[pulse-soft_2.4s_ease-in-out_infinite]' : ''
      }`}
      style={{ backgroundColor: tone.bg }}
      title={bucketed ? `~Ch.${idx} · ${tone.label}` : `Chapter ${idx} · ${tone.label}`}
      aria-hidden
    />
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
