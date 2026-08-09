// apps/web/src/components/echo/MicPermissionGate.tsx
'use client'

import { Mic, AlertCircle } from 'lucide-react'

interface Props {
  onGrant: () => void
  error: string | null
}

export function MicPermissionGate({ onGrant, error }: Props) {
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-8 text-center shadow-[var(--sh-sm)]">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--p-light)]">
          <Mic size={24} className="text-[var(--p)]" aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-[20px] font-[800] text-[var(--t1)]">
          마이크 권한이 필요해요
        </h2>
        <p className="mt-3 font-body text-[13px] leading-relaxed text-[var(--t2)]">
          따라읽기는 원어민 음성을 듣고 따라 말해 학습하는 모듈이에요.
          <br />
          음성을 녹음해 분석한 뒤 즉시 삭제돼요.
        </p>
        {error && (
          <div
            role="alert"
            className="mt-4 inline-flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--bde)] bg-[var(--error-light)] p-3 text-left font-body text-[12px] text-[var(--error-ink)]"
          >
            <AlertCircle size={12} className="mt-0.5 shrink-0" aria-hidden /> {error}
          </div>
        )}
        <button
          type="button"
          onClick={onGrant}
          className="mt-6 inline-flex items-center gap-2 rounded-[var(--r-full)] bg-[var(--p)] px-6 py-3 font-display text-[14px] font-[700] text-[var(--on-p)] shadow-[var(--sh-sm)] transition-all hover:scale-[1.02] active:scale-[0.97]"
        >
          <Mic size={14} aria-hidden /> 마이크 사용 허용
        </button>
      </div>
    </div>
  )
}
