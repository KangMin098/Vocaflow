// apps/web/src/components/workspace/FloatingSparkle.tsx

'use client'

import { Layers } from 'lucide-react'
import { Gwonjeom } from '@/components/ui/press/Gwonjeom'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

interface FloatingSparkleProps {
  message: string
  ctaLabel: string
  ctaHref: string
}

export function FloatingSparkle({ message, ctaLabel, ctaHref }: FloatingSparkleProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="fixed bottom-20 right-8 z-[60]">
      {/* Trigger */}
      <button
        onClick={() => setIsExpanded((o) => !o)}
        aria-label="다음 단계 추천"
        aria-expanded={isExpanded}
        // v07 — 4초마다 숨쉬던 파란 그라데이션 원(끝나는 상태가 없는 장식 모션)을 멈춘 주묵 원으로.
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ju)] text-[var(--on-ju)] shadow-[var(--sh-float)] transition-transform duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)] focus-visible:ring-offset-2"
      >
        <Gwonjeom size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      {/* Card */}
      <div
        role="dialog"
        aria-label="추천"
        className={`absolute bottom-16 right-0 w-80 rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-xl)] transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)] ${
          isExpanded
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-2.5 scale-95 opacity-0'
        } `}
      >
        <p className="mb-2.5 flex items-center gap-2 font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--p)]">
          <Gwonjeom size={11} strokeWidth={2} aria-hidden="true" />
          <span>다음 단계</span>
        </p>

        {/* 추천 문구는 한국어다(`lib/recommend/decide.ts`) — Lora 가짜 이탤릭이 아니라 Hahmlet 정체(v07) */}
        <p className="mb-4 break-keep font-editorial text-[16px] leading-snug text-[var(--t1)]">
          &ldquo;{message}&rdquo;
        </p>

        <Link
          href={ctaHref}
          onClick={() => setIsExpanded(false)}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--r-sm)] bg-[var(--ju)] p-3 font-display text-[13px] font-[700] text-[var(--on-ju)] no-underline transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--ju-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)] focus-visible:ring-offset-2"
        >
          <Layers size={14} strokeWidth={2} aria-hidden="true" />
          <span>{ctaLabel}</span>
          <span>→</span>
        </Link>

        <button
          onClick={() => setIsExpanded(false)}
          className="mt-2 block min-h-[44px] w-full py-2 font-body text-[12px] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:text-[var(--t1)]"
        >
          나중에 보기
        </button>
      </div>
    </div>
  )
}
