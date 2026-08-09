// apps/web/src/components/admin/curation/GutenbergIdTab.tsx
// LCP v2.0 Phase 12 묶음 B — Gutenberg ID 직접 입력 + 미리보기 (Tab 3)

'use client';

import { useState, useTransition } from 'react';
import { Search, ExternalLink, Loader2, AlertCircle } from 'lucide-react';

export interface GutenbergPreview {
  source: 'gutenberg';
  source_id: string;
  title: string | null;
  author: string | null;
  author_birth_year: number | null;
  author_death_year: number | null;
  language: string | null;
  preview_text: string;
  source_url: string;
  fetched_at: string;
}

interface GutenbergIdTabProps {
  onPickPreview: (preview: GutenbergPreview) => void;
}

export function GutenbergIdTab({ onPickPreview }: GutenbergIdTabProps) {
  const [idInput, setIdInput] = useState('');
  const [preview, setPreview] = useState<GutenbergPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  async function handleFetch() {
    const id = idInput.trim();
    if (!id) {
      setError('ID를 입력해 주세요.');
      return;
    }
    if (!/^\d{1,7}$/.test(id)) {
      setError('ID는 1~7자리 숫자여야 합니다.');
      return;
    }

    setError(null);
    setPreview(null);
    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/admin/library/preview-gutenberg?id=${encodeURIComponent(id)}`,
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? '미리보기를 가져오지 못했습니다.');
        return;
      }

      startTransition(() => {
        setPreview(data as GutenbergPreview);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFetch();
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Gutenberg ID 직접 입력">
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
          🔢 Gutenberg ID 직접 입력
        </h2>
        <span className="font-mono text-[12px] text-[var(--t2)]">
          Project Gutenberg 책 번호
        </span>
      </div>

      <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-4">
        <label
          htmlFor="gutenberg-id-input"
          className="font-display text-[12px] font-[600] text-[var(--t2)]"
        >
          Gutenberg ID
        </label>

        <div className="flex flex-wrap items-stretch gap-2">
          <input
            id="gutenberg-id-input"
            type="text"
            inputMode="numeric"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예: 1342 (Pride and Prejudice)"
            className={[
              'min-h-[40px] flex-1 min-w-[200px] rounded-[var(--r-sm)]',
              'border border-[var(--bd)] bg-[var(--bg)]',
              'px-3 font-mono text-[13px] text-[var(--t1)]',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
              'placeholder:text-[var(--t5)]',
              'hover:border-[var(--t3)]',
              'focus-visible:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
            ].join(' ')}
            aria-describedby={error ? 'gutenberg-id-error' : undefined}
            aria-invalid={!!error}
          />

          <button
            type="button"
            onClick={handleFetch}
            disabled={isLoading || !idInput.trim()}
            className={[
              'min-h-[40px] inline-flex items-center justify-center gap-2',
              'rounded-[var(--r-sm)] px-4',
              'bg-[var(--p)] hover:bg-[var(--p-hover)]',
              'font-display text-[12px] font-[600] text-[var(--ti)]',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
            ].join(' ')}
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <Search size={14} aria-hidden />
            )}
            {isLoading ? '불러오는 중…' : '미리보기'}
          </button>
        </div>

        {error && (
          <div
            id="gutenberg-id-error"
            role="alert"
            className="flex items-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--learn-error-light)] px-3 py-2"
          >
            <AlertCircle size={12} className="text-[var(--learn-error)]" aria-hidden />
            <span className="font-body text-[11px] text-[var(--learn-error)]">
              {error}
            </span>
          </div>
        )}

        <p className="font-body text-[11px] text-[var(--t2)]">
          Gutenberg 사이트에서 책 페이지 URL의 마지막 숫자입니다.
          예: <code className="font-mono text-[var(--t2)]">https://www.gutenberg.org/ebooks/<strong>1342</strong></code>
        </p>
      </div>

      {preview && (
        <PreviewCard
          preview={preview}
          isPickPending={isPending}
          onPick={() => onPickPreview(preview)}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────
// Sub: Preview card
// ─────────────────────────────────────────────

interface PreviewCardProps {
  preview: GutenbergPreview;
  isPickPending: boolean;
  onPick: () => void;
}

function PreviewCard({ preview, isPickPending, onPick }: PreviewCardProps) {
  const yearRange =
    preview.author_birth_year != null && preview.author_death_year != null
      ? `(${formatYear(preview.author_birth_year)}–${formatYear(preview.author_death_year)})`
      : null;

  return (
    <article
      className={[
        'flex flex-col overflow-hidden',
        'rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]',
        'shadow-[var(--sh-sm)]',
      ].join(' ')}
    >
      <header className="border-b border-[var(--bd)] bg-[var(--bg2)] px-5 py-3">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="font-display text-[15px] font-[700] text-[var(--t1)]">
            {preview.title ?? '(제목 없음)'}
          </h3>
          <a
            href={preview.source_url}
            target="_blank"
            rel="noreferrer"
            className={[
              'inline-flex shrink-0 items-center gap-1 rounded-[var(--r-sm)]',
              'px-2 py-1 font-mono text-[10px] text-[var(--t2)]',
              'hover:bg-[var(--bg)] hover:text-[var(--t1)]',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
            ].join(' ')}
            aria-label="Gutenberg 페이지 새 탭에서 열기"
          >
            ID {preview.source_id}
            <ExternalLink size={10} aria-hidden />
          </a>
        </div>
        <p className="font-body text-[12px] text-[var(--t2)]">
          {preview.author ?? '저자 미상'} {yearRange}
          {preview.language && (
            <span className="ml-2 font-mono text-[10px] text-[var(--t5)]">
              · {preview.language}
            </span>
          )}
        </p>
      </header>

      <div className="px-5 py-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--t2)]">
          본문 미리보기
        </div>
        <p className="line-clamp-6 font-body text-[13px] leading-relaxed text-[var(--t1)]">
          {preview.preview_text}
        </p>
      </div>

      <footer className="border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-3">
        <button
          type="button"
          onClick={onPick}
          disabled={isPickPending}
          className={[
            'inline-flex min-h-[36px] items-center justify-center gap-2',
            'rounded-[var(--r-sm)] px-4',
            'bg-[var(--p)] hover:bg-[var(--p-hover)]',
            'font-display text-[12px] font-[600] text-[var(--ti)]',
            'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
          ].join(' ')}
        >
          ➕ 큐에 추가
        </button>
      </footer>
    </article>
  );
}

function formatYear(year: number): string {
  return year < 0 ? `BC ${-year}` : `${year}`;
}
