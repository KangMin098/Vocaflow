// apps/web/src/components/admin/curation/QuizJobsBanner.tsx
// 스크립트 퀴즈 생성 큐(book_quiz_jobs) 상태 뷰.
//   도서별 챕터 퀴즈 생성 진행(대기/진행/완료/실패 + chapters_done/total · questions_created)을 표시.
//   드레인(= Claude Code 배치, MCP)이 DB status/진행률을 갱신하면 폴링/수동 새로고침으로 반영.
//   작업이 0건이면 자체 숨김.

'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, RefreshCw, X } from 'lucide-react'

import { fetchQuizJobsAction } from '@/app/admin/curation/actions'
import type { QuizJobRow, QuizJobStatus } from '@/lib/library/admin-queries'

const QUIZ_ACCENT = 'var(--active)' // 앰버 — ScriptQuiz 정합

const STATUS_META: Record<QuizJobStatus, { label: string; color: string }> = {
  pending: { label: '대기', color: 'var(--t3)' },
  running: { label: '진행', color: QUIZ_ACCENT },
  done: { label: '완료', color: 'var(--success)' },
  failed: { label: '실패', color: 'var(--error)' },
}

const STATUS_ORDER: QuizJobStatus[] = ['running', 'pending', 'failed', 'done']

export function QuizJobsBanner({ reloadKey }: { reloadKey: number }) {
  const [jobs, setJobs] = useState<QuizJobRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchQuizJobsAction()
    setLoading(false)
    if (res.ok) {
      setJobs(res.data ?? [])
      setDismissed(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, reloadKey])

  const hasActive = (jobs ?? []).some(
    (j) => j.status === 'pending' || j.status === 'running',
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
  const activeCount = (counts.pending ?? 0) + (counts.running ?? 0)

  return (
    <section
      aria-label="스크립트 퀴즈 생성 큐 상태"
      className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--active)] bg-[var(--warning-light)] px-4 py-3 shadow-[var(--sh-xs)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 font-display text-[13px] font-[700] text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--active)] focus-visible:rounded-[var(--r-sm)]"
        >
          {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
          📝 스크립트 퀴즈 생성 큐
          <span className="font-mono text-[11px] font-[600] text-[var(--t3)]">
            {jobs.length}건
            {activeCount > 0 && ` · 진행 ${activeCount}`}
          </span>
        </button>

        <div className="flex items-center gap-2">
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
            aria-label="퀴즈 큐 새로고침"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t3)] hover:bg-[var(--bg)] hover:text-[var(--active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--active)] disabled:opacity-50"
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
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-[var(--t3)] hover:bg-[var(--bg)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--active)]"
            >
              <X size={13} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {activeCount > 0 && (
        <p className="font-body text-[11px] text-[var(--t3)]">
          챕터 본문 → 스토리 퀴즈 생성을 Claude Code 배치가 처리합니다 (큐 적재됨). 진행 시 자동 갱신.
        </p>
      )}

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
                {j.bookVLevel != null && (
                  <span className="shrink-0 font-mono text-[10px] text-[var(--t3)]">
                    V{j.bookVLevel} · {j.targetPerChapter ?? '?'}문/ch
                  </span>
                )}
                <span className="shrink-0 font-mono text-[10px] text-[var(--t3)] tabular-nums">
                  {j.chaptersDone}/{j.chaptersTotal}ch · {j.questionsCreated}문
                </span>
                <span
                  className="shrink-0 font-display text-[10px] font-[700]"
                  style={{ color: sm.color }}
                >
                  {sm.label}
                </span>
                {j.error && (
                  <span
                    className="max-w-[180px] shrink-0 truncate font-mono text-[10px] text-[var(--error)]"
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
