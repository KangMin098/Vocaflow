'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Database,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Terminal,
  Upload,
} from 'lucide-react'
import {
  checkEnrichmentStatus,
  exportEnrichmentPending,
  importEnrichmentFile,
  resetStaleEnrichmentChunks,
  runEnrichmentCommand,
  type EnrichmentJobFile,
} from '@/lib/vcb/server/enrich'

interface Props {
  runId: number
  runStatus: string
  pendingCount: number
}

function formatElapsed(s: number): string {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}m ${r}s`
}

export function VcbStep5EnrichCard({ runId, runStatus, pendingCount }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [jobs, setJobs] = useState<EnrichmentJobFile[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [model, setModel] = useState<'sonnet' | 'opus' | 'haiku'>('sonnet')
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  // Initial load + auto-poll
  const refresh = useCallback(async () => {
    const r = await checkEnrichmentStatus(runId)
    if (r.ok && r.data) setJobs(r.data.jobs)
  }, [runId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const anyRunning = jobs.some((j) => j.running)
  const staleCount = jobs.filter((j) => j.file_missing).length

  useEffect(() => {
    if (!anyRunning) return
    const id = setInterval(() => { void refresh() }, 5000)
    return () => clearInterval(id)
  }, [anyRunning, refresh])

  // Auto-import when enriched.jsonl appears + validation ok (not yet imported)
  // We can't easily tell if "already imported" from filesystem, so we leave
  // import as manual click for safety. Future: store import_completed flag.

  const handleExport = () => {
    setActionError(null)
    startTransition(async () => {
      const r = await exportEnrichmentPending(runId)
      if (!r.ok) {
        setActionError(r.error ?? 'export failed')
        return
      }
      await refresh()
      router.refresh()
    })
  }

  const handleRun = (pendingFile: string) => {
    setActionError(null)
    startTransition(async () => {
      const r = await runEnrichmentCommand(pendingFile, { model })
      if (!r.ok) {
        setActionError(r.error ?? 'run failed')
        return
      }
      await refresh()
    })
  }

  const handleResetStale = () => {
    setActionError(null)
    if (
      !window.confirm(
        'pending 파일이 사라진 chunks 의 queue 상태를 pending 으로 되돌립니다.\nExport 를 다시 실행할 수 있게 됩니다.\n진행할까요?',
      )
    ) {
      return
    }
    startTransition(async () => {
      const r = await resetStaleEnrichmentChunks(runId)
      if (!r.ok || !r.data) {
        setActionError(r.error ?? 'reset failed')
        return
      }
      await refresh()
      router.refresh()
    })
  }

  const handleImport = (enrichedFile: string) => {
    setActionError(null)
    startTransition(async () => {
      const r = await importEnrichmentFile(runId, enrichedFile)
      if (!r.ok || !r.data) {
        setActionError(r.error ?? 'import failed')
        return
      }
      await refresh()
      router.refresh()
    })
  }

  const canExport =
    !isPending && (runStatus === 'looked_up' || runStatus === 'enriching') && pendingCount > 0

  const allJobsCompleted =
    jobs.length > 0 &&
    jobs.every((j) => j.enriched_exists && j.validation_ok === true)

  return (
    <section
      className="p-5 rounded-[var(--r-lg)] border"
      style={{
        background: 'var(--bg)',
        borderColor: allJobsCompleted ? 'var(--success)' : 'var(--bd)',
      }}
    >
      <header className="flex items-start gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center shrink-0"
          style={{
            background: allJobsCompleted ? 'var(--success-light)' : 'var(--p-light)',
            color: allJobsCompleted ? 'var(--success)' : 'var(--p)',
          }}
        >
          {allJobsCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-base m-0" style={{ color: 'var(--t1)' }}>
            Step 5 · AI Enrichment
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
            pending queue → JSONL export → /vcb-enrich 자동 실행 → DB 적재. 200개씩 chunk.
          </p>
        </div>
      </header>

      {/* ── Sub-step A: Export ──────────────── */}
      <section
        className="p-4 rounded-[var(--r-md)] border mb-3"
        style={{
          background: jobs.length > 0 ? 'var(--bg2)' : 'var(--bg)',
          borderColor: 'var(--bd)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center font-display text-xs font-bold"
            style={{
              background: jobs.length > 0 ? 'var(--success)' : 'var(--p-light)',
              color: jobs.length > 0 ? 'var(--ti)' : 'var(--p)',
            }}
          >
            {jobs.length > 0 ? <CheckCircle2 className="w-4 h-4" /> : 'A'}
          </div>
          <div className="flex-1">
            <div className="font-display font-semibold text-sm" style={{ color: 'var(--t1)' }}>
              Export pending
            </div>
            <div className="text-xs" style={{ color: 'var(--t3)' }}>
              {jobs.length > 0
                ? `${jobs.length}개 chunk 생성됨 · ${jobs.reduce((s, j) => s + j.pending_lines, 0).toLocaleString()}건`
                : `pending ${pendingCount.toLocaleString()}건 · 200개씩 분할`}
            </div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-md)] text-xs font-display font-semibold disabled:opacity-50"
            style={{
              background: jobs.length > 0 ? 'var(--bg)' : 'var(--p)',
              color: jobs.length > 0 ? 'var(--p)' : 'var(--ti)',
              border: jobs.length > 0 ? '1px solid var(--p)' : 'none',
            }}
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
            {jobs.length > 0 ? '추가 export' : 'Export 실행'}
          </button>
        </div>
      </section>

      {/* ── Stale detection banner ───────────── */}
      {staleCount > 0 && (
        <div
          className="mb-3 p-3 rounded-[var(--r-md)] border flex items-start gap-2"
          style={{
            background: 'var(--warning-light)',
            borderColor: 'var(--warning)',
          }}
          role="alert"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
          <div className="flex-1 text-sm">
            <div className="font-semibold" style={{ color: 'var(--warning)' }}>
              {staleCount}개 chunk 의 pending 파일이 사라졌습니다
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--t2)' }}>
              DB 에는 exported 로 마킹돼 있지만 디스크 파일이 없어 AI 실행 불가.
              아래 버튼으로 queue 상태를 pending 으로 되돌리면 Export 를 다시 할 수 있어요.
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetStale}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-xs font-display font-semibold disabled:opacity-50"
            style={{
              background: 'var(--warning)',
              color: 'var(--ti)',
            }}
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Stale 정리
          </button>
        </div>
      )}

      {/* ── Sub-step B & C: per-chunk ─────────── */}
      {jobs.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-display" style={{ color: 'var(--t2)' }}>
            모델
          </span>
          <div
            className="inline-flex rounded-[var(--r-md)] border overflow-hidden"
            style={{ borderColor: 'var(--bd)' }}
          >
            {(['sonnet', 'opus', 'haiku'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModel(m)}
                disabled={anyRunning || isPending}
                className="px-3 py-1 text-xs font-mono disabled:opacity-50"
                style={{
                  background: model === m ? 'var(--p)' : 'var(--bg)',
                  color: model === m ? 'var(--ti)' : 'var(--t2)',
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { void refresh() }}
            disabled={isPending}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-[var(--r-md)] text-xs border ml-auto"
            style={{ background: 'var(--bg)', borderColor: 'var(--bd)', color: 'var(--t2)' }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            상태 새로고침
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {jobs.map((job) => {
          const expanded = expandedLog === job.pending_file
          return (
            <div
              key={job.pending_file}
              className="p-3 rounded-[var(--r-md)] border"
              style={{
                background: job.enriched_exists ? 'var(--bg)' : 'var(--bg2)',
                borderColor: job.enriched_exists && job.validation_ok ? 'var(--success)' : 'var(--bd)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div
                    className="font-mono text-xs truncate"
                    style={{ color: 'var(--t1)' }}
                    title={job.pending_file}
                  >
                    {job.pending_file}
                  </div>
                  <div className="text-[11px] mt-0.5 flex items-center gap-3 flex-wrap" style={{ color: 'var(--t3)' }}>
                    <span>pending: {job.pending_lines}</span>
                    <span>
                      enriched: {job.enriched_lines > 0 ? job.enriched_lines : '—'}
                    </span>
                    {job.validation_ok !== null && (
                      <span style={{ color: job.validation_ok ? 'var(--success)' : 'var(--error)' }}>
                        validation: {job.validation_ok ? 'ok' : 'fail'}
                        {job.validation_summary ? ` · ${job.validation_summary}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub-step B: Run */}
                {!job.enriched_exists && (
                  <>
                    {job.file_missing ? (
                      <div
                        className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-[var(--r-sm)]"
                        style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}
                        title="pending 파일 사라짐 — Stale 정리 후 Export 재실행"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        파일 사라짐
                      </div>
                    ) : job.running ? (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--info)' }}>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {job.running_elapsed_seconds !== null
                          ? formatElapsed(job.running_elapsed_seconds)
                          : '…'}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRun(job.pending_file)}
                        disabled={isPending || anyRunning}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-xs font-display font-semibold disabled:opacity-50"
                        style={{ background: 'var(--p)', color: 'var(--ti)' }}
                      >
                        <Play className="w-3.5 h-3.5" />
                        AI 실행
                      </button>
                    )}
                  </>
                )}

                {/* Sub-step C: Import */}
                {job.enriched_exists && job.validation_ok && (
                  <button
                    type="button"
                    onClick={() => handleImport(job.enriched_file)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-xs font-display font-semibold disabled:opacity-50"
                    style={{
                      background: 'var(--success-light)',
                      color: 'var(--success)',
                      border: '1px solid var(--success)',
                    }}
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    DB import
                  </button>
                )}

                {(job.log_tail || job.running) && (
                  <button
                    type="button"
                    onClick={() => setExpandedLog(expanded ? null : job.pending_file)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-[var(--r-md)] text-xs border"
                    style={{
                      background: 'var(--bg)',
                      borderColor: 'var(--bd)',
                      color: 'var(--t3)',
                    }}
                    aria-expanded={expanded}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                )}
              </div>

              {expanded && job.log_tail && (
                <pre
                  className="mt-2 p-2 rounded-[var(--r-md)] text-[10px] font-mono overflow-x-auto whitespace-pre-wrap break-all"
                  style={{
                    background: 'var(--bg3)',
                    color: 'var(--t2)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                >
                  {job.log_tail}
                </pre>
              )}
            </div>
          )
        })}
      </div>

      {actionError && (
        <div
          className="mt-3 p-3 rounded-[var(--r-md)] flex items-start gap-2"
          style={{ background: 'var(--error-light)', color: 'var(--error)' }}
          role="alert"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm m-0">{actionError}</p>
        </div>
      )}
    </section>
  )
}
