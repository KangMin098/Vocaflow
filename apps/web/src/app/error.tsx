// apps/web/src/app/error.tsx

'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Vocaflow] App error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg2)] p-6">
      <div className="w-full max-w-md rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] p-8 text-center shadow-[var(--sh-md)]">
        <p className="font-display text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--error)]">
          Error
        </p>
        <h1 className="mt-2 font-display text-[24px] font-[800] tracking-tight text-[var(--t1)]">
          문제가 발생했어요
        </h1>
        <p className="mt-3 font-body text-[14px] leading-relaxed text-[var(--t2)]">
          페이지를 표시하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-[var(--r-md)] bg-[var(--bg3)] p-3 text-left font-mono text-[11px] leading-snug text-[var(--t2)]">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ''}
          </pre>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-[var(--r-md)] bg-[var(--p)] px-6 py-3 font-display text-[14px] font-[600] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--p-hover)]"
          >
            다시 시도
          </button>
          <a
            href="/hub"
            className="rounded-[var(--r-md)] border border-[var(--bd)] px-6 py-3 font-display text-[14px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
          >
            홈으로
          </a>
        </div>
      </div>
    </div>
  )
}
