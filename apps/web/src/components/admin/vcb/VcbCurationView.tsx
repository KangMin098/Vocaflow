'use client'

import { useMemo, useState, useTransition } from 'react'
import { VcbCurationList } from './VcbCurationList'
import { VcbCurationDetailPanel } from './VcbCurationDetailPanel'
import { VcbCurationFilterBar } from './VcbCurationFilterBar'
import { fetchQueueDetail } from '@/lib/vcb/server/queue'
import { bulkApprove, bulkReject } from '@/lib/vcb/server/curation'
import type {
  VcbQueueListItem,
  VcbQueueDetail,
  CurationFilter,
  CurationSort,
} from '@/lib/vcb/types'

const CEFR_ORDER: Record<string, number> = {
  A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
}

interface Props {
  runId: number
  initialItems: VcbQueueListItem[]
  initialDetail: VcbQueueDetail | null
}

export function VcbCurationView({ runId, initialItems, initialDetail }: Props) {
  const [filter, setFilter] = useState<CurationFilter>('all')
  const [sort, setSort] = useState<CurationSort>('ngsl_rank_asc')
  const [selectedId, setSelectedId] = useState<number | null>(
    initialDetail?.queue_id ?? initialItems[0]?.queue_id ?? null,
  )
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [detail, setDetail] = useState<VcbQueueDetail | null>(initialDetail)
  const [isPending, startTransition] = useTransition()
  const [bulkPending, startBulk] = useTransition()

  const handleSelect = (queueId: number) => {
    setSelectedId(queueId)
    if (queueId === detail?.queue_id) return // 이미 로드된 동일 row
    startTransition(async () => {
      const result = await fetchQueueDetail(queueId)
      setDetail(result)
    })
  }

  const filteredItems = useMemo(() => {
    let items = [...initialItems]
    if (filter === 'flagged') {
      items = items.filter((i) => i.qa_flags.length > 0 && i.latest_decision === null)
    } else if (filter === 'rejected') {
      items = items.filter((i) => i.latest_decision === 'reject')
    } else if (filter === 'unreviewed') {
      items = items.filter((i) => i.latest_decision === null)
    } else if (filter === 'ai_seed') {
      items = items.filter((i) => i.seed_origin === 'ai_generated')
    }

    if (sort === 'ngsl_rank_asc') {
      items.sort((a, b) => (a.ngsl_rank ?? 99999) - (b.ngsl_rank ?? 99999))
    } else if (sort === 'cefr_asc') {
      items.sort(
        (a, b) =>
          (CEFR_ORDER[a.cefr ?? 'B1'] ?? 99) - (CEFR_ORDER[b.cefr ?? 'B1'] ?? 99),
      )
    } else if (sort === 'confidence_desc') {
      items.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    } else if (sort === 'origin') {
      items.sort((a, b) => a.seed_origin.localeCompare(b.seed_origin))
    }

    return items
  }, [initialItems, filter, sort])

  // ── 일괄 선택/처리 (P0-5) ──────────────────────────
  const allSelected =
    filteredItems.length > 0 &&
    filteredItems.every((i) => selectedIds.has(i.queue_id))

  const toggleSelectAll = () => {
    setSelectedIds(
      allSelected ? new Set() : new Set(filteredItems.map((i) => i.queue_id)),
    )
  }

  const runBulk = (kind: 'approve' | 'reject') => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    startBulk(async () => {
      if (kind === 'approve') await bulkApprove(ids)
      else await bulkReject(ids)
      // 서버액션이 revalidatePath → RSC 재렌더로 목록 글리프 갱신. 선택만 로컬 초기화.
      setSelectedIds(new Set())
    })
  }

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: '380px 1fr',
        height: 'calc(100vh - 240px)',
      }}
    >
      <aside
        className="flex flex-col gap-3 rounded-[var(--r-lg)] border overflow-hidden"
        style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
      >
        <VcbCurationFilterBar
          filter={filter}
          sort={sort}
          counts={{
            all: initialItems.length,
            flagged: initialItems.filter(
              (i) => i.qa_flags.length > 0 && i.latest_decision === null,
            ).length,
            unreviewed: initialItems.filter((i) => i.latest_decision === null).length,
          }}
          onFilterChange={setFilter}
          onSortChange={setSort}
        />
        {/* 일괄 처리 툴바 (P0-5) — 필터 결과 전체 선택 → 일괄 승인/거절 */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b"
          style={{ borderColor: 'var(--bd)', background: 'var(--bg2)' }}
        >
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={filteredItems.length === 0}
            className="inline-flex items-center h-8 px-2.5 rounded-[var(--r-sm)] font-display text-xs font-medium border transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            style={{ borderColor: 'var(--bd)', color: 'var(--t2)', background: 'var(--bg)' }}
          >
            {allSelected ? '전체 해제' : '전체 선택'}
          </button>
          {selectedIds.size > 0 ? (
            <>
              <span className="font-mono text-xs tabular-nums" style={{ color: 'var(--t3)' }}>
                {selectedIds.size} 선택
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => runBulk('approve')}
                disabled={bulkPending}
                className="inline-flex items-center h-8 px-3 rounded-[var(--r-sm)] font-display text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                style={{ background: 'var(--success)', color: 'var(--ti)' }}
              >
                {bulkPending ? '처리중…' : `승인`}
              </button>
              <button
                type="button"
                onClick={() => runBulk('reject')}
                disabled={bulkPending}
                className="inline-flex items-center h-8 px-3 rounded-[var(--r-sm)] font-display text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                style={{ background: 'var(--error)', color: 'var(--ti)' }}
              >
                거절
              </button>
            </>
          ) : (
            <span className="font-mono text-xs" style={{ color: 'var(--t4)' }}>
              체크박스로 선택해 일괄 처리
            </span>
          )}
        </div>
        <VcbCurationList
          items={filteredItems}
          selectedId={selectedId}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onToggleMultiSelect={(id) => {
            const next = new Set(selectedIds)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            setSelectedIds(next)
          }}
        />
      </aside>

      <main
        className="rounded-[var(--r-lg)] border overflow-y-auto p-6 relative"
        style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
      >
        {isPending && (
          <div
            className="absolute top-3 right-3 px-2 py-1 rounded-[var(--r-sm)] font-mono text-[11px]"
            style={{
              background: 'var(--bg2)',
              color: 'var(--t3)',
              border: '1px solid var(--bd)',
            }}
            aria-live="polite"
          >
            loading…
          </div>
        )}
        {detail ? (
          <VcbCurationDetailPanel detail={detail} runId={runId} />
        ) : selectedId !== null ? (
          <div className="text-center py-12" style={{ color: 'var(--t3)' }}>
            상세를 불러올 수 없습니다 (queue_id={selectedId})
          </div>
        ) : (
          <div className="text-center py-12" style={{ color: 'var(--t3)' }}>
            단어를 선택하세요
          </div>
        )}
      </main>
    </div>
  )
}
