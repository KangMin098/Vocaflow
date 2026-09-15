// apps/web/src/app/(main)/my/books/[bookId]/loading.tsx
//
// /my/books/[bookId] 는 server-side redirect 전용 페이지 (getResumeTarget → /text/[next]).
// fetch 동안 빈 흰 화면 대신 깔끔한 진입 시각.

import { Loader2 } from 'lucide-react'

export default function MyBookResumeLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Loader2 size={20} className="animate-spin text-[var(--p)]" aria-hidden />
      <p className="font-body text-[12px] text-[var(--t2)]">학습 이어가기…</p>
    </div>
  )
}
