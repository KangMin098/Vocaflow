// apps/web/src/components/admin/curation/BookDetailModal.tsx
// LCP v2.0 Phase 12 묶음 C — 책 상세 + 액션 모달

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X, Loader2, RefreshCw, CheckCircle2, Archive, AlertCircle, ExternalLink, BookOpen, Play,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import {
  archiveBook,
  classifyStatus,
  devProcessBook,
  forcePublishBook,
  parseLlmCost,
  requeueBook,
  type LibraryBookAdminRow,
} from '@/lib/library/admin-queries';
import { ModalShell } from './EnqueueModal';

interface BookDetailModalProps {
  book: LibraryBookAdminRow | null;
  onClose: () => void;
  onChanged: () => void;
}

interface ChapterStats {
  count: number;
  vocab_total: number;
  vocab_per_chapter_avg: number;
}

type ToneKey = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

export function BookDetailModal({ book, onClose, onChanged }: BookDetailModalProps) {
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ChapterStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!book) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !actionPending) onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [book, actionPending, onClose]);

  useEffect(() => {
    if (!book) {
      setStats(null);
      setError(null);
      return;
    }
    if (book.status !== 'published' && book.status !== 'ready') {
      setStats(null);
      return;
    }
    setStatsLoading(true);
    fetchStats(book.id)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [book]);

  if (!book) return null;

  async function runAction(
    label: string,
    fn: (bookId: string) => Promise<void>,
  ) {
    setActionPending(label);
    setError(null);
    try {
      await fn(book!.id);
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setActionPending(null);
    }
  }

  const statusInfo = classifyStatus(book.status);
  const cost = parseLlmCost(book.llm_cost_usd);

  return (
    <ModalShell labelledById="book-detail-title" onClose={actionPending ? () => {} : onClose} size="lg">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--bd)] px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2
              id="book-detail-title"
              className="line-clamp-1 font-display text-[16px] font-[700] text-[var(--t1)]"
            >
              {book.title}
            </h2>
            <StatusPill tone={statusInfo.tone} label={statusInfo.label} />
          </div>
          <p className="mt-0.5 line-clamp-1 font-body text-[12px] text-[var(--t3)]">
            {book.author ?? '저자 미상'} · {book.source} ID {book.source_id ?? '?'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={!!actionPending}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-sm)] text-[var(--t3)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:opacity-50"
          aria-label="닫기"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <Section title="처리 정보">
          <DataRow label="상태" value={statusInfo.label} />
          <DataRow label="CEFR" value={book.cefr_level ?? '—'} mono />
          <DataRow
            label="신뢰도"
            value={
              book.cefr_confidence != null
                ? book.cefr_confidence.toFixed(2)
                : '—'
            }
            mono
          />
          <DataRow
            label="단어 수"
            value={book.word_count?.toLocaleString() ?? '—'}
            mono
          />
          <DataRow label="장 수" value={book.chapter_count?.toString() ?? '—'} mono />
          <DataRow
            label="예상 시간"
            value={
              book.reading_minutes != null
                ? formatMinutes(book.reading_minutes)
                : '—'
            }
          />
          <DataRow
            label="LLM 비용"
            value={cost > 0 ? `$${cost.toFixed(4)}` : '—'}
            mono
          />
          <DataRow
            label="KR safe"
            value={book.copyright_safe_in_kr ? 'safe ✓' : 'check ⚠'}
            tone={book.copyright_safe_in_kr ? 'success' : 'warn'}
          />
        </Section>

        {(book.status === 'published' || book.status === 'ready') && (
          <Section title="처리 결과">
            {statsLoading ? (
              <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--t3)]">
                <Loader2 size={12} className="animate-spin" aria-hidden />
                통계 불러오는 중…
              </div>
            ) : stats ? (
              <div className="grid grid-cols-3 gap-3">
                <StatTile label="생성된 장" value={stats.count.toString()} />
                <StatTile label="총 단어" value={stats.vocab_total.toLocaleString()} />
                <StatTile
                  label="장당 평균"
                  value={stats.vocab_per_chapter_avg.toFixed(1)}
                />
              </div>
            ) : (
              <span className="font-mono text-[11px] text-[var(--t3)]">통계 없음</span>
            )}
          </Section>
        )}

        {book.status === 'failed' && book.status_message && (
          <Section title="실패 메시지" tone="danger">
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--learn-error)]">
              {book.status_message}
            </pre>
          </Section>
        )}

        <Section title="타임스탬프">
          <DataRow label="생성" value={formatDate(book.created_at)} mono />
          <DataRow label="갱신" value={formatDate(book.updated_at)} mono />
          {book.published_at && (
            <DataRow label="게시" value={formatDate(book.published_at)} mono />
          )}
        </Section>

        {book.source === 'gutenberg' && book.source_id && (
          <a
            href={`https://www.gutenberg.org/ebooks/${book.source_id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--p)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            Gutenberg 페이지 열기
            <ExternalLink size={10} aria-hidden />
          </a>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-[var(--r-sm)] bg-[var(--learn-error-light)] px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-[var(--learn-error)]" aria-hidden />
            <span className="font-body text-[12px] text-[var(--learn-error)]">{error}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--bd)] bg-[var(--bg2)] px-5 py-3">
        {(book.status === 'published' || book.status === 'ready') && (
          <Link
            href={`/admin/curation/preview/${book.id}`}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--p)] bg-[var(--p-light)] px-3 font-display text-[12px] font-[600] text-[var(--p)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p)] hover:text-[var(--ti)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
          >
            <BookOpen size={12} aria-hidden />
            📖 본문 검수
          </Link>
        )}
        {/* dev-only "Process Now" — queued/failed/in-progress 한정.
            pg_cron Vault config 가 없을 때 사용자가 수동으로 파이프라인 진행.
            서버 라우트가 NODE_ENV='production' 차단. */}
        {process.env.NODE_ENV !== 'production' &&
          ['queued', 'ingesting', 'normalizing', 'segmenting', 'analyzing', 'curating', 'failed'].includes(book.status) && (
            <ActionButton
              icon={<Play size={12} />}
              label="지금 처리 (dev)"
              pending={actionPending === 'dev-process'}
              onClick={() => runAction('dev-process', (id) => devProcessBook(id))}
              tone="primary"
            />
          )}
        {book.status === 'failed' && (
          <ActionButton
            icon={<RefreshCw size={12} />}
            label="재처리"
            pending={actionPending === 'requeue'}
            onClick={() => runAction('requeue', (id) => requeueBook(createClient(), id))}
            tone="primary"
          />
        )}
        {book.status === 'ready' && (
          <ActionButton
            icon={<CheckCircle2 size={12} />}
            label="강제 게시"
            pending={actionPending === 'publish'}
            onClick={() => runAction('publish', (id) => forcePublishBook(createClient(), id))}
            tone="primary"
          />
        )}
        {book.status !== 'archived' && (
          <ActionButton
            icon={<Archive size={12} />}
            label="보관"
            pending={actionPending === 'archive'}
            onClick={() => runAction('archive', (id) => archiveBook(createClient(), id))}
            tone="neutral"
          />
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={!!actionPending}
          className="inline-flex min-h-[36px] items-center rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:opacity-50"
        >
          닫기
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────
// Helpers — fetch stats (lazy)
// ─────────────────────────────────────────────

async function fetchStats(bookId: string): Promise<ChapterStats> {
  // library_chapters_master / library_book_vocabularies는 typed Database 스키마에
  // 등재되지 않은 LCP 전용 테이블 — admin-queries.ts와 동일하게 untyped client 사용.
  const client = createClient() as unknown as SupabaseClient;
  const [{ count: chapterCount }, { count: vocabCount }] = await Promise.all([
    client
      .from('library_chapters_master')
      .select('*', { count: 'exact', head: true })
      .eq('library_book_id', bookId),
    client
      .from('library_book_vocabularies')
      .select('*', { count: 'exact', head: true })
      .eq('library_book_id', bookId),
  ]);

  const c = chapterCount ?? 0;
  const v = vocabCount ?? 0;
  return {
    count: c,
    vocab_total: v,
    vocab_per_chapter_avg: c > 0 ? v / c : 0,
  };
}

// ─────────────────────────────────────────────
// Sub components
// ─────────────────────────────────────────────

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: 'danger';
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3
        className={[
          'font-mono text-[10px] uppercase tracking-wider',
          tone === 'danger' ? 'text-[var(--learn-error)]' : 'text-[var(--t3)]',
        ].join(' ')}
      >
        {title}
      </h3>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function DataRow({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'success' | 'warn';
}) {
  const valueColor =
    tone === 'success'
      ? 'var(--learn-known)'
      : tone === 'warn'
        ? 'var(--learn-review)'
        : 'var(--t1)';
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-20 shrink-0 font-body text-[12px] text-[var(--t3)]">{label}</span>
      <span
        className={[
          'flex-1 text-[13px] font-[600]',
          mono ? 'font-mono tabular-nums' : 'font-body',
        ].join(' ')}
        style={{ color: valueColor }}
      >
        {value}
      </span>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">
        {label}
      </span>
      <span className="font-display text-[15px] font-[700] tabular-nums text-[var(--t1)]">
        {value}
      </span>
    </div>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: ToneKey;
  label: string;
}) {
  const colorMap: Record<ToneKey, { bg: string; text: string }> = {
    success: { bg: 'var(--learn-known-light)', text: 'var(--learn-known)' },
    warning: { bg: 'var(--learn-review-light)', text: 'var(--learn-review)' },
    info: { bg: 'var(--learn-fresh-light)', text: 'var(--learn-fresh)' },
    danger: { bg: 'var(--learn-error-light)', text: 'var(--learn-error)' },
    neutral: { bg: 'var(--bg2)', text: 'var(--t3)' },
  };
  const { bg, text } = colorMap[tone];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-[var(--r-sm)] px-2 py-0.5 font-display text-[10px] font-[700]"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

function ActionButton({
  icon,
  label,
  pending,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  pending: boolean;
  onClick: () => void;
  tone: 'primary' | 'neutral';
}) {
  const cls =
    tone === 'primary'
      ? 'bg-[var(--p)] hover:bg-[var(--p-hover)] text-[var(--ti)]'
      : 'border border-[var(--bd)] bg-[var(--bg)] hover:bg-[var(--bg2)] text-[var(--t2)]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] px-3 font-display text-[12px] font-[600] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {pending ? <Loader2 size={12} className="animate-spin" aria-hidden /> : icon}
      {label}
    </button>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}
