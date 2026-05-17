// apps/web/src/components/admin/curation/SeedCard.tsx
// LCP v2.0 Phase 12 단계 7 — 추천 시드 책 카드

'use client';

import type { BookStatus } from '@/lib/library/admin-queries';
import { classifyStatus } from '@/lib/library/admin-queries';

export interface SeedItem {
  source: string;
  source_id: string;
  title: string;
  author: string;
  author_birth_year: number;
  author_death_year: number;
  license: string;
  estimated_cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  genre: 'novel' | 'short-stories' | 'essay' | 'poetry';
  tags: string[];
}

interface SeedCardProps {
  seed: SeedItem;
  /** library_books에 이미 있는 경우의 status. 미존재면 undefined. */
  status?: BookStatus;
  onSelect: () => void;
}

const GENRE_LABEL: Record<SeedItem['genre'], string> = {
  novel: '소설',
  'short-stories': '단편',
  essay: '에세이',
  poetry: '시',
};

const CEFR_TONE: Record<SeedItem['estimated_cefr'], string> = {
  A1: 'var(--cefr-A1-bg)',
  A2: 'var(--cefr-A2-bg)',
  B1: 'var(--cefr-B1-bg)',
  B2: 'var(--cefr-B2-bg)',
  C1: 'var(--cefr-C1-bg)',
  C2: 'var(--cefr-C2-bg)',
};

const CEFR_TEXT: Record<SeedItem['estimated_cefr'], string> = {
  A1: 'var(--cefr-A1-text)',
  A2: 'var(--cefr-A2-text)',
  B1: 'var(--cefr-B1-text)',
  B2: 'var(--cefr-B2-text)',
  C1: 'var(--cefr-C1-text)',
  C2: 'var(--cefr-C2-text)',
};

type StatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

export function SeedCard({ seed, status, onSelect }: SeedCardProps) {
  const isAdded = status !== undefined;
  const statusInfo = status ? classifyStatus(status) : null;

  return (
    <article
      className={[
        'group flex flex-col overflow-hidden',
        'rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)]',
        'shadow-[var(--sh-sm)]',
        'transition-all duration-[var(--dur-normal)] ease-[var(--ease)]',
        !isAdded && 'hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="px-4 pb-2 pt-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-display text-[14px] font-[700] text-[var(--t1)]">
            {seed.title}
          </h3>
          <CefrBadge level={seed.estimated_cefr} />
        </div>
        <p className="line-clamp-1 font-body text-[11px] text-[var(--t3)]">
          {seed.author} ({formatYear(seed.author_birth_year)}–{formatYear(seed.author_death_year)})
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-2 px-4 pb-3">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] font-[600] text-[var(--t2)]">
            {GENRE_LABEL[seed.genre]}
          </span>
          <span className="text-[var(--t5)]" aria-hidden>
            ·
          </span>
          <span className="font-mono text-[10px] text-[var(--t3)]">
            ID {seed.source_id}
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {seed.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-[var(--r-sm)] bg-[var(--bg2)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--t3)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <footer className="border-t border-[var(--bd)] px-4 py-2.5">
        {isAdded && statusInfo ? (
          <StatusBadge tone={statusInfo.tone} label={statusInfo.label} />
        ) : (
          <button
            type="button"
            onClick={onSelect}
            className={[
              'min-h-[32px] w-full rounded-[var(--r-sm)]',
              'bg-[var(--p)] hover:bg-[var(--p-hover)]',
              'px-3 font-display text-[11px] font-[600] text-[var(--ti)]',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2',
            ].join(' ')}
          >
            ➕ 큐에 추가
          </button>
        )}
      </footer>
    </article>
  );
}

function CefrBadge({ level }: { level: SeedItem['estimated_cefr'] }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[var(--r-sm)] px-1.5 py-0.5 font-mono text-[10px] font-[700]"
      style={{
        backgroundColor: CEFR_TONE[level],
        color: CEFR_TEXT[level],
      }}
      aria-label={`예상 CEFR 레벨 ${level}`}
    >
      {level}
    </span>
  );
}

function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  const colorMap: Record<StatusTone, { bg: string; text: string }> = {
    success: { bg: 'var(--learn-known-light)', text: 'var(--learn-known)' },
    warning: { bg: 'var(--learn-review-light)', text: 'var(--learn-review)' },
    info: { bg: 'var(--learn-fresh-light)', text: 'var(--learn-fresh)' },
    danger: { bg: 'var(--learn-error-light)', text: 'var(--learn-error)' },
    neutral: { bg: 'var(--bg2)', text: 'var(--t3)' },
  };
  const { bg, text } = colorMap[tone];

  return (
    <div
      className="flex min-h-[32px] items-center justify-center rounded-[var(--r-sm)] px-3 font-display text-[11px] font-[600]"
      style={{ backgroundColor: bg, color: text }}
      role="status"
    >
      ✓ {label}
    </div>
  );
}

function formatYear(year: number): string {
  return year < 0 ? `BC ${-year}` : `${year}`;
}
