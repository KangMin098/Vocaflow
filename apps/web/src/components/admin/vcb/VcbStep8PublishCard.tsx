'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Rocket,
  XCircle,
} from 'lucide-react'
import { runPublish } from '@/lib/vcb/server/publish'
import type { PrecheckResult, PublishResult } from '@vocaflow/vcb-curate-core'

interface Props {
  runId: number
  runStatus: string
  precheck: PrecheckResult
}

export function VcbStep8PublishCard({ runId, runStatus, precheck }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<PublishResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<boolean>(false)

  const alreadyPublished = runStatus === 'published'
  const canPublish = !isPending && !alreadyPublished && precheck.ok && confirmed

  const handlePublish = () => {
    setError(null)
    setResult(null)
    if (
      !window.confirm(
        `${precheck.stats.publishable_count}건을 공용 단어장으로 발행합니다.\n발행분은 수정할 수 없고, 새 버전으로만 갱신됩니다.\n진행할까요?`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const r = await runPublish(runId)
      if (!r.ok || !r.data) {
        setError(r.error ?? 'publish failed')
        return
      }
      setResult(r.data)
      router.refresh()
    })
  }

  return (
    <section
      className="p-5 rounded-[var(--r-lg)] border"
      style={{
        background: 'var(--bg)',
        borderColor: alreadyPublished ? 'var(--success)' : precheck.ok ? 'var(--p)' : 'var(--bd)',
      }}
    >
      <header className="flex items-start gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center shrink-0"
          style={{
            background: alreadyPublished ? 'var(--success-light)' : 'var(--p-light)',
            color: alreadyPublished ? 'var(--success)' : 'var(--p)',
          }}
        >
          {alreadyPublished ? <CheckCircle2 className="w-5 h-5" /> : <Rocket className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-base m-0" style={{ color: 'var(--t1)' }}>
            Step 8 · Publish
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
            승인된 단어를 공용 단어장으로 발행합니다. 발행분은 수정 불가(새 버전으로만 갱신).
          </p>
        </div>
      </header>

      {/* Precheck stats */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-[var(--r-md)] overflow-hidden mb-3"
        style={{ background: 'var(--bd)' }}
      >
        {[
          { label: 'publishable', value: precheck.stats.publishable_count, color: 'var(--p)' },
          { label: 'enriched', value: precheck.stats.queue_enriched, color: 'var(--t1)' },
          { label: 'flagged', value: precheck.stats.queue_enriched_flagged, color: precheck.stats.queue_enriched_flagged > 0 ? 'var(--warning)' : 'var(--t3)' },
          { label: 'rejected', value: precheck.stats.rejected_by_curator, color: precheck.stats.rejected_by_curator > 0 ? 'var(--error)' : 'var(--t3)' },
        ].map((s) => (
          <div key={s.label} className="p-3" style={{ background: 'var(--bg)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--t3)' }}>
              {s.label}
            </div>
            <div className="font-display font-bold text-lg" style={{ color: s.color }}>
              {s.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Blockers */}
      {precheck.blockers.length > 0 && (
        <div
          className="mb-3 p-3 rounded-[var(--r-md)] border"
          style={{
            background: 'var(--error-light)',
            borderColor: 'var(--error)',
          }}
        >
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--error)' }} />
            <div className="flex-1">
              <div className="font-semibold text-xs" style={{ color: 'var(--error)' }}>
                발행 차단 사유 {precheck.blockers.length}건
              </div>
              <ul className="mt-1.5 space-y-0.5 text-xs" style={{ color: 'var(--t2)' }}>
                {precheck.blockers.map((b, i) => (
                  <li key={i} className="font-mono">· {b}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {precheck.warnings.length > 0 && (
        <div
          className="mb-3 p-3 rounded-[var(--r-md)] border"
          style={{
            background: 'var(--warning-light)',
            borderColor: 'var(--warning)',
          }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
            <div className="flex-1">
              <div className="font-semibold text-xs" style={{ color: 'var(--warning)' }}>
                주의 {precheck.warnings.length}건
              </div>
              <ul className="mt-1.5 space-y-0.5 text-xs" style={{ color: 'var(--t2)' }}>
                {precheck.warnings.map((w, i) => (
                  <li key={i}>· {w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation gate + Publish button */}
      {!alreadyPublished && precheck.ok && (
        <>
          <label className="flex items-start gap-2 cursor-pointer p-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={isPending}
              className="mt-0.5 w-4 h-4 accent-[var(--p)]"
            />
            <span className="text-xs" style={{ color: 'var(--t2)' }}>
              발행분은 <strong>수정할 수 없어요</strong>. 새 버전 발행으로만 갱신됩니다. 확인했습니다.
            </span>
          </label>

          <button
            type="button"
            onClick={handlePublish}
            disabled={!canPublish}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-[var(--r-md)] font-display text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            style={{ background: 'var(--p)', color: 'var(--ti)' }}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            {isPending ? '발행 중…' : `${precheck.stats.publishable_count}건 발행`}
          </button>
        </>
      )}

      {alreadyPublished && (
        <p className="text-xs" style={{ color: 'var(--t2)' }}>
          이 run 은 이미 발행되었습니다. 변경 시 new version 으로 새 run 을 생성하세요.
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
            <div className="font-semibold">발행 완료 · version {result.version} · {result.published_count}건</div>
            <div className="text-xs mt-1 grid grid-cols-2 gap-x-4 gap-y-1 font-mono" style={{ color: 'var(--t2)' }}>
              <span>shared_word_set_id</span><span className="truncate" title={result.shared_word_set_id ?? ''}>{result.shared_word_set_id?.slice(0, 8) ?? '—'}…</span>
              <span>collection_id</span><span>#{result.collection_id ?? '—'}</span>
            </div>
            <p className="text-xs mt-2">
              ▶ <a href="/admin/vocab/collections" className="underline" style={{ color: 'var(--p)' }}>
                Collections 목록 보기
                <ExternalLink className="w-3 h-3 inline ml-0.5" />
              </a>
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          className="mt-3 p-3 rounded-[var(--r-md)] flex items-start gap-2"
          style={{ background: 'var(--error-light)', color: 'var(--error)' }}
          role="alert"
        >
          <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm m-0">{error}</p>
        </div>
      )}
    </section>
  )
}
