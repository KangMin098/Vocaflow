// apps/web/src/app/admin/error.tsx
//
// Admin 전용 에러 경계.
//
// 없을 때 무슨 일이 벌어졌나: admin 화면 49개 중 어느 하나가 서버에서 throw 하면
// 루트 `app/error.tsx` 가 잡는다. 그 화면은 `min-h-screen` 전면 카드라 **AdminLayout 의
// 사이드바까지 통째로 대체한다** — 관리자는 오류 하나 때문에 다른 화면으로 갈 길을 잃고
// 주소를 직접 치거나 새로고침해야 했다. 파이프라인 12개를 오가며 쓰는 콘솔에서 이건
// "한 칸 실패" 가 아니라 "콘솔 전체 정지" 다.
//
// 이 파일은 admin 세그먼트 안에서 잡으므로 사이드바가 남는다. 즉 **실패한 화면 한 칸만**
// 대체된다. 하위 디렉터리에 더 좁은 error.tsx 를 두면 그쪽이 우선한다.
//
// digest 를 항상 보여주는 이유: 프로덕션에서 메시지는 지워지지만 digest 는 서버 로그와
// 짝이 맞는 유일한 끈이다. 관리자 전용 화면이라 노출해도 사용자 정보가 새지 않는다.

'use client'

import { AlertTriangle, ArrowLeft, RotateCw } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[admin] 화면 렌더 실패:', error)
  }, [error])

  return (
    <div className="p-6 sm:p-8">
      <div className="mx-auto max-w-2xl rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-sm)]">
        <div className="flex items-start gap-3">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--error-light)] text-[var(--error-ink)]"
            aria-hidden
          >
            <AlertTriangle size={16} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[#8B5CF6]">
              Admin Console
            </p>
            <h1 className="font-display text-[20px] font-[800] tracking-tight text-[var(--t1)]">
              이 화면을 그리지 못했습니다
            </h1>
            <p className="mt-1 font-body text-[13px] leading-relaxed text-[var(--t2)]">
              다른 화면은 그대로 쓸 수 있습니다 — 왼쪽 메뉴는 살아 있습니다. 대개 질의
              시간초과이거나 이 화면이 읽는 테이블·RPC 가 바뀐 경우입니다.
            </p>
          </div>
        </div>

        <pre className="mt-4 max-h-40 overflow-auto rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3 text-left font-mono text-[11px] leading-snug text-[var(--t2)]">
          {error.message || '(메시지 없음)'}
          {error.digest ? `\n\ndigest: ${error.digest}` : ''}
        </pre>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[#8B5CF6] px-4 font-display text-[13px] font-[600] text-white transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[#7C3AED] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] disabled:opacity-50"
          >
            <RotateCw size={14} strokeWidth={2} aria-hidden />
            다시 시도
          </button>
          <Link
            href="/admin"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[13px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"
          >
            <ArrowLeft size={14} strokeWidth={2} aria-hidden />
            대시보드로
          </Link>
        </div>
      </div>
    </div>
  )
}
