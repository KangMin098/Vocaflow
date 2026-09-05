// apps/web/src/components/admin/curation/SourceCatalogTab.tsx
// LCP v2.0 Phase 12 단계 6 — 9 소스 카탈로그 비교 그리드 (Tab 1)

'use client';

import { useMemo, useState } from 'react';
import type { SourceCatalog } from '@/lib/library/admin-queries';
import { SourceCard } from './SourceCard';

type SortMode = 'composite' | 'implemented' | 'volume';
type FilterMode = 'all' | 'implemented';

interface SourceCatalogTabProps {
  catalogs: SourceCatalog[];
  /** is_implemented=true 카드 클릭 시 호출. source code (예: 'gutenberg') 전달. */
  onSelectSource: (source: string) => void;
}

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: 'composite', label: '종합 점수 ↓' },
  { value: 'implemented', label: '구현 우선' },
  { value: 'volume', label: '규모 ↓' },
];

const FILTER_OPTIONS: Array<{ value: FilterMode; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'implemented', label: '구현됨만' },
];

export function SourceCatalogTab({
  catalogs,
  onSelectSource,
}: SourceCatalogTabProps) {
  const [sortMode, setSortMode] = useState<SortMode>('composite');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const visibleCatalogs = useMemo(() => {
    let list = [...catalogs];

    if (filterMode === 'implemented') {
      list = list.filter((c) => c.is_implemented);
    }

    if (sortMode === 'composite') {
      list.sort((a, b) => b.composite_score - a.composite_score);
    } else if (sortMode === 'implemented') {
      list.sort((a, b) => {
        if (a.is_implemented !== b.is_implemented) {
          return a.is_implemented ? -1 : 1;
        }
        return b.composite_score - a.composite_score;
      });
    } else if (sortMode === 'volume') {
      list.sort((a, b) => {
        const sizeA = a.catalog_size ?? -1;
        const sizeB = b.catalog_size ?? -1;
        return sizeB - sizeA;
      });
    }

    return list;
  }, [catalogs, sortMode, filterMode]);

  if (catalogs.length === 0) {
    return <EmptyState />;
  }

  return (
    <section
      className="flex flex-col gap-4"
      aria-label="라이브러리 원천 카탈로그"
    >
      <Header
        total={catalogs.length}
        visible={visibleCatalogs.length}
        sortMode={sortMode}
        onSortChange={setSortMode}
        filterMode={filterMode}
        onFilterChange={setFilterMode}
      />

      {visibleCatalogs.length === 0 ? (
        <FilteredEmptyState onReset={() => setFilterMode('all')} />
      ) : (
        <div
          role="list"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {visibleCatalogs.map((catalog, index) => (
            <div role="listitem" key={catalog.id}>
              <SourceCard
                catalog={catalog}
                rank={index + 1}
                onActivate={
                  catalog.is_implemented
                    ? () => onSelectSource(catalog.source)
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────
// Sub: Header
// ─────────────────────────────────────────────

interface HeaderProps {
  total: number;
  visible: number;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  filterMode: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
}

function Header({
  total,
  visible,
  sortMode,
  onSortChange,
  filterMode,
  onFilterChange,
}: HeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
          📚 라이브러리 원천
        </h2>
        <span className="font-mono text-[12px] text-[var(--t2)]">
          {visible === total ? `${total}개 소스` : `${visible} / ${total}개 소스`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <SegmentedControl
          label="필터"
          options={FILTER_OPTIONS}
          value={filterMode}
          onChange={onFilterChange}
        />
        <SortSelect
          options={SORT_OPTIONS}
          value={sortMode}
          onChange={onSortChange}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub: Segmented control (필터)
// ─────────────────────────────────────────────

interface SegmentedControlProps<T extends string> {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="inline-flex rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-1"
      role="radiogroup"
      aria-label={label}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={[
              'min-h-[44px] rounded-[var(--r-sm)] px-3 py-1',
              'font-display text-[12px] font-[600]',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
              active
                ? 'bg-[var(--bg)] text-[var(--t1)] shadow-[var(--sh-xs)]'
                : 'text-[var(--t2)] hover:text-[var(--t2)]',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub: Sort select
// ─────────────────────────────────────────────

interface SortSelectProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}

function SortSelect<T extends string>({
  options,
  value,
  onChange,
}: SortSelectProps<T>) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="font-mono text-[11px] text-[var(--t2)]">정렬</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={[
          'min-h-[44px] rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)]',
          'px-3 py-1 pr-7',
          'font-display text-[12px] font-[600] text-[var(--t1)]',
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
// Sub: Empty states
// ─────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-16 text-center"
      role="status"
    >
      <div className="text-3xl select-none" aria-hidden>
        📭
      </div>
      <h3 className="font-display text-[15px] font-[700] text-[var(--t1)]">
        등록된 소스가 없습니다
      </h3>
      <p className="font-body text-[12px] text-[var(--t2)]">
        Supabase 마이그레이션이 정상 적용되었는지 확인해 주세요.
      </p>
    </div>
  );
}

function FilteredEmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center"
      role="status"
    >
      <div className="text-2xl select-none" aria-hidden>
        🔍
      </div>
      <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">
        필터에 해당하는 소스가 없습니다
      </h3>
      <button
        type="button"
        onClick={onReset}
        className={[
          'min-h-[44px] mt-1 rounded-[var(--r-sm)] px-3 py-2',
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
