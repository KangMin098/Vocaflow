// apps/web/src/components/workspace/CompleteChapterButton.tsx
// Phase 11.10 G3 — chapter 완료 버튼 + 결과 inline 표시
// T-0192 — 저장 중·실패·재시도, 중복 조작 방지, 늦은 응답 무시, 44px 조작

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type RouterInstance = ReturnType<typeof useRouter>;
import { Check, ArrowRight, Loader2, Library, RotateCcw } from 'lucide-react'
import { Gwonjeom } from '@/components/ui/press/Gwonjeom';
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
  /** 기본은 실제 저장 액션 — dev 하네스만 fake 응답을 넣는다 */
  complete?: (textId: string) => Promise<CompleteChapterResult>;
}

// 완료는 학습자의 읽음 표시다 — 실패해도 본문·읽기 위치는 그대로 두고 다시 시도만 안내한다.
const FAILURE_MESSAGE = '완료 표시를 저장하지 못했어요. 읽던 곳은 그대로예요. 다시 시도해 주세요.';

const ACTION_BASE =
  'inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] px-3 font-display text-[12px] font-[600] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

export type CompletionOutcome =
  | { kind: 'ok'; result: CompleteChapterResult }
  | { kind: 'failed' }
  | { kind: 'stale' };

/** 저장 한 번 — reject·ok=false 는 실패, 응답 전에 장이 바뀌었으면 stale(표시하지 않음). */
export async function attemptCompletion(
  textId: string,
  complete: (textId: string) => Promise<CompleteChapterResult>,
  isCurrent: () => boolean,
): Promise<CompletionOutcome> {
  let res: CompleteChapterResult | null = null;
  try {
    res = await complete(textId);
  } catch {
    res = null;
  }
  if (!isCurrent()) return { kind: 'stale' };
  return res?.ok ? { kind: 'ok', result: res } : { kind: 'failed' };
}

export function CompleteChapterButton({
  textId,
  currentStatus,
  complete = completeChapter,
}: CompleteChapterButtonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<CompleteChapterResult | null>(null);
  // 진행 중 요청이 어느 textId 의 것인지 — 장이 바뀐 뒤 도착한 응답은 버린다.
  const inflight = useRef<string | null>(null);
  const currentTextId = useRef(textId);

  useEffect(() => {
    currentTextId.current = textId;
    inflight.current = null;
    setSubmitting(false);
    setFailed(false);
    setResult(null);
  }, [textId]);

  const isAlreadyCompleted = currentStatus === 'completed';

  async function handleComplete() {
    if (inflight.current) return;
    const requestId = textId;
    inflight.current = requestId;
    setSubmitting(true);
    setFailed(false);
    const outcome = await attemptCompletion(
      requestId,
      complete,
      () => currentTextId.current === requestId && inflight.current === requestId,
    );
    if (outcome.kind === 'stale') return;
    inflight.current = null;
    setSubmitting(false);
    if (outcome.kind === 'ok') {
      setResult(outcome.result);
      startTransition(() => {
        router.refresh();
      });
    } else {
      setFailed(true);
    }
  }

  if (result?.ok) {
    return <CompletionResult result={result} router={router} />;
  }

  if (isAlreadyCompleted) {
    return (
      <span
        className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] bg-[var(--learn-known-light)] px-3 font-display text-[12px] font-[700] text-[var(--learn-known)]"
        role="status"
      >
        <Check size={14} aria-hidden />
        완료됨
      </span>
    );
  }

  return (
    <ChapterCompleteAction
      phase={submitting ? 'submitting' : failed ? 'failed' : 'idle'}
      onComplete={handleComplete}
    />
  );
}

export function ChapterCompleteAction({
  phase,
  onComplete,
}: {
  phase: 'idle' | 'submitting' | 'failed';
  onComplete: () => void;
}) {
  const submitting = phase === 'submitting';
  const failed = phase === 'failed';
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onComplete}
        aria-disabled={submitting || undefined}
        aria-busy={submitting || undefined}
        data-testid="complete-chapter"
        className={[
          ACTION_BASE,
          'bg-[var(--p)] text-[var(--ti)] hover:bg-[var(--p-hover)] focus-visible:ring-[var(--p)]',
          submitting ? 'cursor-progress opacity-70' : '',
        ].join(' ')}
      >
        {submitting ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : failed ? (
          <RotateCcw size={14} aria-hidden />
        ) : (
          <Check size={14} aria-hidden />
        )}
        {submitting ? '저장 중…' : failed ? '다시 시도' : '이 장 완료'}
      </button>
      <span aria-live="polite" className="sr-only">
        {submitting ? '완료 표시를 저장하는 중' : ''}
      </span>
      {failed && (
        <span
          role="alert"
          data-testid="complete-chapter-error"
          className="font-display text-[12px] font-[600] text-[var(--error-ink)] break-keep"
        >
          {FAILURE_MESSAGE}
        </span>
      )}
    </span>
  );
}

function CompletionResult({
  result,
  router,
}: {
  result: CompleteChapterResult;
  router: RouterInstance;
}) {
  // 완료 버튼이 사라지므로 키보드 포커스를 다음 행동으로 옮긴다(body 로 떨어지지 않게).
  const nextAction = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    nextAction.current?.focus();
  }, []);

  if (result.bookCompleted) {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-[var(--r-sm)] bg-gradient-to-r from-[var(--cefr-C1-bg)] to-[var(--learn-known-light)] px-3 py-1"
        role="status"
      >
        <Gwonjeom size={14} className="text-[var(--learn-known)]" aria-hidden />
        <span className="font-display text-[12px] font-[700] text-[var(--learn-known)]">
          책 학습 완료!
        </span>
        <button
          ref={nextAction}
          type="button"
          onClick={() => router.push('/my/books')}
          className={`${ACTION_BASE} bg-[var(--learn-known)] text-[var(--ti)] hover:opacity-90 focus-visible:ring-[var(--learn-known)]`}
        >
          <Library size={14} aria-hidden />
          BookVault로
        </button>
      </div>
    );
  }

  if (result.nextChapterTextId) {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--learn-known-light)] px-3 py-1"
        role="status"
      >
        <Check size={14} className="text-[var(--learn-known)]" aria-hidden />
        <span className="font-display text-[12px] font-[600] text-[var(--learn-known)]">
          {result.alreadyCompleted ? '이미 완료됨' : '완료!'}
        </span>
        <button
          ref={nextAction}
          type="button"
          onClick={() =>
            router.push(`/text/${result.nextChapterTextId}?mode=read`)
          }
          className={`${ACTION_BASE} bg-[var(--p)] text-[var(--on-p)] hover:bg-[var(--p-hover)] focus-visible:ring-[var(--p)]`}
        >
          다음 장
          <ArrowRight size={14} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <span
      className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] bg-[var(--learn-known-light)] px-3 font-display text-[12px] font-[700] text-[var(--learn-known)]"
      role="status"
    >
      <Check size={14} aria-hidden />
      완료
    </span>
  );
}
