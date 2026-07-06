// apps/web/src/components/admin/curation/DrainQueueBanner.tsx
// 큐레이션 드레인 큐(book_curation_jobs) 통합 상태 뷰 (v06.x).
//   voice_map(LibriVox 매핑) + quiz_gen(스크립트 퀴즈) 두 task_type 를 한 배너로 통합.
//   드레인(= Claude Code 배치, MCP)이 DB status/진행률 갱신 → 폴링/수동 새로고침 반영.
//   작업 0건이면 자체 숨김. (구 CurationJobsBanner + QuizJobsBanner 병합)

'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, RefreshCw, X } from 'lucide-react'

import {
  fetchCurationJobsAction,
  fetchQuizJobsAction,
  fetchReviewJobsAction,
} from '@/app/admin/curation/actions'
import type {
  CurationJobRow,
  CurationJobStatus,
  QuizJobRow,
  ReviewJobRow,
} from '@/lib/library/admin-queries'

const REVIEW_LABEL: Record<ReviewJobRow['taskType'], string> = {
  level_verify: '레벨',
  vocab_audit: '어휘',
}

/** 검토 result jsonb 요약 — verdict/assessed 를 짧게. 없으면 null. */
function reviewSummary(result: Record<string, unknown> | null): string | null {
  if (!result) return null
  const cefr = typeof result.assessed_cefr === 'string' ? result.assessed_cefr : null
  const v = typeof result.assessed_v_level === 'number' ? result.assessed_v_level : null
  const verdict = typeof result.verdict === 'string' ? result.verdict : null
  const parts: string[] = []
  if (cefr) parts.push(cefr)
  if (v != null) parts.push(`V${v}`)
  const head = parts.join('/')
  if (head && verdict) return `${head} (${verdict})`
  return head || verdict || null
}

// voice(awaiting_mapping 포함) 가 상위 집합 — 퀴즈 status 는 부분집합이라 그대로 매핑.
const STATUS_META: Record<CurationJobStatus, { label: string; color: string }> = {
  pending: { label: '대기', color: 'var(--t3)' },
  running: { label: '진행', color: 'var(--p)' },
  awaiting_mapping: { label: '매핑 대기', color: 'var(--warning)' },
  done: { label: '완료', color: 'var(--success)' },
  failed: { label: '실패', color: 'var(--error)' },
}
const STATUS_ORDER: CurationJobStatus[] = ['running', 'awaiting_mapping', 'pending', 'failed', 'done']
const ACTIVE_STATUSES = ['pending', 'running', 'awaiting_mapping']
const MODE_LABEL: Record<CurationJobRow['mode'], string> = {
  dev_process: 'dev 처리',
  dev_reprocess: 'dev 재처리',
}

export function DrainQueueBanner({ reloadKey }: { reloadKey: number }) {
  const [voice, setVoice] = useState<CurationJobRow[] | null>(null)
  const [quiz, setQuiz] = useState<QuizJobRow[] | null>(null)
  const [review, setReview] = useState<ReviewJobRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [v, q, r] = await Promise.all([
      fetchCurationJobsAction(),
      fetchQuizJobsAction(),
      fetchReviewJobsAction(),
    ])
    setLoading(false)
    if (v.ok) setVoice(v.data ?? [])
    if (q.ok) setQuiz(q.data ?? [])
    if (r.ok) setReview(r.data ?? [])
    if (v.ok || q.ok || r.ok) setDismissed(false) // 새 작업 들어오면 다시 노출
  }, [])

  // mount + reloadKey(enqueue/처리 직후) 변경 시 재조회
  useEffect(() => {
    void load()
  }, [load, reloadKey])

  const allStatuses = [
    ...(voice ?? []).map((j) => j.status as string),
    ...(quiz ?? []).map((j) => j.status as string),
    ...(review ?? []).map((j) => j.status as string),
  ]
  const total = (voice?.length ?? 0) + (quiz?.length ?? 0) + (review?.length ?? 0)
  const hasActive = allStatuses.some((s) => ACTIVE_STATUSES.includes(s))

  // active(대기/진행/매핑대기) 있으면 8초 폴링 — 드레인 진행 반영
  useEffect(() => {
    if (!hasActive) return
    const id = setInterval(() => void load(), 8000)
    return () => clearInterval(id)
  }, [hasActive, load])

  if (dismissed) return null
  if (voice === null && quiz === null && review === null) return null
  if (total === 0) return null

  const counts = allStatuses.reduce<Record<string, number>>((a, s) => {
    a[s] = (a[s] ?? 0) + 1
    return a
  }, {})
  const activeCount = (counts.pending ?? 0) + (counts.running ?? 0) + (counts.awaiting_mapping ?? 0)

  return (
    <section
      aria-label="큐레이션 드레인 큐 상태"
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
          🛠 큐레이션 드레인 큐
          <span className="font-mono text-[11px] font-[600] text-[var(--t3)]">
            {total}건
            {(voice?.length ?? 0) > 0 && ` · 🔊 ${voice?.length}`}
            {(quiz?.length ?? 0) > 0 && ` · 📝 ${quiz?.length}`}
            {(review?.length ?? 0) > 0 && ` · 🔬 ${review?.length}`}
            {activeCount > 0 && ` · 진행 ${activeCount}`}
          </span>
        </button>

        <div className="flex items-center gap-2">
          {/* 상태별 카운트 칩 (두 task 합산) */}
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
            aria-label="드레인 큐 새로고침"
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
          LibriVox 매핑 · 스크립트 퀴즈 생성을 Claude Code 배치가 처리합니다 (큐 적재됨). 진행 시 자동 갱신.
        </p>
      )}

      {/* 책별 목록 (펼침) — task_type 별 그룹 */}
      {open && (
        <div className="mt-1 flex flex-col gap-2">
          {voice && voice.length > 0 && (
            <TaskGroup title="🔊 보이스 매핑">
              {voice.map((j) => {
                const sm = STATUS_META[j.status]
                return (
                  <li key={j.id} className="flex items-center gap-2 px-3 py-1.5">
                    <Dot color={sm.color} />
                    <span className="min-w-0 flex-1 truncate font-body text-[12px] text-[var(--t1)]">
                      {j.bookTitle}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-[var(--t3)]">
                      {j.mode ? MODE_LABEL[j.mode] : '—'}
                    </span>
                    <StatusTag color={sm.color} label={sm.label} />
                    {j.error && <ErrorTag error={j.error} />}
                  </li>
                )
              })}
            </TaskGroup>
          )}
          {quiz && quiz.length > 0 && (
            <TaskGroup title="📝 스크립트 퀴즈">
              {quiz.map((j) => {
                const sm = STATUS_META[j.status]
                return (
                  <li key={j.id} className="flex items-center gap-2 px-3 py-1.5">
                    <Dot color={sm.color} />
                    <span className="min-w-0 flex-1 truncate font-body text-[12px] text-[var(--t1)]">
                      {j.bookTitle}
                    </span>
                    {j.bookVLevel != null && (
                      <span className="shrink-0 font-mono text-[10px] text-[var(--t3)]">
                        V{j.bookVLevel} · {j.targetPerChapter ?? '?'}문/ch
                      </span>
                    )}
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--t3)]">
                      {j.chaptersDone}/{j.chaptersTotal}ch · {j.questionsCreated}문
                    </span>
                    <StatusTag color={sm.color} label={sm.label} />
                    {j.error && <ErrorTag error={j.error} />}
                  </li>
                )
              })}
            </TaskGroup>
          )}
          {review && review.length > 0 && (
            <TaskGroup title="🔬 품질 검토">
              {review.map((j) => {
                const sm = STATUS_META[j.status]
                const summary = reviewSummary(j.result)
                return (
                  <li key={j.id} className="flex items-center gap-2 px-3 py-1.5">
                    <Dot color={sm.color} />
                    <span className="min-w-0 flex-1 truncate font-body text-[12px] text-[var(--t1)]">
                      {j.bookTitle}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-[var(--t3)]">
                      {REVIEW_LABEL[j.taskType]}
                    </span>
                    {summary && (
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--t2)]">
                        {summary}
                      </span>
                    )}
                    <StatusTag color={sm.color} label={sm.label} />
                    {j.error && <ErrorTag error={j.error} />}
                  </li>
                )
              })}
            </TaskGroup>
          )}
        </div>
      )}
    </section>
  )
}

function TaskGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)]">
      <div className="border-b border-[var(--bd)] px-3 py-1 font-mono text-[10px] font-[700] uppercase tracking-wider text-[var(--t3)]">
        {title}
      </div>
      <ul className="flex flex-col divide-y divide-[var(--bd)]/60">{children}</ul>
    </div>
  )
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  )
}

function StatusTag({ color, label }: { color: string; label: string }) {
  return (
    <span className="shrink-0 font-display text-[10px] font-[700]" style={{ color }}>
      {label}
    </span>
  )
}

function ErrorTag({ error }: { error: string }) {
  return (
    <span
      className="max-w-[180px] shrink-0 truncate font-mono text-[10px] text-[var(--error)]"
      title={error}
    >
      {error}
    </span>
  )
}
