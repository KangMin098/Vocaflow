// apps/web/src/components/admin/curation/SeedTab.tsx
// LCP v2.0 — 추천 시드 LIST 뷰 (Tab 2)
// - 결과: 리스트 행 (BulkFetchTab 정합 — cover swatch · 제목 · 저자 · 칩 · 선택)
// - 조회조건: 소스에 맞게 동적 (소스 선택 시 장르/CEFR 옵션을 그 소스 실데이터로 좁힘)

'use client';

import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Plus } from 'lucide-react';
import seedDataRaw from '@vocaflow/library-pipeline/seed/curated-seed.json';
import type {
  BookStatus,
  LibraryBookAdminRow,
} from '@/lib/library/admin-queries';
import { classifyStatus } from '@/lib/library/admin-queries';
import type { SeedItem } from './SeedCard';

const SEED_DATA = seedDataRaw as SeedItem[];

type StatusFilter = 'all' | 'available' | 'added';

const SOURCE_LABEL: Record<string, string> = {
  gutenberg: 'Project Gutenberg',
  standard_ebooks: 'Standard Ebooks',
  wikibooks: 'Wikibooks',
  wikisource: 'Wikisource',
};
const SOURCE_COLOR: Record<string, string> = {
  gutenberg: 'var(--p)',
  standard_ebooks: 'var(--learn-known)',
  wikibooks: 'var(--info)',
  wikisource: 'var(--active)',
};
const GENRE_LABEL: Record<string, string> = {
  novel: '소설',
  'short-stories': '단편',
  essay: '에세이',
  poetry: '시',
  textbook: '교재',
  reference: '참고서',
};
const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

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
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [genreFilter, setGenreFilter] = useState<string>('all');
  const [cefrFilter, setCefrFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const statusMap = useMemo(() => {
    const map = new Map<string, BookStatus>();
    for (const b of existingBooks) {
      if (b.source_id) map.set(statusKey(b.source, b.source_id), b.status);
    }
    return map;
  }, [existingBooks]);

  // 시드에 실제 존재하는 소스만 노출 (librivox 등 미포함 — 데이터 기반)
  const sourceOptions = useMemo(() => {
    const present = [...new Set(SEED_DATA.map((s) => s.source))];
    return present.sort((a, b) => a.localeCompare(b));
  }, []);

  // 선택된 소스에 맞는 장르 옵션 (소스에 맞게)
  const genreOptions = useMemo(() => {
    const scoped = SEED_DATA.filter(
      (s) => sourceFilter === 'all' || s.source === sourceFilter,
    );
    const present = new Set(scoped.map((s) => s.genre));
    return Object.keys(GENRE_LABEL).filter((g) => present.has(g as SeedItem['genre']));
  }, [sourceFilter]);

  // 선택된 소스에 맞는 CEFR 옵션 (소스에 맞게)
  const cefrOptions = useMemo(() => {
    const scoped = SEED_DATA.filter(
      (s) => sourceFilter === 'all' || s.source === sourceFilter,
    );
    const present = new Set(scoped.map((s) => s.estimated_cefr));
    return CEFR_ORDER.filter((c) => present.has(c as SeedItem['estimated_cefr']));
  }, [sourceFilter]);

  // 소스 변경 시 하위 필터가 새 소스에 없는 값이면 자동 초기화 (0건 조합 방지)
  function handleSourceChange(next: string) {
    setSourceFilter(next);
    const scoped = SEED_DATA.filter((s) => next === 'all' || s.source === next);
    if (genreFilter !== 'all' && !scoped.some((s) => s.genre === genreFilter)) {
      setGenreFilter('all');
    }
    if (cefrFilter !== 'all' && !scoped.some((s) => s.estimated_cefr === cefrFilter)) {
      setCefrFilter('all');
    }
  }

  const visibleSeeds = useMemo(() => {
    return SEED_DATA.filter((seed) => {
      if (sourceFilter !== 'all' && seed.source !== sourceFilter) return false;
      if (genreFilter !== 'all' && seed.genre !== genreFilter) return false;
      if (cefrFilter !== 'all' && seed.estimated_cefr !== cefrFilter) return false;
      const isAdded = statusMap.has(statusKey(seed.source, seed.source_id));
      if (statusFilter === 'available' && isAdded) return false;
      if (statusFilter === 'added' && !isAdded) return false;
      return true;
    });
  }, [sourceFilter, genreFilter, cefrFilter, statusFilter, statusMap]);

  return (
    <section className="flex flex-col gap-4" aria-label="추천 시드">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">🎯 추천 시드</h2>
        <span className="font-mono text-[12px] text-[var(--t2)]">
          {visibleSeeds.length === SEED_DATA.length
            ? `${SEED_DATA.length}권`
            : `${visibleSeeds.length} / ${SEED_DATA.length}권`}
        </span>
      </div>

      {/* 조회조건 — 소스에 맞게 (소스 선택 → 장르/CEFR 옵션이 해당 소스로 좁혀짐) */}
      <div className="flex flex-wrap items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2">
        <FilterSelect
          label="소스"
          value={sourceFilter}
          onChange={handleSourceChange}
          options={[
            { value: 'all', label: '전체' },
            ...sourceOptions.map((s) => ({ value: s, label: SOURCE_LABEL[s] ?? s })),
          ]}
        />
        <FilterSelect
          label="장르"
          value={genreFilter}
          onChange={setGenreFilter}
          options={[
            { value: 'all', label: '전체' },
            ...genreOptions.map((g) => ({ value: g, label: GENRE_LABEL[g] ?? g })),
          ]}
        />
        <FilterSelect
          label="CEFR"
          value={cefrFilter}
          onChange={setCefrFilter}
          options={[{ value: 'all', label: '전체' }, ...cefrOptions.map((c) => ({ value: c, label: c }))]}
        />
        <FilterSelect
          label="상태"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
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
            setSourceFilter('all');
            setGenreFilter('all');
            setCefrFilter('all');
            setStatusFilter('all');
          }}
        />
      ) : (
        <ul role="list" className="divide-y divide-[var(--bd)] overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)]">
          {visibleSeeds.map((seed) => (
            <SeedRow
              key={`${seed.source}-${seed.source_id}`}
              seed={seed}
              status={statusMap.get(statusKey(seed.source, seed.source_id))}
              onSelect={() => onPickSeed(seed)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────
// Sub: List row
// ─────────────────────────────────────────────

function SeedRow({
  seed,
  status,
  onSelect,
}: {
  seed: SeedItem;
  status?: BookStatus;
  onSelect: () => void;
}) {
  const isAdded = status !== undefined;
  const statusInfo = status ? classifyStatus(status) : null;
  const color = SOURCE_COLOR[seed.source] ?? 'var(--t3)';

  return (
    <li className="flex items-start gap-3 p-3">
      {/* mini cover swatch (3:4) — 소스 색 틴트 + CEFR */}
      <div
        className="flex h-16 w-12 shrink-0 flex-col items-center justify-center rounded-[var(--r-sm)] border border-[var(--bd)]"
        style={{ background: `color-mix(in srgb, ${color} 12%, var(--bg2))` }}
        aria-hidden
      >
        <BookOpen size={14} style={{ color }} />
        <span className="mt-1 font-mono text-[10px] font-[700]" style={{ color }}>
          {seed.estimated_cefr}
        </span>
      </div>

      {/* 본문 정보 */}
      <div className="min-w-0 flex-1">
        <div className="truncate font-english text-[14px] font-[600] text-[var(--t1)]">
          {seed.title}
        </div>
        <div className="truncate font-english text-[11px] italic text-[var(--t2)]">
          {seed.author}
          {seed.author_birth_year != null && seed.author_death_year != null && (
            <span className="ml-1.5 font-mono text-[10px] not-italic text-[var(--t2)]">
              {formatYear(seed.author_birth_year)}–{formatYear(seed.author_death_year)}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[9px] font-[700]"
            style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
          >
            {SOURCE_LABEL[seed.source] ?? seed.source}
          </span>
          <Chip>{GENRE_LABEL[seed.genre] ?? seed.genre}</Chip>
          <span className="font-mono text-[9px] text-[var(--t2)]">id {seed.source_id}</span>
          {seed.tags?.slice(0, 3).map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-mono text-[9px] text-[var(--t2)]"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* 액션 — 추가됨이면 상태, 아니면 선택 */}
      <div className="shrink-0">
        {isAdded && statusInfo ? (
          <StatusBadge tone={statusInfo.tone} label={statusInfo.label} />
        ) : (
          <button
            type="button"
            onClick={onSelect}
            className="inline-flex h-8 items-center gap-1 rounded-[var(--r-sm)] border border-[var(--p)] bg-[var(--p)] px-2.5 font-display text-[11px] font-[600] text-[var(--on-p)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <Plus size={11} /> 선택
          </button>
        )}
      </div>
    </li>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-2 py-0.5 font-mono text-[9px] text-[var(--t2)]">
      {children}
    </span>
  );
}

function StatusBadge({
  tone,
  label,
}: {
  tone: 'success' | 'warning' | 'info' | 'danger' | 'neutral';
  label: string;
}) {
  const c: Record<typeof tone, { bg: string; fg: string }> = {
    success: { bg: 'var(--learn-known-light)', fg: 'var(--learn-known)' },
    warning: { bg: 'var(--learn-review-light)', fg: 'var(--learn-review)' },
    info: { bg: 'var(--learn-fresh-light)', fg: 'var(--learn-fresh)' },
    danger: { bg: 'var(--learn-error-light)', fg: 'var(--learn-error)' },
    neutral: { bg: 'var(--bg2)', fg: 'var(--t3)' },
  } as const;
  const s = c[tone];
  return (
    <span
      className="inline-flex h-8 items-center gap-1 rounded-[var(--r-sm)] px-2.5 font-mono text-[10px] font-[700]"
      style={{ background: s.bg, color: s.fg }}
    >
      <CheckCircle2 size={11} /> {label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Sub: Filter select
// ─────────────────────────────────────────────

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[11px] text-[var(--t2)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

function formatYear(year: number): string {
  return year < 0 ? `BC ${-year}` : `${year}`;
}
