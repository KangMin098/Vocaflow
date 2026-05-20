// apps/web/src/components/admin/curation/SeedTab.tsx
// LCP v2.0 Phase 12 단계 8 — 추천 시드 50권 그리드 (Tab 2)

'use client';

import { useMemo, useState } from 'react';
import seedDataRaw from '@vocaflow/library-pipeline/seed/curated-seed.json';
import type {
  BookStatus,
  LibraryBookAdminRow,
} from '@/lib/library/admin-queries';
import { SeedCard, type SeedItem } from './SeedCard';

const SEED_DATA = seedDataRaw as SeedItem[];

type CefrFilter = 'all' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
type GenreFilter =
  | 'all'
  | 'novel'
  | 'short-stories'
  | 'essay'
  | 'poetry'
  | 'textbook'
  | 'reference';
type StatusFilter = 'all' | 'available' | 'added';
type SourceFilter = 'all' | 'gutenberg' | 'standard_ebooks' | 'wikibooks';

interface SeedTabProps {
  /** library_books 의 모든 row (source + source_id 복합키로 매칭) */
  existingBooks: LibraryBookAdminRow[];
  onPickSeed: (seed: SeedItem) => void;
}

/** Map key: `${source}::${source_id}` — gutenberg 와 standard_ebooks 시드 충돌 회피 */
function statusKey(source: string, sourceId: string): string {
  return `${source}::${sourceId}`;
}

export function SeedTab({ existingBooks, onPickSeed }: SeedTabProps) {
  const [cefrFilter, setCefrFilter] = useState<CefrFilter>('all');
  const [genreFilter, setGenreFilter] = useState<GenreFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  const statusMap = useMemo(() => {
    const map = new Map<string, BookStatus>();
    for (const b of existingBooks) {
      if (b.source_id) {
        map.set(statusKey(b.source, b.source_id), b.status);
      }
    }
    return map;
  }, [existingBooks]);

  const visibleSeeds = useMemo(() => {
    return SEED_DATA.filter((seed) => {
      if (cefrFilter !== 'all' && seed.estimated_cefr !== cefrFilter) return false;
      if (genreFilter !== 'all' && seed.genre !== genreFilter) return false;
      if (sourceFilter !== 'all' && seed.source !== sourceFilter) return false;
      const isAdded = statusMap.has(statusKey(seed.source, seed.source_id));
      if (statusFilter === 'available' && isAdded) return false;
      if (statusFilter === 'added' && !isAdded) return false;
      return true;
    });
  }, [cefrFilter, genreFilter, statusFilter, sourceFilter, statusMap]);

  return (
    <section
      className="flex flex-col gap-4"
      aria-label="추천 시드 50권"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            🎯 추천 시드
          </h2>
          <span className="font-mono text-[12px] text-[var(--t3)]">
            {visibleSeeds.length === SEED_DATA.length
              ? `${SEED_DATA.length}권`
              : `${visibleSeeds.length} / ${SEED_DATA.length}권`}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2">
        <FilterSelect
          label="소스"
          value={sourceFilter}
          onChange={setSourceFilter}
          options={[
            { value: 'all', label: '전체' },
            { value: 'gutenberg', label: 'Gutenberg' },
            { value: 'standard_ebooks', label: 'Standard Ebooks' },
            { value: 'wikibooks', label: 'Wikibooks' },
          ]}
        />
        <FilterSelect
          label="CEFR"
          value={cefrFilter}
          onChange={setCefrFilter}
          options={[
            { value: 'all', label: '전체' },
            { value: 'A1', label: 'A1' },
            { value: 'A2', label: 'A2' },
            { value: 'B1', label: 'B1' },
            { value: 'B2', label: 'B2' },
            { value: 'C1', label: 'C1' },
            { value: 'C2', label: 'C2' },
          ]}
        />
        <FilterSelect
          label="장르"
          value={genreFilter}
          onChange={setGenreFilter}
          options={[
            { value: 'all', label: '전체' },
            { value: 'novel', label: '소설' },
            { value: 'short-stories', label: '단편' },
            { value: 'essay', label: '에세이' },
            { value: 'poetry', label: '시' },
            { value: 'textbook', label: '교재' },
            { value: 'reference', label: '참고서' },
          ]}
        />
        <FilterSelect
          label="상태"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: '전체' },
            { value: 'available', label: '추가 가능' },
            { value: 'added', label: '처리 중/완료' },
          ]}
        />
      </div>

      {visibleSeeds.length === 0 ? (
        <FilteredEmptyState
          onReset={() => {
            setCefrFilter('all');
            setGenreFilter('all');
            setStatusFilter('all');
          }}
        />
      ) : (
        <div
          role="list"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {visibleSeeds.map((seed) => (
            <div role="listitem" key={`${seed.source}-${seed.source_id}`}>
              <SeedCard
                seed={seed}
                status={statusMap.get(statusKey(seed.source, seed.source_id))}
                onSelect={() => onPickSeed(seed)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────
// Sub: Filter select
// ─────────────────────────────────────────────

interface FilterSelectProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: FilterSelectProps<T>) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[11px] text-[var(--t3)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={[
          'rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)]',
          'px-2 py-1 pr-7',
          'font-display text-[11px] font-[600] text-[var(--t1)]',
          'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
          'hover:border-[var(--t3)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
          'cursor-pointer',
        ].join(' ')}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─────────────────────────────────────────────
// Sub: Empty state
// ─────────────────────────────────────────────

function FilteredEmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center"
      role="status"
    >
      <div className="select-none text-2xl" aria-hidden>
        🔍
      </div>
      <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">
        필터에 해당하는 책이 없습니다
      </h3>
      <button
        type="button"
        onClick={onReset}
        className={[
          'mt-1 rounded-[var(--r-sm)] px-3 py-1.5',
          'bg-[var(--p)] hover:bg-[var(--p-hover)]',
          'font-display text-[11px] font-[600] text-[var(--ti)]',
          'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2',
        ].join(' ')}
      >
        필터 초기화
      </button>
    </div>
  );
}
