'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react'
import { runQaGate } from '@/lib/vcb/server/qa'
import type { QaSummary } from '@vocaflow/vcb-curate-core'

interface Props {
  runId: number
  runStatus: string
  enrichedCount: number
}

export function VcbStep6QaCard({ runId, runStatus, enrichedCount }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<QaSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [requeue, setRequeue] = useState<boolean>(false)

  const canRun =
    !isPending &&
    (runStatus === 'enriching' || runStatus === 'qa') &&
    enrichedCount > 0

  const isDone =
    runStatus === 'qa' ||
    runStatus === 'curating' ||
    runStatus === 'publishing' ||
    runStatus === 'published'

  const handleRun = () => {
    setError(null)
    setResult(null)
    startTransition(async () => {
      const r = await runQaGate(runId, { requeueFlagged: requeue })
      if (!r.ok || !r.data) {
        setError(r.error ?? 'qa failed')
        return
      }
      setResult(r.data)
      router.refresh()
    })
  }

  const fmtMs = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <section
      className="p-5 rounded-[var(--r-lg)] border"
      style={{
        background: 'var(--bg)',
        borderColor: isDone ? 'var(--success)' : 'var(--bd)',
      }}
    >
      <header className="flex items-start gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center shrink-0"
          style={{
            background: isDone ? 'var(--success-light)' : 'var(--info-light)',
            color: isDone ? 'var(--success)' : 'var(--info)',
          }}
        >
          {isDone ? <CheckCircle2 className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-base m-0" style={{ color: 'var(--t1)' }}>
            Step 6 · QA Gate
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
            enriched payload 에 R1~R8 룰 적용 → qa_flags 적재 + 상태 분류 (enriched / enriched_flagged / failed)
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleRun}
          disabled={!canRun}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--p)', color: 'var(--ti)' }}
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {isPending ? '실행 중…' : isDone ? '재실행' : 'QA 실행'}
        </button>

        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={requeue}
            onChange={(e) => setRequeue(e.target.checked)}
            disabled={isPending}
            className="w-4 h-4 accent-[var(--warning)]"
          />
          <span className="text-xs font-display" style={{ color: 'var(--t2)' }}>
            flagged 항목 다시 enrichment 대기열로
          </span>
        </label>

        <span className="text-xs ml-auto" style={{ color: 'var(--t3)' }}>
          enriched {enrichedCount.toLocaleString()}건 · 약 {Math.max(2, Math.round(enrichedCount * 0.008))}초 예상
        </span>
      </div>

      {!canRun && !isPending && runStatus !== 'enriching' && runStatus !== 'qa' && (
        <p className="text-xs mt-2" style={{ color: 'var(--t3)' }}>
          status 가 <span className="font-mono">{runStatus}</span> 입니다. enriching 또는 qa 상태에서만 실행 가능합니다.
        </p>
      )}

      {result && (
        <div
          className="mt-3 p-3 rounded-[var(--r-md)] flex items-start gap-2"
          style={{
            background:
              result.failed > 0
                ? 'var(--warning-light)'
                : result.flagged > 0
                  ? 'var(--warning-light)'
                  : 'var(--success-light)',
            color:
              result.failed > 0
                ? 'var(--warning)'
                : result.flagged > 0
                  ? 'var(--warning)'
                  : 'var(--success)',
          }}
          role="status"
        >
          {result.failed === 0 && result.flagged === 0 ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div className="text-sm flex-1">
            <div className="font-semibold">QA 완료 · {fmtMs(result.duration_ms)}</div>
            <div className="text-xs mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono" style={{ color: 'var(--t2)' }}>
              <span>passed</span><span>{result.passed}</span>
              <span>flagged</span><span style={{ color: result.flagged > 0 ? 'var(--warning)' : 'inherit' }}>{result.flagged}</span>
              <span>failed</span><span style={{ color: result.failed > 0 ? 'var(--error)' : 'inherit' }}>{result.failed}</span>
              <span>autofixed</span><span>{result.autofixed}</span>
              <span>payload missing</span><span>{result.payload_missing}</span>
              <span>requeued</span><span>{result.requeued}</span>
              <span>NGSL 로드</span><span>{result.ngsl_loaded}</span>
              <span>denylist (brand / profanity)</span>
              <span>{result.denylist_counts.brand} / {result.denylist_counts.profanity}</span>
            </div>
            {result.flagged > 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--t2)' }}>
                ▶ flagged 항목은 <a
                  href={`/admin/vocab/curate/${runId}`}
                  className="underline"
                  style={{ color: 'var(--p)' }}
                >큐레이션 화면</a> 에서 검토하세요.
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div
          className="mt-3 p-3 rounded-[var(--r-md)] flex items-start gap-2"
          style={{ background: 'var(--error-light)', color: 'var(--error)' }}
          role="alert"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm m-0">{error}</p>
        </div>
      )}
    </section>
  )
}
