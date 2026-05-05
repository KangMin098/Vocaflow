// apps/web/src/components/admin/MockBanner.tsx
// 모든 관리자 페이지 상단에 표시되는 미세 배너
// — Phase 1.5 단계임을 신규 개발자/이해관계자에게 알림
// — 디자인: 차분, 비방해, 닫기 가능 (sessionStorage)

'use client'

import { FlaskConical, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'admin:mock-banner-dismissed'

export function MockBanner() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setDismissed(sessionStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  if (dismissed) return null

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-[var(--bd)] bg-[#F5F3FF]/60 px-4 py-2 backdrop-blur md:px-6"
    >
      <FlaskConical size={12} className="shrink-0 text-[#8B5CF6]" aria-hidden />
      <p className="min-w-0 flex-1 truncate font-mono text-[10px] font-[600] uppercase tracking-[0.10em] text-[#6D28D9]">
        Phase 1.5 · Mock 데이터 표시 중 — 액션 버튼은 시각 검증용입니다
      </p>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(STORAGE_KEY, '1')
          setDismissed(true)
        }}
        aria-label="배너 닫기"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#6D28D9]/70 hover:bg-[#8B5CF6]/10 hover:text-[#6D28D9]"
      >
        <X size={11} />
      </button>
    </div>
  )
}
