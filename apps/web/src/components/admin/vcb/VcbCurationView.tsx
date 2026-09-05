'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { VcbCurationList } from './VcbCurationList'
import { VcbCurationDetailPanel } from './VcbCurationDetailPanel'
import { VcbCurationFilterBar } from './VcbCurationFilterBar'
import { fetchQueueDetail } from '@/lib/vcb/server/queue'
import {
  approveQueueItem,
  rejectQueueItem,
  bulkApprove,
  bulkReject,
} from '@/lib/vcb/server/curation'
import type {
  VcbQueueListItem,
  VcbQueueDetail,
  CurationFilter,
  CurationSort,
} from '@/lib/vcb/types'

const CEFR_ORDER: Record<string, number> = {
  A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
}

type OptimisticDecision = 'approve' | 'reject'

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
  const [, startDecide] = useTransition()
  // 낙관적 결정 오버레이 — 서버 왕복 전 리스트 글리프/카운트 즉시 반영. 실패 시 해당 id revert.
  const [optimistic, setOptimistic] = useState<Map<number, OptimisticDecision>>(
    () => new Map(),
  )
  const [decisionError, setDecisionError] = useState<string | null>(null)

  // initialItems(서버 진실) 위에 낙관적 결정을 덮어씀. revalidate 후엔 둘이 일치 → 무플리커.
  const overlaid = useMemo(() => {
    if (optimistic.size === 0) return initialItems
    return initialItems.map((i) =>
      optimistic.has(i.queue_id)
        ? { ...i, latest_decision: optimistic.get(i.queue_id)! }
        : i,
    )
  }, [initialItems, optimistic])

  const handleSelect = (queueId: number) => {
    setSelectedId(queueId)
    if (queueId === detail?.queue_id) return // 이미 로드된 동일 row
    startTransition(async () => {
      const result = await fetchQueueDetail(queueId)
      setDetail(result)
    })
  }

  const filteredItems = useMemo(() => {
    let items = [...overlaid]
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
  }, [overlaid, filter, sort])

  // ── 개별 결정 (낙관적 + 자동 다음 이동) ──────────────
  const decide = (
    kind: OptimisticDecision,
    note: string | null = null,
    clearNote?: () => void,
  ) => {
    const id = selectedId
    if (id == null) return
    setDecisionError(null)
    setOptimistic((prev) => new Map(prev).set(id, kind))
    clearNote?.()
    // 다음 항목으로 이동 — 현재 목록 순서의 다음 id(재필터에도 안전하게 id로 해석).
    const idx = filteredItems.findIndex((i) => i.queue_id === id)
    const nextId = idx >= 0 ? (filteredItems[idx + 1]?.queue_id ?? null) : null
    if (nextId != null) handleSelect(nextId)
    startDecide(async () => {
      const result =
        kind === 'approve'
          ? await approveQueueItem(id, note)
          : await rejectQueueItem(id, note)
      if (!result.ok) {
        setOptimistic((prev) => {
          const n = new Map(prev)
          n.delete(id)
          return n
        })
        setDecisionError(
          `${kind === 'approve' ? '승인' : '거절'} 실패 — ${result.error ?? '알 수 없는 오류'}`,
        )
      }
    })
  }

  // ── 키보드 내비 (j/k 이동 · a 승인 · r 거절) ──────────
  const moveSelection = (dir: 1 | -1) => {
    if (filteredItems.length === 0) return
    const idx = filteredItems.findIndex((i) => i.queue_id === selectedId)
    const base = idx < 0 ? 0 : idx
    const nextIdx = Math.min(filteredItems.length - 1, Math.max(0, base + dir))
    const nextId = filteredItems[nextIdx]?.queue_id
    if (nextId != null && nextId !== selectedId) handleSelect(nextId)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      // 입력 중(노트/검색)에는 단축키 비활성 — 타이핑 가로채지 않음.
      if (
        t &&
        (t.tagName === 'TEXTAREA' ||
          t.tagName === 'INPUT' ||
          t.isContentEditable)
      )
        return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault()
          moveSelection(1)
          break
        case 'k':
        case 'ArrowUp':
          e.preventDefault()
          moveSelection(-1)
          break
        case 'a':
          e.preventDefault()
          decide('approve')
          break
        case 'r':
          e.preventDefault()
          decide('reject')
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // selectedId·filteredItems 변경 시 새 클로저로 재구독(최신 상태 반영).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, filteredItems])

  // ── 일괄 선택/처리 (P0-5) ──────────────────────────
  const allSelected =
    filteredItems.length > 0 &&
    filteredItems.every((i) => selectedIds.has(i.queue_id))

  const toggleSelectAll = () => {
    setSelectedIds(
      allSelected ? new Set() : new Set(filteredItems.map((i) => i.queue_id)),
    )
  }

  const runBulk = (kind: OptimisticDecision) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setDecisionError(null)
    setOptimistic((prev) => {
      const n = new Map(prev)
      ids.forEach((id) => n.set(id, kind))
      return n
    })
    startBulk(async () => {
      const result = kind === 'approve' ? await bulkApprove(ids) : await bulkReject(ids)
      if (!result.ok) {
        setOptimistic((prev) => {
          const n = new Map(prev)
          ids.forEach((id) => n.delete(id))
          return n
        })
        setDecisionError(`일괄 ${kind === 'approve' ? '승인' : '거절'} 실패`)
      }
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
            all: overlaid.length,
            flagged: overlaid.filter(
              (i) => i.qa_flags.length > 0 && i.latest_decision === null,
            ).length,
            unreviewed: overlaid.filter((i) => i.latest_decision === null).length,
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
            className="inline-flex items-center h-11 px-3 rounded-[var(--r-sm)] font-display text-xs font-medium border transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
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
                className="inline-flex items-center h-11 px-3 rounded-[var(--r-sm)] font-display text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                style={{ background: 'var(--success)', color: 'var(--ti)' }}
              >
                {bulkPending ? '처리중…' : `승인`}
              </button>
              <button
                type="button"
                onClick={() => runBulk('reject')}
                disabled={bulkPending}
                className="inline-flex items-center h-11 px-3 rounded-[var(--r-sm)] font-display text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
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
        {/* 키보드 단축키 힌트 */}
        <div
          className="px-3 py-2 border-t font-mono text-[11px] flex items-center gap-2 flex-wrap shrink-0"
          style={{ borderColor: 'var(--bd)', color: 'var(--t4)', background: 'var(--bg2)' }}
        >
          <Kbd>j</Kbd>
          <Kbd>k</Kbd>
          <span>이동</span>
          <span style={{ color: 'var(--bd)' }}>·</span>
          <Kbd>a</Kbd>
          <span>승인</span>
          <span style={{ color: 'var(--bd)' }}>·</span>
          <Kbd>r</Kbd>
          <span>거절</span>
        </div>
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
        {decisionError && (
          <div
            className="absolute top-3 left-6 right-16 px-3 py-2 rounded-[var(--r-sm)] text-xs flex items-center justify-between gap-2"
            style={{
              background: 'var(--error-light)',
              color: 'var(--error)',
              border: '1px solid var(--error)',
            }}
            role="alert"
          >
            <span>{decisionError}</span>
            <button
              type="button"
              onClick={() => setDecisionError(null)}
              className="font-mono shrink-0"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        )}
        {detail ? (
          <VcbCurationDetailPanel
            detail={detail}
            runId={runId}
            onDecision={decide}
          />
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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-[var(--r-sm)] border font-mono text-[10px]"
      style={{ background: 'var(--bg)', borderColor: 'var(--bd)', color: 'var(--t3)' }}
    >
      {children}
    </kbd>
  )
}
