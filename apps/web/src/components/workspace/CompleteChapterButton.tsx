// apps/web/src/components/workspace/CompleteChapterButton.tsx
// Phase 11.10 G3 — chapter 완료 버튼 + 결과 inline 표시

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type RouterInstance = ReturnType<typeof useRouter>;
import { Check, ArrowRight, Loader2, Sparkles, Library } from 'lucide-react';
import {
  completeChapter,
  type CompleteChapterResult,
} from '@/lib/library/complete-chapter';

export type ChapterDisplayStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'extracted'
  | 'conquered';

interface CompleteChapterButtonProps {
  textId: string;
  currentStatus: ChapterDisplayStatus;
}

export function CompleteChapterButton({
  textId,
  currentStatus,
}: CompleteChapterButtonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CompleteChapterResult | null>(null);

  const isAlreadyCompleted = currentStatus === 'completed';

  async function handleComplete() {
    setSubmitting(true);
    try {
      const res = await completeChapter(textId);
      setResult(res);
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.ok) {
    return <CompletionResult result={result} router={router} />;
  }

  if (isAlreadyCompleted) {
    return (
      <span
        className="inline-flex min-h-[32px] items-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--learn-known-light)] px-2.5 font-display text-[11px] font-[700] text-[var(--learn-known)]"
        role="status"
      >
        <Check size={12} aria-hidden />
        완료됨
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleComplete}
      disabled={submitting}
      className={[
        'inline-flex min-h-[32px] items-center gap-1.5 rounded-[var(--r-sm)] px-3',
        'bg-[var(--p)] hover:bg-[var(--p-hover)]',
        'font-display text-[11px] font-[600] text-[var(--ti)]',
        'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
      ].join(' ')}
    >
      {submitting ? (
        <Loader2 size={12} className="animate-spin" aria-hidden />
      ) : (
        <Check size={12} aria-hidden />
      )}
      이 장 완료
    </button>
  );
}

function CompletionResult({
  result,
  router,
}: {
  result: CompleteChapterResult;
  router: RouterInstance;
}) {
  if (result.bookCompleted) {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-[var(--r-sm)] bg-gradient-to-r from-[var(--cefr-C1-bg)] to-[var(--learn-known-light)] px-3 py-1.5"
        role="status"
      >
        <Sparkles size={14} className="text-[var(--learn-known)]" aria-hidden />
        <span className="font-display text-[11px] font-[700] text-[var(--learn-known)]">
          책 학습 완료!
        </span>
        <button
          type="button"
          onClick={() => router.push('/my/books')}
          className="inline-flex items-center gap-1 rounded-[var(--r-sm)] bg-[var(--learn-known)] px-2 py-1 font-display text-[10px] font-[600] text-[var(--ti)] transition-opacity duration-[var(--dur-normal)] ease-[var(--ease)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--learn-known)] focus-visible:ring-offset-2"
        >
          <Library size={10} aria-hidden />
          BookVault로
        </button>
      </div>
    );
  }

  if (result.nextChapterTextId) {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--learn-known-light)] px-3 py-1.5"
        role="status"
      >
        <Check size={12} className="text-[var(--learn-known)]" aria-hidden />
        <span className="font-display text-[11px] font-[600] text-[var(--learn-known)]">
          {result.alreadyCompleted ? '이미 완료됨' : '완료!'}
        </span>
        <button
          type="button"
          onClick={() =>
            router.push(`/text/${result.nextChapterTextId}?mode=read`)
          }
          className="inline-flex items-center gap-1 rounded-[var(--r-sm)] bg-[var(--p)] px-2 py-1 font-display text-[10px] font-[600] text-[var(--ti)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        >
          다음 장
          <ArrowRight size={10} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <span
      className="inline-flex min-h-[32px] items-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--learn-known-light)] px-2.5 font-display text-[11px] font-[700] text-[var(--learn-known)]"
      role="status"
    >
      <Check size={12} aria-hidden />
      완료
    </span>
  );
}
