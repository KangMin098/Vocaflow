// apps/web/src/components/library/vocab/SubscribeSuccessToast.tsx
//
// 구독 직후 결과 토스트.
// - 새로 가져온 단어 수 / 이미 보유 단어 수 분기 안내
// - "내 단어장에서 보기" → /wordvault 직행
// - 5초 자동 소멸 + 수동 닫기

'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { ArrowRight, CheckCircle2, X } from 'lucide-react'

export interface SubscribeToastData {
  setTitle: string
  importedCount: number
  alreadyOwnedCount: number
  totalWords: number
}

interface Props {
  data: SubscribeToastData | null
  onClose: () => void
}

export function SubscribeSuccessToast({ data, onClose }: Props) {
  useEffect(() => {
    if (!data) return
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [data, onClose])

  if (!data) return null

  const body =
    data.totalWords === 0
      ? '단어가 없는 세트예요'
      : data.importedCount === 0
        ? `${data.alreadyOwnedCount.toLocaleString()}개 모두 이미 가지고 있어요`
        : data.alreadyOwnedCount === 0
          ? `${data.importedCount.toLocaleString()}개 단어가 추가됐어요`
          : `새 단어 ${data.importedCount.toLocaleString()}개 추가 · 이미 보유 ${data.alreadyOwnedCount.toLocaleString()}개 건너뜀`

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[60] flex w-[min(440px,calc(100vw-32px))] -translate-x-1/2 items-start gap-3 rounded-[var(--r-lg)] border-l-[3.5px] border-[var(--success)] bg-[var(--success-light)] px-4 py-3 shadow-[var(--sh-lg)]"
    >
      <CheckCircle2 size={20} className="shrink-0 text-[var(--success)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[13px] font-[700] text-[#065f46]">
          {data.setTitle} 추가 완료
        </p>
        <p className="mt-0.5 font-body text-[12px] text-[#065f46]/90">{body}</p>
        {data.importedCount > 0 && (
          <Link
            href="/wordvault/browse"
            className="mt-2 inline-flex items-center gap-1 font-display text-[12px] font-[700] text-[#065f46] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--success)] focus-visible:ring-offset-1"
          >
            내 단어장에서 보기
            <ArrowRight size={12} aria-hidden />
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-full)] text-[#065f46]/70 transition-colors hover:bg-[var(--success)]/15 hover:text-[#065f46]"
        aria-label="알림 닫기"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  )
}
