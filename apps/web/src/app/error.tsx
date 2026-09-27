// apps/web/src/app/error.tsx

'use client'

import { useEffect } from 'react'

import { SpotState } from '@/components/ui/SpotState'

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

  // DD-68 · tines-mapping §14 — 참조 404 와 같은 문법: 판면 가운데 소품(찢긴 종이비행기) · 세리프 제목 · 알약 둘.
  // ⚠️ 출구는 **공개** 라우트여야 한다 — `/hub` 는 보호 라우트라, 익명 방문자가
  //    오류 화면에서 누르면 로그인 폼으로 튕겼다. `/` 는 로그인 여부와 무관하게 열린다.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] p-6">
      <SpotState
        art="error"
        size="lg"
        role="alert"
        title="문제가 발생했어요"
        body="페이지를 표시하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        primary={{ label: '다시 시도', onClick: reset }}
        secondary={{ label: '처음 화면으로', href: '/' }}
      />
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-4 max-h-40 w-full max-w-md overflow-auto rounded-[var(--r-md)] bg-[var(--bg3)] p-3 text-left font-mono text-[11px] leading-snug text-[var(--t2)]">
          {error.message}
          {error.digest ? `

digest: ${error.digest}` : ''}
        </pre>
      )}
    </div>
  )
}
