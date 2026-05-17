// apps/web/src/app/admin/curation/page.tsx
// LCP v2.0 Phase 12 묶음 D — admin/curation RSC entry

import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import {
  getCurationStats,
  listAllAdminBooks,
  listSourceCatalogs,
} from '@/lib/library/admin-queries';
import { AdminCurationClient } from './AdminCurationClient';

export const metadata = {
  title: '큐레이션 — Vocaflow Admin',
  description: 'LCP v2.0 라이브러리 큐레이션 콘솔',
};

export const revalidate = 60;

export default async function AdminCurationPage() {
  await requireAdmin('/admin/curation');

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader />
      <Suspense fallback={<ContentFallback />}>
        <CurationContent />
      </Suspense>
    </div>
  );
}

async function CurationContent() {
  const client = await createClient();

  const [catalogs, books, stats] = await Promise.all([
    listSourceCatalogs(client),
    listAllAdminBooks(client),
    getCurationStats(client),
  ]);

  return <AdminCurationClient catalogs={catalogs} books={books} stats={stats} />;
}

function PageHeader() {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="font-display text-[24px] font-[700] text-[var(--t1)]">
        📚 라이브러리 큐레이션
      </h1>
      <p className="font-body text-[13px] text-[var(--t3)]">
        LCP v2.0 — 9개 PD/CC 소스에서 책을 큐레이션하고 자동 처리 파이프라인에 추가합니다.
      </p>
    </header>
  );
}

function ContentFallback() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]"
          />
        ))}
      </div>
      <div className="h-10 animate-pulse rounded-[var(--r-sm)] bg-[var(--bg2)]" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]"
          />
        ))}
      </div>
    </div>
  );
}
