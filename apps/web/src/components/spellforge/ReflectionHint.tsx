// apps/web/src/components/spellforge/ReflectionHint.tsx

'use client'

interface ReflectionHintProps {
  visible: boolean
  message: string
  /** 학습자가 오답 안내를 다 본 뒤 직접 누르는 「다시 입력하기」 — 없으면 단추를 그리지 않는다 */
  onRetry?: () => void
}

export function ReflectionHint({ visible, message, onRetry }: ReflectionHintProps) {
  if (!visible) return null

  return (
    <div className="mt-4 flex w-full max-w-[480px] flex-col items-stretch gap-2">
      <div
        role="status"
        className="flex animate-[gentle-bounce_300ms_cubic-bezier(.34,1.56,.64,1)] items-center gap-3 rounded-[var(--r-md)] border border-l-[3px] border-[rgba(245,158,11,0.3)] border-l-[var(--active)] bg-[var(--bg)] px-4 py-4 font-english text-[13px] italic leading-snug text-[var(--t1)]"
      >
        <span className="flex-shrink-0 text-[20px]" aria-hidden="true">
          🤔
        </span>
        <span className="flex-1">{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          data-sf-retry=""
          onClick={onRetry}
          onKeyDown={(e) => {
            // 문서 전역 Enter(확인) 처리와 겹치지 않게 — 이 단추의 Enter/Space 는 단추 자신의 클릭만 한다
            if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
          }}
          className="min-h-[44px] self-end break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-body text-[14px] font-[600] text-[var(--t1)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
        >
          다시 입력하기
        </button>
      )}
    </div>
  )
}
