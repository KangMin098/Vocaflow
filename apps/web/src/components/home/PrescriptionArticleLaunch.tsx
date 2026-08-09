// apps/web/src/components/home/PrescriptionArticleLaunch.tsx
//
// 처방 읽기 블록의 article 후보 런처 (client).
// article 은 URL 직결 불가 — startArticleLearning 서버액션이 texts 행으로 변환(멱등) 후 /text/[id]?mode=read.
// book 후보는 서버 컴포넌트에서 <Link href="/library/books/[id]"> 로 직결하므로 이 컴포넌트는 article 전용.

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'

import { startArticleLearning } from '@/lib/articles/start-learning'

export function PrescriptionArticleLaunch({
  articleId,
  label = '읽기',
}: {
  articleId: string
  label?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLaunch() {
    if (busy) return
    setBusy(true)
    setError(null)
    const res = await startArticleLearning(articleId)
    if (res.ok) {
      router.push(`/text/${res.textId}?mode=read`)
      return
    }
    setError(res.error)
    setBusy(false)
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleLaunch}
        disabled={busy}
        aria-label={`${label} 시작`}
        className="inline-flex min-h-[36px] items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-2.5 font-display text-[12px] font-[700] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[var(--p)] hover:bg-[var(--p-light)] hover:text-[var(--on-p-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] disabled:cursor-progress disabled:opacity-60 active:translate-y-0"
      >
        {busy ? (
          <Loader2 size={12} strokeWidth={2.25} className="animate-spin" aria-hidden />
        ) : (
          <ArrowRight size={12} strokeWidth={2.25} aria-hidden />
        )}
        {label}
      </button>
      {error && (
        <span className="font-body text-[11px] text-[var(--error)]" role="alert">
          {error}
        </span>
      )}
    </span>
  )
}
