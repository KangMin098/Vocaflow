// apps/web/src/components/echo/MicPermissionGate.tsx
'use client'

import { Mic, AlertCircle, RotateCcw } from 'lucide-react'
import Link from 'next/link'

import type { EchoError } from '@/lib/echo/echo-error'

interface Props {
  onGrant: () => void
  /**
   * 마이크 실패 사유. 브라우저 원문(영어 DOMException.message)을 그대로 받던 자리다 —
   * 이제 사유별 한국어 안내 + 되돌리는 법이 들어온다(M6).
   */
  error: EchoError | null
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
        <p className="mt-3 break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
          따라읽기는 원어민 음성을 듣고 따라 말해 학습하는 모듈이에요.
          <br />
          음성을 녹음해 분석한 뒤 즉시 삭제돼요.
        </p>
        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--bde)] bg-[var(--error-light)] p-3 text-left text-[var(--error-ink)]"
          >
            <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className="block font-display text-[12px] font-[700]">{error.title}</span>
              <span className="mt-1 block break-keep font-body text-[12px] leading-relaxed">
                {error.message}
              </span>
            </span>
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onGrant}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-full)] bg-[var(--p)] px-6 font-display text-[14px] font-[700] text-[var(--on-p)] shadow-[var(--sh-sm)] transition-all hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:scale-[0.97]"
          >
            <Mic size={14} aria-hidden /> {error ? '다시 시도' : '마이크 사용 허용'}
          </button>
          {/* 차단된 뒤에는 브라우저가 프롬프트를 더 띄우지 않는다 — 권한을 바꾼 다음
              눌러야 하는 것은 "허용" 이 아니라 **새로고침**이다. 그 버튼을 준다. */}
          {error && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-5 font-display text-[13px] font-[600] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:scale-[0.97]"
            >
              <RotateCcw size={13} aria-hidden /> 새로고침
            </button>
          )}
        </div>
        {/* 막다른 화면을 만들지 않는다 — 마이크가 없어도 같은 문장을 연습할 길이 있다 */}
        {error && (
          <p className="mt-4 break-keep font-body text-[12px] leading-relaxed text-[var(--t2)]">
            마이크 없이 이어가려면{' '}
            <Link
              href="/dictate"
              className="font-[600] text-[var(--p)] underline underline-offset-2 hover:text-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
            >
              받아쓰기
            </Link>
            로 같은 문장을 연습할 수 있어요.
          </p>
        )}
      </div>
    </div>
  )
}
