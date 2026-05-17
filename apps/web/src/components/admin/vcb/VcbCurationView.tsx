'use client'

import { useMemo, useState, useTransition } from 'react'
import { VcbCurationList } from './VcbCurationList'
import { VcbCurationDetailPanel } from './VcbCurationDetailPanel'
import { VcbCurationFilterBar } from './VcbCurationFilterBar'
import { fetchQueueDetail } from '@/lib/vcb/server/queue'
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
