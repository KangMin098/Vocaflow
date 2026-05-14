'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Loader2,
  Search,
} from 'lucide-react'
import { runDictionaryLookup } from '@/lib/vcb/server/dict-lookup'
import type { DictLookupSummary } from '@vocaflow/vcb-curate-core'

interface Props {
  runId: number
  runStatus: string
  seedCount: number
}

export function VcbStep4LookupCard({ runId, runStatus, seedCount }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<DictLookupSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canRun =
    !isPending && (runStatus === 'extracted' || runStatus === 'looked_up') && seedCount > 0

  const isDone = runStatus === 'looked_up' || runStatus === 'enriching' || runStatus === 'qa' ||
    runStatus === 'curating' || runStatus === 'publishing' || runStatus === 'published'

  const handleRun = () => {
    setError(null)
    setResult(null)
    startTransition(async () => {
      const r = await runDictionaryLookup(runId)
      if (!r.ok || !r.data) {
        setError(r.error ?? 'dict-lookup 실패')
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
          {isDone ? <CheckCircle2 className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-base m-0" style={{ color: 'var(--t1)' }}>
            Step 4 · 사전 매칭
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
            seed_candidates 를 shared_dictionary 에 매칭해서 vocab_dict_hits + vocab_enrichment_queue 를 생성합니다.
          </p>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleRun}
          disabled={!canRun}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--p)', color: 'var(--ti)' }}
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {isPending ? '실행 중…' : isDone ? '재실행' : '사전 매칭 실행'}
        </button>
        <span className="text-xs" style={{ color: 'var(--t3)' }}>
          후보 {seedCount.toLocaleString()}건 · DB-only, LLM 없음 · 약 {Math.max(5, Math.round(seedCount * 0.055))}초 예상
        </span>
      </div>

      {!canRun && !isPending && runStatus !== 'extracted' && runStatus !== 'looked_up' && (
        <p className="text-xs mt-2" style={{ color: 'var(--t3)' }}>
          status 가 <span className="font-mono">{runStatus}</span> 입니다. extracted 또는 looked_up 상태에서만 실행 가능합니다.
        </p>
      )}

      {result && (
        <div
          className="mt-3 p-3 rounded-[var(--r-md)] flex items-start gap-2"
          style={{ background: 'var(--success-light)', color: 'var(--success)' }}
          role="status"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <div className="font-semibold">매칭 완료 · {fmtMs(result.duration_ms)}</div>
            <div className="text-xs mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono" style={{ color: 'var(--t2)' }}>
              <span>full hits</span><span>{result.full_hits}</span>
              <span>partial hits</span><span>{result.partial_hits}</span>
              <span>misses</span><span>{result.misses}</span>
              <span>queue · enriched</span><span>{result.queue_enriched_full}</span>
              <span>queue · pending</span><span>{result.queue_pending}</span>
            </div>
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
