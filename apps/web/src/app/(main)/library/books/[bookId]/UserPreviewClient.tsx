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
import {
  BookDetailClient,
  type ChapterSet,
} from '@/components/library/books/BookDetailClient';

interface Props {
  bookId: string;
  title: string;
  author: string | null;
  cefrLevel: string | null;
  /** CLAUDE.md v06.29 4축 — detail 화면 노출 */
  cefrBand: string | null;
  bookVLevel: number | null;
  vLevelCentroid: string | null;
  cefrjLevel: string | null;
  cefrjConfidence: string | null;
  fleschKincaidGrade: string | null;
  fleschReadingEase: string | null;
  lemmaCoveragePct: number | null;
  totalWordCount: number;
  readingMinutes: number;
  chapters: ChapterListItem[];
  /** v06.31 — 챕터 단어장 grid (도서 컨텍스트 안에서만 노출) */
  chapterSets: ChapterSet[];
  subscribedIds: string[];
  isLoggedIn: boolean;
}

export function UserPreviewClient({
  bookId,
  title,
  author,
  cefrLevel,
  cefrBand,
  bookVLevel,
  vLevelCentroid,
  cefrjLevel,
  cefrjConfidence,
  fleschKincaidGrade,
  fleschReadingEase,
  lemmaCoveragePct,
  totalWordCount,
  readingMinutes,
  chapters,
  chapterSets,
  subscribedIds,
  isLoggedIn,
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
      router.push(firstTextId ? `/text/${firstTextId}` : '/');
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
          <span className="font-mono text-[11px] text-[var(--t2)]">
            예상 학습 시간 약 {Math.round(readingMinutes / 60)}시간
          </span>
        )}
      </div>

      <DifficultyCard
        cefrBand={cefrBand}
        cefrLevel={cefrLevel}
        bookVLevel={bookVLevel}
        vLevelCentroid={vLevelCentroid}
        cefrjLevel={cefrjLevel}
        cefrjConfidence={cefrjConfidence}
        fleschKincaidGrade={fleschKincaidGrade}
        fleschReadingEase={fleschReadingEase}
        lemmaCoveragePct={lemmaCoveragePct}
      />

      {/* v06.31 — 챕터 단어장 grid (도서 컨텍스트 안 · 도서 매핑 원칙) */}
      {chapterSets.length > 0 && (
        <BookDetailClient
          bookId={bookId}
          bookVLevel={bookVLevel}
          chapterSets={chapterSets}
          subscribedIds={subscribedIds}
          isLoggedIn={isLoggedIn}
        />
      )}

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
              <span className="font-body text-[12px] text-[var(--t2)]">
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

// ─────────────────────────────────────────────
// DifficultyCard — CLAUDE.md v06.29 §"라이브러리 도서 난이도 지수" detail 표시
// 메인은 cefr_band + V-Level / detail 은 centroid 정밀값 + F-K + coverage + CEFR-J
// ─────────────────────────────────────────────
function DifficultyCard({
  cefrBand,
  cefrLevel,
  bookVLevel,
  vLevelCentroid,
  cefrjLevel,
  cefrjConfidence,
  fleschKincaidGrade,
  fleschReadingEase,
  lemmaCoveragePct,
}: {
  cefrBand: string | null;
  cefrLevel: string | null;
  bookVLevel: number | null;
  vLevelCentroid: string | null;
  cefrjLevel: string | null;
  cefrjConfidence: string | null;
  fleschKincaidGrade: string | null;
  fleschReadingEase: string | null;
  lemmaCoveragePct: number | null;
}) {
  const canonicalCefr = cefrBand ?? cefrLevel;
  const hasAny =
    canonicalCefr ||
    bookVLevel != null ||
    vLevelCentroid ||
    cefrjLevel ||
    fleschKincaidGrade;
  if (!hasAny) return null;

  return (
    <section
      aria-label="난이도 지수"
      className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4"
    >
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-[12px] font-[700] uppercase tracking-wider text-[var(--t2)]">
          난이도 지수
        </h2>
        <span
          className="font-mono text-[10px] text-[var(--t2)]"
          title="네 가지 지수가 책의 서로 다른 측면을 잡아냅니다."
        >
          4축
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="CEFR (6-band)"
          value={canonicalCefr ?? '—'}
          sub={
            cefrBand && cefrLevel && cefrBand !== cefrLevel
              ? `analyze: ${cefrLevel}`
              : '한국 학습자 어휘 부담'
          }
        />
        <Stat
          label="V-Level"
          value={bookVLevel != null ? `V${bookVLevel}` : '—'}
          sub={vLevelCentroid ? `centroid ${vLevelCentroid}` : 'Vocaflow 자체'}
        />
        <Stat
          label="CEFR-J"
          value={cefrjLevel ?? '—'}
          sub={cefrjConfidence ? `신뢰도 ${cefrjConfidence}` : '12-band'}
        />
        <Stat
          label="F-K Grade"
          value={fleschKincaidGrade ?? '—'}
          sub={fleschReadingEase ? `ease ${fleschReadingEase}` : '통사 복잡도'}
        />
      </div>

      {lemmaCoveragePct != null && (
        <p className="mt-3 font-body text-[11px] text-[var(--t2)]">
          어휘 매칭 {lemmaCoveragePct}% · 외부 표준: CEFR-J Wordlist v1.6 (© Tono Lab, Tokyo University of Foreign Studies)
        </p>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-[10px] font-[600] uppercase tracking-wide text-[var(--t2)]">
        {label}
      </span>
      <span className="font-display text-[18px] font-[700] tabular-nums text-[var(--t1)]">
        {value}
      </span>
      {sub && (
        <span className="font-mono text-[10px] text-[var(--t2)]">{sub}</span>
      )}
    </div>
  );
}
