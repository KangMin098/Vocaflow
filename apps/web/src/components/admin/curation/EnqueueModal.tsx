// apps/web/src/components/admin/curation/EnqueueModal.tsx
// LCP v2.0 Phase 12 묶음 C — 책 큐 추가 확인 모달

'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { enqueueBookViaRpc } from '@/lib/library/admin-queries';
import type { SeedItem } from './SeedCard';
import type { GutenbergPreview } from './GutenbergIdTab';

/** Union — Tab 2 (SeedItem) + Tab 3 (GutenbergPreview). */
export type EnqueueSource =
  | { kind: 'seed'; data: SeedItem }
  | { kind: 'preview'; data: GutenbergPreview };

interface EnqueueModalProps {
  source: EnqueueSource | null;
  onClose: () => void;
  onSuccess: (bookId: string) => void;
}

type EnqueueResult =
  | { kind: 'success'; bookId: string }
  | { kind: 'error'; message: string };

export function EnqueueModal({ source, onClose, onSuccess }: EnqueueModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EnqueueResult | null>(null);

  useEffect(() => {
    if (!source) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [source, submitting, onClose]);

  useEffect(() => {
    if (source) setResult(null);
  }, [source]);

  if (!source) return null;

  const normalized = normalizeSource(source);

  async function handleEnqueue() {
    if (!source) return;
    setSubmitting(true);
    setResult(null);
    try {
      const client = createClient();
      const bookId = await enqueueBookViaRpc(client, normalized);
      setResult({ kind: 'success', bookId });
      setTimeout(() => {
        onSuccess(bookId);
        onClose();
      }, 600);
    } catch (e) {
      const message = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
      setResult({ kind: 'error', message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell labelledById="enqueue-modal-title" onClose={submitting ? () => {} : onClose}>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--bd)] px-5 py-4">
        <div>
          <h2
            id="enqueue-modal-title"
            className="font-display text-[16px] font-[700] text-[var(--t1)]"
          >
            큐에 책 추가
          </h2>
          <p className="mt-0.5 font-body text-[12px] text-[var(--t3)]">
            처리 큐에 추가하면 자동으로 분석이 시작됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:opacity-50"
          aria-label="닫기"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-3 px-5 py-4">
        <SummaryRow label="제목" value={normalized.title} bold />
        {normalized.author && <SummaryRow label="저자" value={normalized.author} />}
        <SummaryRow
          label="소스"
          value={`${normalized.source} · ID ${normalized.source_id}`}
          mono
        />
        {(normalized.author_birth_year != null || normalized.author_death_year != null) && (
          <SummaryRow
            label="생몰"
            value={`${formatYear(normalized.author_birth_year)} – ${formatYear(normalized.author_death_year)}`}
            mono
          />
        )}
        <SummaryRow label="라이선스" value={normalized.license ?? 'PD-US'} mono />

        {result?.kind === 'success' && (
          <div
            role="status"
            className="mt-2 flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--learn-known-light)] px-3 py-2"
          >
            <CheckCircle2 size={14} className="text-[var(--learn-known)]" aria-hidden />
            <span className="font-body text-[12px] text-[var(--learn-known)]">
              큐에 추가되었습니다. 백그라운드에서 자동 처리됩니다.
            </span>
          </div>
        )}
        {result?.kind === 'error' && (
          <div
            role="alert"
            className="mt-2 flex items-start gap-2 rounded-[var(--r-sm)] bg-[var(--learn-error-light)] px-3 py-2"
          >
            <AlertCircle
              size={14}
              className="mt-0.5 shrink-0 text-[var(--learn-error)]"
              aria-hidden
            />
            <span className="font-body text-[12px] text-[var(--learn-error)]">
              {result.message}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="inline-flex min-h-[36px] items-center rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleEnqueue}
          disabled={submitting || result?.kind === 'success'}
          className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-[var(--r-sm)] bg-[var(--p)] px-4 font-display text-[12px] font-[600] text-[var(--ti)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden />
              추가 중…
            </>
          ) : (
            '➕ 큐에 추가'
          )}
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

interface NormalizedEnqueue {
  source: string;
  source_id: string;
  title: string;
  author: string | null;
  author_birth_year: number | null;
  author_death_year: number | null;
  license: string;
}

function normalizeSource(s: EnqueueSource): NormalizedEnqueue {
  if (s.kind === 'seed') {
    return {
      source: s.data.source,
      source_id: s.data.source_id,
      title: s.data.title,
      author: s.data.author,
      author_birth_year: s.data.author_birth_year,
      author_death_year: s.data.author_death_year,
      license: s.data.license,
    };
  }
  return {
    source: s.data.source,
    source_id: s.data.source_id,
    title: s.data.title ?? '(제목 미상)',
    author: s.data.author,
    author_birth_year: s.data.author_birth_year,
    author_death_year: s.data.author_death_year,
    license: 'PD-US',
  };
}

function formatYear(year: number | null): string {
  if (year == null) return '?';
  return year < 0 ? `BC ${-year}` : `${year}`;
}

function SummaryRow({
  label,
  value,
  bold,
  mono,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">
        {label}
      </span>
      <span
        className={[
          'flex-1 text-[13px] text-[var(--t1)]',
          mono ? 'font-mono' : 'font-body',
          bold ? 'font-[700]' : 'font-[500]',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Modal shell — 다른 모달도 재사용
// ─────────────────────────────────────────────

export function ModalShell({
  labelledById,
  onClose,
  children,
  size = 'md',
}: {
  labelledById: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledById}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={[
          'flex w-full flex-col overflow-hidden',
          'rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]',
          'shadow-[var(--sh-lg)]',
          'max-h-[90vh]',
          size === 'lg' ? 'max-w-2xl' : 'max-w-md',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
