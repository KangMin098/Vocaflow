// apps/web/src/app/admin/curation/AdminCurationClient.tsx
// LCP v2.0 Phase 12 묶음 D — 4탭 통합 클라이언트 컴포넌트

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CURATION_VIEWS,
  CURATION_METHODS,
  curationLocation,
  curationHref,
  curationViewHref,
  type CurationView,
  type CurationMethod,
} from '@/lib/admin/curation-view'
import { updateAdminUrl } from '@/lib/admin/navigation'

import type { CurationStats, LibraryBookAdminRow, SourceCatalog } from '@/lib/library/admin-queries'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { SourceCatalogTab } from '@/components/admin/curation/SourceCatalogTab'
import { SeedTab } from '@/components/admin/curation/SeedTab'
import { BulkFetchTab } from '@/components/admin/curation/BulkFetchTab'
import { GutenbergIdTab } from '@/components/admin/curation/GutenbergIdTab'
import { WikibooksIdTab } from '@/components/admin/curation/WikibooksIdTab'
import { WikisourceIdTab } from '@/components/admin/curation/WikisourceIdTab'
import { OpenStaxIdTab } from '@/components/admin/curation/OpenStaxIdTab'
import { StoryWeaverIdTab } from '@/components/admin/curation/StoryWeaverIdTab'
import { MyLibraryTab } from '@/components/admin/curation/MyLibraryTab'
import { EnqueueModal, type EnqueueSource } from '@/components/admin/curation/EnqueueModal'
import type { SeedItem } from '@/components/admin/curation/SeedCard'
import type { GutenbergPreview } from '@/components/admin/curation/GutenbergIdTab'
import type { WikibooksPreview } from '@/components/admin/curation/WikibooksIdTab'
import type { WikisourcePreview } from '@/components/admin/curation/WikisourceIdTab'
import type { OpenStaxPreview } from '@/components/admin/curation/OpenStaxIdTab'
import type { StoryWeaverPreview } from '@/components/admin/curation/StoryWeaverIdTab'

interface AdminCurationClientProps {
  catalogs: SourceCatalog[]
  books: LibraryBookAdminRow[]
  stats: CurationStats
}

export function AdminCurationClient({ catalogs, books, stats }: AdminCurationClientProps) {
  const router = useRouter()
  const params = useSearchParams()
  const { view, method: tab } = curationLocation(params)
  const setTab = (method: CurationMethod | 'mine') => {
    const next = new URLSearchParams(params.toString())
    if (method === 'mine')
      for (const key of ['q', 'source', 'level', 'status', 'selected', 'page']) next.delete(key)
    updateAdminUrl(
      curationHref(
        next,
        method === 'mine' ? 'library' : 'collect',
        method === 'mine' ? undefined : method
      )
    )
  }
  const setView = (value: CurationView) =>
    updateAdminUrl(curationViewHref(new URLSearchParams(params.toString()), value), 'push')
  const [enqueueSource, setEnqueueSource] = useState<EnqueueSource | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setReady(true)
  }, [])

  function handlePickSeed(seed: SeedItem) {
    setEnqueueSource({ kind: 'seed', data: seed })
  }
  function handlePickPreview(preview: GutenbergPreview) {
    setEnqueueSource({ kind: 'preview', data: preview })
  }
  function handlePickWikibooks(preview: WikibooksPreview) {
    setEnqueueSource({ kind: 'wikibooks', data: preview })
  }
  function handlePickWikisource(preview: WikisourcePreview) {
    setEnqueueSource({ kind: 'wikisource', data: preview })
  }
  function handlePickOpenStax(preview: OpenStaxPreview) {
    setEnqueueSource({ kind: 'openstax', data: preview })
  }
  function handlePickStoryWeaver(preview: StoryWeaverPreview) {
    setEnqueueSource({ kind: 'storyweaver', data: preview })
  }
  function handleSourceClick(source: string) {
    // 구현된 소스: gutenberg/standard_ebooks → 시드 탭, 그 외는 전용 ID 탭.
    if (source === 'gutenberg' || source === 'standard_ebooks') {
      setTab('seed')
    } else if (source === 'wikibooks') {
      setTab('wikibooks')
    } else if (source === 'wikisource') {
      setTab('wikisource')
    } else if (source === 'openstax') {
      setTab('openstax')
    } else if (source === 'storyweaver') {
      setTab('storyweaver')
    }
  }
  function refetchAll() {
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6" data-curation-ready={ready || undefined}>
      <StatsBar stats={stats} />

      {/* 화면 도움말 — 탭을 옮기면 그 탭의 도움말로 바뀐다 (라벨 문자열로 조회). */}
      <AdminScreenHelp
        screen="curation"
        tab={
          view === 'collect'
            ? CURATION_METHODS.find((item) => item.key === tab)?.label
            : view === 'review'
              ? '검토 대기'
              : '도서 목록'
        }
        className="-mb-2"
      />

      <nav aria-label="도서 작업" className="flex flex-wrap gap-1 border-b border-[var(--bd)]">
        {CURATION_VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-current={view === item.key ? 'page' : undefined}
            onClick={() => setView(item.key)}
            className={
              'inline-flex min-h-11 items-center border-b-2 px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bdf)] ' +
              (view === item.key
                ? 'border-[var(--p)] font-semibold text-[var(--t1)]'
                : 'border-transparent text-[var(--t2)]')
            }
          >
            {item.label}
          </button>
        ))}
      </nav>
      {view === 'collect' && (
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="curation-method" className="text-sm font-semibold text-[var(--t1)]">
            수집 방식
          </label>
          <select
            id="curation-method"
            value={tab}
            onChange={(event) => setTab(event.target.value as CurationMethod)}
            className="min-h-11 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 text-sm text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bdf)]"
          >
            {CURATION_METHODS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div aria-label={view === 'collect' ? '도서 수집' : '도서 목록'}>
        {view === 'collect' && (
          <div>
            {tab === 'sources' && (
              <SourceCatalogTab catalogs={catalogs} onSelectSource={handleSourceClick} />
            )}
            {tab === 'bulk' && <BulkFetchTab />}
            {tab === 'seed' && <SeedTab existingBooks={books} onPickSeed={handlePickSeed} />}
            {tab === 'id' && <GutenbergIdTab onPickPreview={handlePickPreview} />}
            {tab === 'wikibooks' && <WikibooksIdTab onPickPreview={handlePickWikibooks} />}
            {tab === 'wikisource' && <WikisourceIdTab onPickPreview={handlePickWikisource} />}
            {tab === 'openstax' && <OpenStaxIdTab onPickPreview={handlePickOpenStax} />}
            {tab === 'storyweaver' && <StoryWeaverIdTab onPickPreview={handlePickStoryWeaver} />}
          </div>
        )}
        {view !== 'collect' && (
          <MyLibraryTab
            books={books}
            onRefetch={refetchAll}
            initialStatus={view === 'review' ? 'ready' : undefined}
          />
        )}
      </div>

      <EnqueueModal
        source={enqueueSource}
        onClose={() => setEnqueueSource(null)}
        onSuccess={() => {
          // 큐 추가 직후 Curated Books 탭으로 자동 이동 — 새 책 상태 추적이
          // 사용자의 다음 자연스러운 행동. router.refresh 로 RSC 재페치.
          setTab('mine')
          setTimeout(() => router.refresh(), 400)
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────
// Stats bar
// ─────────────────────────────────────────────

function StatsBar({ stats }: { stats: CurationStats }) {
  const items = [
    { label: '전체', value: stats.total },
    { label: '게시됨', value: stats.published },
    { label: '처리 중', value: stats.inProgress },
    { label: '실패', value: stats.failed },
  ]
  return (
    <dl
      aria-label="도서 처리 요약"
      className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--t2)]"
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-2">
          <dt>{item.label}</dt>
          <dd className="font-semibold tabular-nums text-[var(--t1)]">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
