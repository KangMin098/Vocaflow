// apps/web/src/components/admin/curation/CurationJobsBanner.tsx
// 큐레이션 도서 일괄 dev 처리 큐 상태 뷰.
//   book_curation_jobs 의 작업 진행(대기/진행/매핑대기/완료/실패)을 표시.
//   드레인(= Claude Code 배치, MCP)이 DB status 를 갱신하면 폴링/수동 새로고침으로 반영.
//   작업이 0건이면 자체 숨김.

'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, RefreshCw, X } from 'lucide-react'

import { fetchCurationJobsAction } from '@/app/admin/curation/actions'
import type { CurationJobRow, CurationJobStatus } from '@/lib/library/admin-queries'

const STATUS_META: Record<CurationJobStatus, { label: string; color: string }> = {
  pending: { label: '대기', color: 'var(--t3)' },
  running: { label: '진행', color: 'var(--p)' },
  awaiting_mapping: { label: '매핑 대기', color: 'var(--warning)' },
  done: { label: '완료', color: 'var(--success)' },
  failed: { label: '실패', color: 'var(--error)' },
}

const STATUS_ORDER: CurationJobStatus[] = ['running', 'awaiting_mapping', 'pending', 'failed', 'done']

const MODE_LABEL: Record<CurationJobRow['mode'], string> = {
  dev_process: 'dev 처리',
  dev_reprocess: 'dev 재처리',
}

export function CurationJobsBanner({ reloadKey }: { reloadKey: number }) {
  const [jobs, setJobs] = useState<CurationJobRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchCurationJobsAction()
    setLoading(false)
    if (res.ok) {
      setJobs(res.data ?? [])
      setDismissed(false) // 새 작업 들어오면 다시 노출
    }
  }, [])

  // mount + reloadKey(enqueue 직후) 변경 시 재조회
  useEffect(() => {
    void load()
  }, [load, reloadKey])

  // active(대기/진행/매핑대기) 있으면 8초 폴링 — 드레인 진행 반영
  const hasActive = (jobs ?? []).some(
    (j) => j.status === 'pending' || j.status === 'running' || j.status === 'awaiting_mapping',
  )
  useEffect(() => {
    if (!hasActive) return
    const id = setInterval(() => void load(), 8000)
    return () => clearInterval(id)
  }, [hasActive, load])

  if (dismissed) return null
  if (!jobs || jobs.length === 0) return null

  const counts = jobs.reduce<Record<string, number>>((a, j) => {
    a[j.status] = (a[j.status] ?? 0) + 1
    return a
  }, {})
  const activeCount = (counts.pending ?? 0) + (counts.running ?? 0) + (counts.awaiting_mapping ?? 0)

  return (
    <section
      aria-label="큐레이션 일괄 처리 큐 상태"
      className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--p-light)] px-4 py-3 shadow-[var(--sh-xs)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 font-display text-[13px] font-[700] text-[var(--p-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:rounded-[var(--r-sm)]"
        >
          {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
          🛠 dev 처리 큐
          <span className="font-mono text-[11px] font-[600] text-[var(--t3)]">
            {jobs.length}건
            {activeCount > 0 && ` · 진행 ${activeCount}`}
          </span>
        </button>

        <div className="flex items-center gap-2">
          {/* 상태별 카운트 칩 */}
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0).map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-[var(--r-full)] border bg-[var(--bg)] px-2 py-0.5 font-mono text-[10px] font-[600]"
                style={{ color: STATUS_META[s].color, borderColor: STATUS_META[s].color }}
              >
                {STATUS_META[s].label}
                <strong className="font-display">{counts[s]}</strong>
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            title="새로고침"
            aria-label="큐 새로고침"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t3)] hover:bg-[var(--bg)] hover:text-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw size={13} aria-hidden />
            )}
          </button>
          {activeCount === 0 && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="닫기"
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t3)] hover:bg-[var(--bg)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              <X size={13} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* 안내 — 드레인 주체 명시 */}
      {activeCount > 0 && (
        <p className="font-body text-[11px] text-[var(--t3)]">
          챕터 정의 + LibriVox 매핑을 Claude Code 배치가 처리합니다 (큐 적재됨). 진행 시 자동 갱신.
        </p>
      )}

      {/* 책별 목록 (펼침) */}
      {open && (
        <ul className="mt-1 flex flex-col divide-y divide-[var(--bd)]/60 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)]">
          {jobs.map((j) => {
            const sm = STATUS_META[j.status]
            return (
              <li key={j.id} className="flex items-center gap-2 px-3 py-1.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: sm.color }}
                />
                <span className="min-w-0 flex-1 truncate font-body text-[12px] text-[var(--t1)]">
                  {j.bookTitle}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-[var(--t3)]">
                  {MODE_LABEL[j.mode]}
                </span>
                <span
                  className="shrink-0 font-display text-[10px] font-[700]"
                  style={{ color: sm.color }}
                >
                  {sm.label}
                </span>
                {j.error && (
                  <span
                    className="max-w-[200px] shrink-0 truncate font-mono text-[10px] text-[var(--error)]"
                    title={j.error}
                  >
                    {j.error}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
