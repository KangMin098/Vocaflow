// apps/web/src/components/admin/curation/MyLibraryTab.tsx
// LCP v2.0 Phase 12 묶음 C — Curated Books 테이블 (Tab 4)

'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  classifyStatus,
  type BookStatus,
  type LibraryBookAdminRow,
} from '@/lib/library/admin-queries';
import { BookDetailModal } from './BookDetailModal';

type StatusFilter = 'all' | 'in_progress' | 'ready' | 'published' | 'failed' | 'archived';
type SourceFilter = 'all' | string;
type ToneKey = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

interface MyLibraryTabProps {
  books: LibraryBookAdminRow[];
  onRefetch: () => void;
}

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'in_progress', label: '처리 중' },
  { value: 'ready', label: '검토 대기' },
  { value: 'published', label: '게시됨' },
  { value: 'failed', label: '실패' },
  { value: 'archived', label: '보관됨' },
];

const IN_PROGRESS_STATUSES: BookStatus[] = [
  'queued', 'ingesting', 'normalizing', 'segmenting', 'analyzing', 'curating',
];

/** Source tier label — CLAUDE.md v06.29 §"라이브러리 도서 난이도 지수" §Source-Aware Confidence */
const SOURCE_TIER: Record<string, 'S' | 'A' | 'B' | 'C' | 'M'> = {
  standard_ebooks: 'S', openstax: 'S', voa_learning: 'S',
  wikibooks: 'A', wikisource: 'A',
  gutenberg: 'B', librivox: 'B',
  open_library: 'C', hathitrust: 'C',
  manual: 'M',
};

export function MyLibraryTab({ books, onRefetch }: MyLibraryTabProps) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [selectedBook, setSelectedBook] = useState<LibraryBookAdminRow | null>(null);

  /** 실제 데이터에 등장한 source 목록 (count 포함) */
  const sourceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of books) counts.set(b.source, (counts.get(b.source) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count }));
  }, [books]);

  const visible = useMemo(() => {
    let list = books;
    if (sourceFilter !== 'all') {
      list = list.filter((b) => b.source === sourceFilter);
    }
    if (filter === 'all') return list;
    if (filter === 'in_progress') {
      return list.filter((b) => IN_PROGRESS_STATUSES.includes(b.status));
    }
    return list.filter((b) => b.status === (filter as BookStatus));
  }, [books, filter, sourceFilter]);

  return (
    <section className="flex flex-col gap-4" aria-label="Curated Books">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            📂 Curated Books
          </h2>
          <span className="font-mono text-[12px] text-[var(--t3)]">
            {visible.length === books.length
              ? `${books.length}권`
              : `${visible.length} / ${books.length}권`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Source filter — sources sorted by count, only shows actual data */}
          {sourceOptions.length > 1 && (
            <div
              role="radiogroup"
              aria-label="소스 필터"
              className="inline-flex flex-wrap rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-0.5"
            >
              <FilterChip
                label="전체"
                count={books.length}
                active={sourceFilter === 'all'}
                onClick={() => setSourceFilter('all')}
              />
              {sourceOptions.map(({ source, count }) => {
                const tier = SOURCE_TIER[source];
                return (
                  <FilterChip
                    key={source}
                    label={source}
                    badge={tier ? `T${tier}` : undefined}
                    count={count}
                    active={sourceFilter === source}
                    onClick={() => setSourceFilter(source)}
                  />
                );
              })}
            </div>
          )}

          {/* Status filter */}
          <div
            role="radiogroup"
            aria-label="상태 필터"
            className="inline-flex flex-wrap rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-0.5"
          >
            {FILTER_OPTIONS.map((opt) => {
              const active = opt.value === filter;
              const count =
                opt.value === 'all'
                  ? books.length
                  : opt.value === 'in_progress'
                    ? books.filter((b) => IN_PROGRESS_STATUSES.includes(b.status)).length
                    : books.filter((b) => b.status === (opt.value as BookStatus)).length;
              return (
                <FilterChip
                  key={opt.value}
                  label={opt.label}
                  count={count}
                  active={active}
                  onClick={() => setFilter(opt.value)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        books.length === 0 ? <EmptyAll /> : <EmptyFiltered onReset={() => setFilter('all')} />
      ) : (
        <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--bd)]">
          <table className="w-full min-w-[1000px]">
            <thead className="border-b border-[var(--bd)] bg-[var(--bg2)]">
              <tr>
                <Th>제목</Th>
                <Th>저자</Th>
                <Th align="center">상태</Th>
                <Th align="center" title="CEFR 6-band (cefr_band — V-Level centroid 자동 파생)">CEFR</Th>
                <Th align="center" title="V-Level (p75) · 정밀 centroid">V · Cent</Th>
                <Th align="center" title="CEFR-J 12-band (internal heuristic) · confidence">CEFR-J</Th>
                <Th align="center" title="Flesch-Kincaid Grade Level">F-K</Th>
                <Th align="right">단어</Th>
                <Th align="right">갱신</Th>
                <Th align="center" srOnly>
                  상세
                </Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((book) => (
                <BookRow
                  key={book.id}
                  book={book}
                  onClick={() => setSelectedBook(book)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BookDetailModal
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
        onChanged={onRefetch}
      />
    </section>
  );
}

// ─────────────────────────────────────────────
// Sub: Row
// ─────────────────────────────────────────────

function BookRow({
  book,
  onClick,
}: {
  book: LibraryBookAdminRow;
  onClick: () => void;
}) {
  const statusInfo = classifyStatus(book.status);

  return (
    <tr
      className="border-t border-[var(--bd)] cursor-pointer transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] focus-within:bg-[var(--bg2)]"
      onClick={onClick}
    >
      <Td>
        <button
          type="button"
          onClick={onClick}
          className="text-left line-clamp-1 font-display text-[13px] font-[600] text-[var(--t1)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:rounded-[var(--r-sm)]"
        >
          {book.title}
        </button>
      </Td>
      <Td>
        <span className="line-clamp-1 font-body text-[12px] text-[var(--t3)]">
          {book.author ?? '—'}
        </span>
      </Td>
      <Td align="center">
        <StatusPill tone={statusInfo.tone} label={statusInfo.label} />
      </Td>
      <Td align="center">
        <span className="font-mono text-[11px] tabular-nums text-[var(--t1)]">
          {book.cefr_band ?? '—'}
        </span>
      </Td>
      <Td align="center">
        <div className="flex flex-col items-center leading-tight">
          <span className="font-display text-[12px] font-[700] tabular-nums text-[var(--t1)]">
            {book.book_v_level != null ? `V${book.book_v_level}` : '—'}
          </span>
          {book.v_level_centroid_precise && (
            <span className="font-mono text-[10px] tabular-nums text-[var(--t3)]">
              {book.v_level_centroid_precise}
            </span>
          )}
        </div>
      </Td>
      <Td align="center">
        <div className="flex flex-col items-center leading-tight">
          <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
            {book.cefrj_level ?? '—'}
          </span>
          {book.cefrj_confidence && (
            <span
              className="font-mono text-[10px] tabular-nums"
              style={{ color: confidenceColor(parseFloat(book.cefrj_confidence)) }}
              title="자동 부여 confidence (소스 tier × coverage)"
            >
              {book.cefrj_confidence}
            </span>
          )}
        </div>
      </Td>
      <Td align="center">
        <span
          className="font-mono text-[11px] tabular-nums text-[var(--t2)]"
          title={
            book.flesch_reading_ease
              ? `Reading Ease ${book.flesch_reading_ease}`
              : 'Flesch-Kincaid Grade Level'
          }
        >
          {book.flesch_kincaid_grade ?? '—'}
        </span>
      </Td>
      <Td align="right">
        <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
          {book.word_count?.toLocaleString() ?? '—'}
        </span>
      </Td>
      <Td align="right">
        <span className="font-mono text-[11px] text-[var(--t3)]">
          {formatRelative(book.updated_at)}
        </span>
      </Td>
      <Td align="center">
        <ChevronRight size={14} className="text-[var(--t3)]" aria-hidden />
      </Td>
    </tr>
  );
}

/** confidence 색: ≥0.85 success / ≥0.70 default / <0.70 warning */
function confidenceColor(c: number): string {
  if (c >= 0.85) return 'var(--success)';
  if (c >= 0.7) return 'var(--t3)';
  return 'var(--warning)';
}

function FilterChip({
  label,
  badge,
  count,
  active,
  onClick,
}: {
  label: string;
  badge?: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={[
        'rounded-[var(--r-sm)] px-3 py-1 inline-flex items-center gap-1',
        'font-display text-[11px] font-[600]',
        'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
        active
          ? 'bg-[var(--bg)] text-[var(--t1)] shadow-[var(--sh-xs)]'
          : 'text-[var(--t3)] hover:text-[var(--t2)]',
      ].join(' ')}
    >
      {badge && (
        <span
          className="rounded-[var(--r-sm)] bg-[var(--bg3)] px-1 font-mono text-[9px] font-[700] text-[var(--t2)]"
          aria-label={`tier ${badge}`}
        >
          {badge}
        </span>
      )}
      {label}
      {count > 0 && (
        <span className="font-mono text-[10px] text-[var(--t3)]">{count}</span>
      )}
    </button>
  );
}

function Th({
  children,
  align = 'left',
  srOnly,
  title,
}: {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  srOnly?: boolean;
  title?: string;
}) {
  return (
    <th
      className={[
        'px-3 py-2',
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
        'font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]',
        title ? 'cursor-help' : '',
      ].join(' ')}
      scope="col"
      title={title}
    >
      {srOnly ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <td
      className={[
        'px-3 py-2.5',
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
      ].join(' ')}
    >
      {children}
    </td>
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
      className="inline-flex items-center rounded-[var(--r-sm)] px-2 py-0.5 font-display text-[10px] font-[700]"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

function EmptyAll() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-16 text-center"
    >
      <div className="select-none text-3xl" aria-hidden>📭</div>
      <h3 className="font-display text-[15px] font-[700] text-[var(--t1)]">
        아직 등록된 책이 없습니다
      </h3>
      <p className="font-body text-[12px] text-[var(--t3)]">
        추천 시드 또는 ID 입력 탭에서 책을 큐에 추가하세요.
      </p>
    </div>
  );
}

function EmptyFiltered({ onReset }: { onReset: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center"
    >
      <div className="select-none text-2xl" aria-hidden>🔍</div>
      <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">
        필터에 해당하는 책이 없습니다
      </h3>
      <button
        type="button"
        onClick={onReset}
        className="mt-1 rounded-[var(--r-sm)] bg-[var(--p)] px-3 py-1.5 font-display text-[11px] font-[600] text-[var(--ti)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
      >
        필터 초기화
      </button>
    </div>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}일 전`;
  if (hr > 0) return `${hr}시간 전`;
  if (min > 0) return `${min}분 전`;
  return '방금';
}
