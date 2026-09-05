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
        <p className="font-display text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--error-ink)]">
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

        {/* ⚠️ 출구는 **공개** 라우트여야 한다 — `/hub` 는 보호 라우트라, 익명 방문자가
            오류 화면에서 누르면 로그인 폼으로 튕겼다. `/` 는 로그인 여부와 무관하게 열린다. */}
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-md)] bg-[var(--p)] px-6 font-display text-[14px] font-[600] text-[var(--on-p)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:brightness-95 sm:w-auto"
          >
            다시 시도
          </button>
          <a
            href="/"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--r-md)] border border-[var(--bd)] px-6 font-display text-[14px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:brightness-95 sm:w-auto"
          >
            처음 화면으로
          </a>
        </div>
      </div>
    </div>
  )
}
