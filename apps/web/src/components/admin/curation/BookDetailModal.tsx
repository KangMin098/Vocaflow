// apps/web/src/components/admin/curation/BookDetailModal.tsx
// LCP v2.0 Phase 12 묶음 C — 책 상세 + 액션 모달

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X, Loader2, RefreshCw, CheckCircle2, Archive, AlertCircle, ExternalLink, BookOpen, Play, Undo2, Trash2, ListChecks,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import {
  archiveBook,
  classifyStatus,
  deleteBook,
  devProcessBook,
  devValidateBook,
  forcePublishBook,
  parseLlmCost,
  requeueBook,
  revertPublishedBook,
  type DevValidateResult,
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
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 재처리 커밋 전 dry-run 검증 결과 (예상 챕터 수 + 경고)
  const [dryRun, setDryRun] = useState<DevValidateResult | null>(null);
  // dev-process 등 keepOpen 액션 완료 후 인라인 success 표시 (3초 후 자동 소멸)
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    setDryRun(null); // 책 바뀌면 이전 검증 결과 초기화
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
    options: { keepOpen?: boolean } = {},
  ) {
    setActionPending(label);
    setError(null);
    setSuccessMessage(null);
    try {
      await fn(book!.id);
      // keepOpen: 모달 유지하며 (1) success 인라인 표시 + (2) 부모 재페치 트리거 + (3) stats 재페치.
      //   부모 재페치 안 하면 닫기 후 status 변경이 목록에 반영 안 됨.
      //   selectedBook 자체는 MyLibraryTab 의 books 갱신 시 useEffect 로 fresh row 로 교체.
      if (options.keepOpen) {
        setSuccessMessage(`${label === 'dev-process' ? '처리' : label} 완료 ✓`);
        // 인라인 success 3초 후 자동 소멸
        setTimeout(() => setSuccessMessage(null), 3000);
        onChanged();
        if (book) {
          setStatsLoading(true);
          fetchStats(book.id)
            .then(setStats)
            .catch(() => setStats(null))
            .finally(() => setStatsLoading(false));
        }
      } else {
        onChanged();
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setActionPending(null);
    }
  }

  // dry-run 검증 — 모달 유지, 예상 챕터 수 + 경고를 인라인 표시 (커밋 X)
  async function handleDryRun() {
    setActionPending('dry-validate');
    setError(null);
    setDryRun(null);
    try {
      setDryRun(await devValidateBook(book!.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'dry-run 검증 실패');
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

        <Section title="4축 난이도 지수 (v06.29)">
          <DataRow
            label="CEFR (6-band)"
            value={book.cefr_band ?? book.cefr_level ?? '—'}
            mono
          />
          <DataRow
            label="V-Level (p75)"
            value={book.book_v_level != null ? `V${book.book_v_level}` : '—'}
            mono
          />
          <DataRow
            label="V Centroid (정밀)"
            value={book.v_level_centroid_precise ?? '—'}
            mono
          />
          <DataRow
            label="CEFR-J (12-band)"
            value={book.cefrj_level ?? '—'}
            mono
          />
          <DataRow
            label="CEFR-J 신뢰도"
            value={book.cefrj_confidence ?? '—'}
            tone={
              book.cefrj_confidence
                ? parseFloat(book.cefrj_confidence) >= 0.85
                  ? 'success'
                  : parseFloat(book.cefrj_confidence) < 0.7
                    ? 'warn'
                    : undefined
                : undefined
            }
            mono
          />
          <DataRow
            label="F-K Grade"
            value={book.flesch_kincaid_grade ?? '—'}
            mono
          />
          <DataRow
            label="F-K Reading Ease"
            value={book.flesch_reading_ease ?? '—'}
            mono
          />
          <DataRow
            label="CEFR (analyze)"
            value={
              book.cefr_level && book.cefr_confidence != null
                ? `${book.cefr_level} · ${book.cefr_confidence.toFixed(2)}`
                : (book.cefr_level ?? '—')
            }
            mono
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
        {successMessage && (
          <div role="status" aria-live="polite" className="flex items-start gap-2 rounded-[var(--r-sm)] bg-[var(--success-light)] px-3 py-2">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--success)]" aria-hidden />
            <span className="font-body text-[12px] text-[var(--success)]">{successMessage}</span>
          </div>
        )}
      </div>

      {/* dry-run 검증 결과 — 재처리 커밋 전 예상 챕터 수 + 경고 (커밋 X) */}
      {dryRun && <DryRunResult result={dryRun} currentChapters={book.chapter_count ?? null} />}

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
        {/* dev-only "Process Now / 재처리" — 모든 상태에서 파이프라인 (재)실행 가능.
            pg_cron Vault config 가 없을 때 수동 진행 + 이미 처리된 도서(ready/published) 재처리
            (예: 챕터 분할 수정 반영). 서버 라우트가 NODE_ENV='production' 차단.
            ⚠ published 재처리 시 dev-process 가 status='ready' 로 되돌려 재게시 필요. */}
        {process.env.NODE_ENV !== 'production' &&
          [
            'queued', 'ingesting', 'normalizing', 'segmenting', 'analyzing',
            'curating', 'failed', 'ready', 'published',
          ].includes(book.status) && (
            <>
              {/* 커밋 전 챕터 수 체크 — dry-run (쓰기 X) */}
              <ActionButton
                icon={<ListChecks size={12} />}
                label="검증 (dry-run)"
                pending={actionPending === 'dry-validate'}
                onClick={handleDryRun}
                tone="neutral"
              />
              <ActionButton
                icon={book.status === 'ready' || book.status === 'published' ? <RefreshCw size={12} /> : <Play size={12} />}
                label={book.status === 'ready' || book.status === 'published' ? '재처리 (dev)' : '지금 처리 (dev)'}
                pending={actionPending === 'dev-process'}
                onClick={() => runAction('dev-process', (id) => devProcessBook(id), { keepOpen: true })}
                tone="primary"
              />
            </>
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
        {book.status === 'published' && (
          <ActionButton
            icon={<Undo2 size={12} />}
            label="검토 대기로 되돌리기"
            pending={actionPending === 'revert'}
            onClick={() => setConfirmRevert(true)}
            tone="neutral"
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
        {(book.status === 'ready' || book.status === 'archived') && (
          <ActionButton
            icon={<Trash2 size={12} />}
            label="영구 삭제"
            pending={actionPending === 'delete'}
            onClick={() => setConfirmDelete(true)}
            tone="danger"
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

      {confirmRevert && (
        <RevertConfirmDialog
          title={book.title}
          pending={actionPending === 'revert'}
          onCancel={() => setConfirmRevert(false)}
          onConfirm={async () => {
            setConfirmRevert(false);
            await runAction('revert', async (id) => {
              await revertPublishedBook(createClient(), id);
            });
          }}
        />
      )}

      {confirmDelete && (
        <DeleteConfirmDialog
          title={book.title}
          status={book.status}
          pending={actionPending === 'delete'}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false);
            await runAction('delete', async (id) => {
              await deleteBook(createClient(), id);
            });
          }}
        />
      )}
    </ModalShell>
  );
}

function DeleteConfirmDialog({
  title,
  status,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  status: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  const required = '삭제';
  const canDelete = typed.trim() === required;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="w-full max-w-md rounded-[var(--r-lg)] border border-[var(--learn-error)] bg-[var(--bg)] p-5 shadow-[var(--sh-xl)]">
        <h3
          id="delete-confirm-title"
          className="font-display text-[15px] font-[700] text-[var(--learn-error)]"
        >
          영구 삭제 — 되돌릴 수 없음
        </h3>
        <p className="mt-2 font-body text-[13px] leading-relaxed text-[var(--t2)]">
          <strong className="text-[var(--t1)]">{title}</strong> (status:{' '}
          <code className="font-mono text-[12px]">{status}</code>) 도서를 데이터베이스에서
          완전히 삭제합니다.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 font-body text-[12px] text-[var(--t2)]">
          <li>책 본문 · 챕터 · vocabularies(<code className="font-mono text-[11px]">library_book_vocabularies</code>) 모두 CASCADE 삭제</li>
          <li>이전 게시 시 생성된 챕터 단어장(<code className="font-mono text-[11px]">shared_word_sets</code>)도 함께 정리</li>
          <li><code className="font-mono text-[11px]">library_seed_catalog</code> 의 imported 플래그 해제 → 같은 시드 재enqueue 가능</li>
          <li>사용자 학습 기록 · echo 세션 등은 SET NULL (보존)</li>
        </ul>
        <label className="mt-4 block">
          <span className="font-mono text-[11px] text-[var(--t3)]">
            확인을 위해 <strong className="text-[var(--learn-error)]">{required}</strong> 를 입력하세요
          </span>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={pending}
            autoFocus
            className="mt-1 h-9 w-full rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-body text-[13px] text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--learn-error)]"
            placeholder={required}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex min-h-[36px] items-center rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[12px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending || !canDelete}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--learn-error)] bg-[var(--learn-error)] px-4 font-display text-[12px] font-[600] text-[var(--ti)] hover:opacity-90 disabled:opacity-40"
          >
            {pending && <Loader2 size={12} className="animate-spin" aria-hidden />}
            영구 삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function RevertConfirmDialog({
  title,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revert-confirm-title"
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="w-full max-w-md rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-xl)]">
        <h3
          id="revert-confirm-title"
          className="font-display text-[15px] font-[700] text-[var(--t1)]"
        >
          검토 대기로 되돌릴까요?
        </h3>
        <p className="mt-2 font-body text-[13px] leading-relaxed text-[var(--t2)]">
          <strong className="text-[var(--t1)]">{title}</strong> 의 게시를 취소하고
          상태를 <code className="font-mono text-[12px]">ready</code> 로 바꿉니다.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 font-body text-[12px] text-[var(--t2)]">
          <li>게시 시 자동 생성된 챕터 단어장(<code className="font-mono text-[11px]">shared_word_sets</code>) 삭제</li>
          <li>해당 단어장 구독·단어 행은 FK CASCADE 로 함께 삭제</li>
          <li>책 본문·챕터·vocabularies 는 보존 — 재게시 시 단어장 자동 재생성</li>
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex min-h-[36px] items-center rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[12px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--learn-error)] bg-[var(--learn-error)] px-4 font-display text-[12px] font-[600] text-[var(--ti)] hover:opacity-90 disabled:opacity-50"
          >
            {pending && <Loader2 size={12} className="animate-spin" aria-hidden />}
            되돌리고 단어장 삭제
          </button>
        </div>
      </div>
    </div>
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

function DryRunResult({
  result,
  currentChapters,
}: {
  result: DevValidateResult;
  currentChapters: number | null;
}) {
  const tone =
    result.verdict === 'OK'
      ? { bg: 'var(--learn-known-light)', fg: 'var(--learn-known)', icon: '✅' }
      : result.verdict === 'FAIL'
        ? { bg: 'var(--learn-error-light)', fg: 'var(--learn-error)', icon: '⛔' }
        : { bg: 'var(--learn-review-light)', fg: 'var(--learn-review)', icon: '⚠' };
  const now = result.chapter_count ?? null;
  const changed = now != null && currentChapters != null && now !== currentChapters;
  return (
    <div className="border-t border-[var(--bd)] px-5 py-3" style={{ background: tone.bg }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]" style={{ color: tone.fg }}>
        <span className="font-[700]">{tone.icon} dry-run: {result.verdict}</span>
        <span>
          예상 챕터 <strong>{now ?? '—'}</strong>
          {currentChapters != null && (
            <span className="opacity-70"> (현재 {currentChapters}{changed ? ' →' : ' ='}{changed ? ` ${now}` : ''})</span>
          )}
        </span>
        {result.avg_chapter_words != null && <span className="opacity-70">avg {result.avg_chapter_words}w</span>}
        {result.length_cv != null && <span className="opacity-70">CV {result.length_cv}</span>}
      </div>
      {result.warnings.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {result.warnings.map((w, i) => (
            <li key={i} className="font-body text-[11px]" style={{ color: tone.fg }}>· {w}</li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 font-body text-[10px] text-[var(--t3)]">
        ↑ 검증만 한 결과입니다 (DB 미반영). 정상이면 “재처리 (dev)”로 커밋하세요.
      </p>
    </div>
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
  tone: 'primary' | 'neutral' | 'danger';
}) {
  const cls =
    tone === 'primary'
      ? 'bg-[var(--p)] hover:bg-[var(--p-hover)] text-[var(--ti)]'
      : tone === 'danger'
        ? 'border border-[var(--learn-error)] bg-[var(--learn-error-light)] hover:bg-[var(--learn-error)] hover:text-[var(--ti)] text-[var(--learn-error)]'
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
