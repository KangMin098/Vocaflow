'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Upload,
  XCircle,
} from 'lucide-react'
import {
  listMethodASources,
  runMethodAExtract,
} from '@/lib/vcb/server/method-a'
import type {
  MethodASourceListItem,
  MethodAExtractResult,
} from '@vocaflow/vcb-curate-core'

interface Props {
  runId: number
  runStatus: string
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function VcbMethodACard({ runId, runStatus }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [sources, setSources] = useState<MethodASourceListItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [runningSourceId, setRunningSourceId] = useState<number | null>(null)
  const [resultsBySource, setResultsBySource] = useState<
    Record<number, MethodAExtractResult>
  >({})

  const refresh = useCallback(async () => {
    setLoading(true)
    const r = await listMethodASources(runId)
    setLoading(false)
    if (!r.ok || !r.data) {
      setError(r.error ?? 'list failed')
      return
    }
    setError(null)
    setSources(r.data.sources)
  }, [runId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const canRun =
    !isPending &&
    (runStatus === 'created' ||
      runStatus === 'ingesting' ||
      runStatus === 'normalized' ||
      runStatus === 'extracted')

  const handleRun = (sourceId: number) => {
    setError(null)
    setRunningSourceId(sourceId)
    startTransition(async () => {
      const r = await runMethodAExtract(runId, sourceId)
      setRunningSourceId(null)
      if (!r.ok || !r.data) {
        setError(r.error ?? 'extract failed')
        return
      }
      setResultsBySource((prev) => ({ ...prev, [sourceId]: r.data! }))
      await refresh()
      router.refresh()
    })
  }

  const eligible = sources.filter((s) => s.storage_key !== null)
  const withoutFile = sources.filter((s) => s.storage_key === null)

  return (
    <section
      className="p-5 rounded-[var(--r-lg)] border"
      style={{
        background: 'var(--bg)',
        borderColor: 'var(--bd)',
      }}
    >
      <header className="flex items-start gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center shrink-0"
          style={{ background: 'var(--info-light)', color: 'var(--info)' }}
        >
          <Upload className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-base m-0" style={{ color: 'var(--t1)' }}>
            Method A · Ingest + Extract (Step 2 + 3)
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
            Storage 의 업로드 파일 → SHA-256 dedup → WLP 토큰화 → seed_candidates 적재.
            normalize 는 WLP 가 NFC 정규화로 흡수.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void refresh() }}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-[var(--r-md)] text-xs border"
          style={{
            background: 'var(--bg)',
            borderColor: 'var(--bd)',
            color: 'var(--t2)',
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          새로고침
        </button>
      </header>

      {loading && sources.length === 0 && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--t3)' }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          source 목록 로드 중…
        </div>
      )}

      {!loading && sources.length === 0 && (
        <div
          className="p-4 rounded-[var(--r-md)] text-sm"
          style={{ background: 'var(--bg2)', color: 'var(--t2)' }}
        >
          업로드된 Method A source 가 없습니다.{' '}
          <a
            href="/admin/vocab/sources/new"
            className="underline"
            style={{ color: 'var(--p)' }}
          >
            새 Source 등록
          </a>
          {' '}으로 CSV/TXT 파일을 먼저 업로드하세요.
        </div>
      )}

      {eligible.length > 0 && (
        <div className="flex flex-col gap-2">
          {eligible.map((src) => {
            const isThisRunning = runningSourceId === src.source_id
            const result = resultsBySource[src.source_id]
            const isDone = src.already_ingested || result?.ok === true

            return (
              <div
                key={src.source_id}
                className="p-3 rounded-[var(--r-md)] border"
                style={{
                  background: isDone ? 'var(--bg)' : 'var(--bg2)',
                  borderColor: isDone ? 'var(--success)' : 'var(--bd)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-[var(--r-md)] flex items-center justify-center shrink-0"
                    style={{
                      background: isDone ? 'var(--success-light)' : 'var(--bg3)',
                      color: isDone ? 'var(--success)' : 'var(--t3)',
                    }}
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-sm font-semibold" style={{ color: 'var(--t1)' }}>
                      {src.title}
                    </div>
                    <div className="text-[11px] mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--t3)' }}>
                      <span className="font-mono">{src.slug}</span>
                      <span className="font-mono">{src.license_tier}</span>
                      {src.storage_key && (
                        <span className="font-mono truncate" title={src.storage_key}>
                          {src.storage_key}
                        </span>
                      )}
                      {src.already_ingested && !result && (
                        <span style={{ color: 'var(--success)' }}>
                          이미 ingest 됨 (raw_text #{src.raw_text_id})
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRun(src.source_id)}
                    disabled={!canRun || isPending || isThisRunning || (src.already_ingested && !result)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-xs font-display font-semibold disabled:opacity-50"
                    style={{ background: 'var(--p)', color: 'var(--ti)' }}
                  >
                    {isThisRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {isThisRunning
                      ? '실행 중…'
                      : src.already_ingested && !result
                        ? '완료'
                        : result?.ok
                          ? '재실행'
                          : '추출 실행'}
                  </button>
                </div>

                {result && result.ok && (
                  <div
                    className="mt-2 p-2 rounded-[var(--r-md)] text-[11px] font-mono grid grid-cols-2 gap-x-4 gap-y-0.5"
                    style={{
                      background: 'var(--success-light)',
                      color: 'var(--t2)',
                    }}
                  >
                    <span>bytes</span><span>{result.bytes?.toLocaleString() ?? '—'}</span>
                    <span>tokens (total / content)</span><span>{result.total_tokens?.toLocaleString() ?? '—'} / {result.content_tokens?.toLocaleString() ?? '—'}</span>
                    <span>unique lemmas</span><span>{result.unique_lemmas?.toLocaleString() ?? '—'}</span>
                    <span>candidates inserted</span><span style={{ color: 'var(--success)' }}>{result.candidates_inserted?.toLocaleString() ?? 0}</span>
                    <span>candidates skipped (dup)</span><span>{result.candidates_skipped?.toLocaleString() ?? 0}</span>
                    <span>tokens dropped</span><span>{result.drop_stats?.dropped_total?.toLocaleString() ?? 0}</span>
                    <span>duration</span><span>{result.duration_ms ? fmtMs(result.duration_ms) : '—'}</span>
                  </div>
                )}

                {result && !result.ok && (
                  <div
                    className="mt-2 p-2 rounded-[var(--r-md)] text-xs flex items-start gap-2"
                    style={{ background: 'var(--error-light)', color: 'var(--error)' }}
                  >
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{result.error}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {withoutFile.length > 0 && (
        <div
          className="mt-3 p-3 rounded-[var(--r-md)] text-xs"
          style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}
        >
          <strong>{withoutFile.length}건 의 source 는 파일이 없어 추출 불가:</strong>
          <ul className="mt-1 ml-4 list-disc">
            {withoutFile.slice(0, 5).map((s) => (
              <li key={s.source_id} style={{ color: 'var(--t2)' }}>
                <span className="font-mono">{s.slug}</span> — Sources 페이지에서 파일을 업로드하세요
              </li>
            ))}
            {withoutFile.length > 5 && (
              <li style={{ color: 'var(--t3)' }}>… 외 {withoutFile.length - 5}건</li>
            )}
          </ul>
        </div>
      )}

      {error && (
        <div
          className="mt-3 p-3 rounded-[var(--r-md)] flex items-start gap-2"
          style={{ background: 'var(--error-light)', color: 'var(--error)' }}
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-sm m-0">{error}</p>
        </div>
      )}
    </section>
  )
}
