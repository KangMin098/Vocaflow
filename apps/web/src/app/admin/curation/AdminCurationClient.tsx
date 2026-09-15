// apps/web/src/app/admin/curation/AdminCurationClient.tsx
// LCP v2.0 Phase 12 묶음 D — 4탭 통합 클라이언트 컴포넌트

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, FolderOpen, GraduationCap, Globe, Hash, Library, ScrollText, Download, Palette } from 'lucide-react';
import type {
  CurationStats,
  LibraryBookAdminRow,
  SourceCatalog,
} from '@/lib/library/admin-queries';
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp';
import { SourceCatalogTab } from '@/components/admin/curation/SourceCatalogTab';
import { SeedTab } from '@/components/admin/curation/SeedTab';
import { BulkFetchTab } from '@/components/admin/curation/BulkFetchTab';
import { GutenbergIdTab } from '@/components/admin/curation/GutenbergIdTab';
import { WikibooksIdTab } from '@/components/admin/curation/WikibooksIdTab';
import { WikisourceIdTab } from '@/components/admin/curation/WikisourceIdTab';
import { OpenStaxIdTab } from '@/components/admin/curation/OpenStaxIdTab';
import { StoryWeaverIdTab } from '@/components/admin/curation/StoryWeaverIdTab';
import { MyLibraryTab } from '@/components/admin/curation/MyLibraryTab';
import {
  EnqueueModal,
  type EnqueueSource,
} from '@/components/admin/curation/EnqueueModal';
import type { SeedItem } from '@/components/admin/curation/SeedCard';
import type { GutenbergPreview } from '@/components/admin/curation/GutenbergIdTab';
import type { WikibooksPreview } from '@/components/admin/curation/WikibooksIdTab';
import type { WikisourcePreview } from '@/components/admin/curation/WikisourceIdTab';
import type { OpenStaxPreview } from '@/components/admin/curation/OpenStaxIdTab';
import type { StoryWeaverPreview } from '@/components/admin/curation/StoryWeaverIdTab';

type TabKey =
  | 'sources'
  | 'bulk'
  | 'seed'
  | 'id'
  | 'wikibooks'
  | 'wikisource'
  | 'openstax'
  | 'storyweaver'
  | 'mine';

type StatTone = 'neutral' | 'success' | 'info' | 'danger';

interface AdminCurationClientProps {
  catalogs: SourceCatalog[];
  books: LibraryBookAdminRow[];
  stats: CurationStats;
}

export function AdminCurationClient({
  catalogs,
  books,
  stats,
}: AdminCurationClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('mine');
  const [enqueueSource, setEnqueueSource] = useState<EnqueueSource | null>(null);

  function handlePickSeed(seed: SeedItem) {
    setEnqueueSource({ kind: 'seed', data: seed });
  }
  function handlePickPreview(preview: GutenbergPreview) {
    setEnqueueSource({ kind: 'preview', data: preview });
  }
  function handlePickWikibooks(preview: WikibooksPreview) {
    setEnqueueSource({ kind: 'wikibooks', data: preview });
  }
  function handlePickWikisource(preview: WikisourcePreview) {
    setEnqueueSource({ kind: 'wikisource', data: preview });
  }
  function handlePickOpenStax(preview: OpenStaxPreview) {
    setEnqueueSource({ kind: 'openstax', data: preview });
  }
  function handlePickStoryWeaver(preview: StoryWeaverPreview) {
    setEnqueueSource({ kind: 'storyweaver', data: preview });
  }
  function handleSourceClick(source: string) {
    // 구현된 소스: gutenberg/standard_ebooks → 시드 탭, 그 외는 전용 ID 탭.
    if (source === 'gutenberg' || source === 'standard_ebooks') {
      setTab('seed');
    } else if (source === 'wikibooks') {
      setTab('wikibooks');
    } else if (source === 'wikisource') {
      setTab('wikisource');
    } else if (source === 'openstax') {
      setTab('openstax');
    } else if (source === 'storyweaver') {
      setTab('storyweaver');
    }
  }
  function refetchAll() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <StatsBar stats={stats} />

      {/* 화면 도움말 — 탭을 옮기면 그 탭의 도움말로 바뀐다 (라벨 문자열로 조회). */}
      <AdminScreenHelp
        screen="curation"
        tab={TABS.find((t) => t.key === tab)?.label}
        className="-mb-2"
      />

      <TabList tab={tab} onChange={setTab} stats={stats} />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'sources' && (
          <SourceCatalogTab
            catalogs={catalogs}
            onSelectSource={handleSourceClick}
          />
        )}
        {tab === 'bulk' && <BulkFetchTab />}
        {tab === 'seed' && (
          <SeedTab existingBooks={books} onPickSeed={handlePickSeed} />
        )}
        {tab === 'id' && <GutenbergIdTab onPickPreview={handlePickPreview} />}
        {tab === 'wikibooks' && <WikibooksIdTab onPickPreview={handlePickWikibooks} />}
        {tab === 'wikisource' && <WikisourceIdTab onPickPreview={handlePickWikisource} />}
        {tab === 'openstax' && <OpenStaxIdTab onPickPreview={handlePickOpenStax} />}
        {tab === 'storyweaver' && <StoryWeaverIdTab onPickPreview={handlePickStoryWeaver} />}
        {tab === 'mine' && <MyLibraryTab books={books} onRefetch={refetchAll} />}
      </div>

      <EnqueueModal
        source={enqueueSource}
        onClose={() => setEnqueueSource(null)}
        onSuccess={() => {
          // 큐 추가 직후 Curated Books 탭으로 자동 이동 — 새 책 상태 추적이
          // 사용자의 다음 자연스러운 행동. router.refresh 로 RSC 재페치.
          setTab('mine');
          setTimeout(() => router.refresh(), 400);
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Stats bar
// ─────────────────────────────────────────────

function StatsBar({ stats }: { stats: CurationStats }) {
  const items: Array<{ label: string; value: number; tone: StatTone }> = [
    { label: '전체', value: stats.total, tone: 'neutral' },
    { label: '게시됨', value: stats.published, tone: 'success' },
    { label: '처리 중', value: stats.inProgress, tone: 'info' },
    { label: '실패', value: stats.failed, tone: 'danger' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <StatTile key={item.label} {...item} />
      ))}
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: StatTone;
}) {
  const colorMap: Record<StatTone, { bg: string; text: string; valueColor: string }> = {
    neutral: { bg: 'var(--bg2)', text: 'var(--t3)', valueColor: 'var(--t1)' },
    success: { bg: 'var(--learn-known-light)', text: 'var(--learn-known)', valueColor: 'var(--learn-known)' },
    info: { bg: 'var(--learn-fresh-light)', text: 'var(--learn-fresh)', valueColor: 'var(--learn-fresh)' },
    danger: { bg: 'var(--learn-error-light)', text: 'var(--learn-error)', valueColor: 'var(--learn-error)' },
  };
  const c = colorMap[tone];

  return (
    <div
      className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-3"
      style={{ backgroundColor: c.bg }}
    >
      <span
        className="font-mono text-[10px] uppercase tracking-wider"
        style={{ color: c.text }}
      >
        {label}
      </span>
      <span
        className="font-display text-[24px] font-[700] tabular-nums"
        style={{ color: c.valueColor }}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab list
// ─────────────────────────────────────────────

interface TabListProps {
  tab: TabKey;
  onChange: (t: TabKey) => void;
  stats: CurationStats;
}

const TABS: Array<{ key: TabKey; label: string; Icon: typeof BookOpen }> = [
  { key: 'mine', label: 'Curated Books', Icon: FolderOpen },
  { key: 'bulk', label: '소스 GET (대량)', Icon: Download },
  { key: 'sources', label: '소스 카탈로그', Icon: Library },
  { key: 'seed', label: '추천 시드', Icon: BookOpen },
  { key: 'id', label: 'Gutenberg ID', Icon: Hash },
  { key: 'wikibooks', label: 'Wikibooks', Icon: Globe },
  { key: 'wikisource', label: 'Wikisource', Icon: ScrollText },
  { key: 'openstax', label: 'OpenStax', Icon: GraduationCap },
  { key: 'storyweaver', label: 'StoryWeaver', Icon: Palette },
];

function TabList({ tab, onChange, stats }: TabListProps) {
  return (
    <div
      role="tablist"
      aria-label="큐레이션 탭"
      className="flex flex-wrap gap-1 border-b border-[var(--bd)]"
    >
      {TABS.map(({ key, label, Icon }) => {
        const active = tab === key;
        const badge = key === 'mine' && stats.total > 0 ? stats.total : null;
        return (
          <button
            key={key}
            role="tab"
            id={`tab-${key}`}
            aria-selected={active}
            aria-controls={`panel-${key}`}
            type="button"
            onClick={() => onChange(key)}
            className={[
              'inline-flex min-h-[44px] items-center gap-2',
              'border-b-2 px-3 -mb-px',
              'font-display text-[13px] font-[600]',
              'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
              active
                ? 'border-[var(--p)] text-[var(--p)]'
                : 'border-transparent text-[var(--t2)] hover:text-[var(--t1)]',
            ].join(' ')}
          >
            <Icon size={14} aria-hidden />
            {label}
            {badge != null && (
              <span
                className="inline-flex min-w-[18px] items-center justify-center rounded-[var(--r-full)] bg-[var(--bg2)] px-2 font-mono text-[10px] font-[700] text-[var(--t2)]"
                aria-label={`${badge}건`}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
