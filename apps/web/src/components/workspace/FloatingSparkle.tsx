// apps/web/src/components/workspace/FloatingSparkle.tsx

'use client'

import { Layers, Sparkles } from 'lucide-react'
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
        className="relative flex h-12 w-12 animate-[sparkle-breathe_4s_ease-in-out_infinite] items-center justify-center rounded-full bg-gradient-to-br from-[var(--p)] to-[var(--p-dark)] text-white shadow-[0_4px_16px_rgba(59,130,246,0.35)] transition-transform duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:scale-105"
      >
        <Sparkles size={18} strokeWidth={2} aria-hidden="true" />
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
        <p className="mb-2.5 flex items-center gap-1.5 font-display text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
          <Sparkles size={11} strokeWidth={2} aria-hidden="true" />
          <span>다음 단계</span>
        </p>

        <p className="mb-4 font-english text-[16px] italic leading-snug text-[var(--t1)]">
          &ldquo;{message}&rdquo;
        </p>

        <Link
          href={ctaHref}
          onClick={() => setIsExpanded(false)}
          className="flex w-full items-center justify-center gap-1.5 rounded-[var(--r-md)] p-2.5 font-display text-[13px] font-[700] text-white no-underline transition-shadow duration-[var(--dur-normal)] hover:shadow-[var(--sh-md)]"
          style={{
            background: 'linear-gradient(135deg, var(--p) 0%, var(--p-dark) 100%)',
          }}
        >
          <Layers size={14} strokeWidth={2} aria-hidden="true" />
          <span>{ctaLabel}</span>
          <span>→</span>
        </Link>

        <button
          onClick={() => setIsExpanded(false)}
          className="mt-2 block w-full py-1.5 font-body text-[11px] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:text-[var(--t1)]"
        >
          나중에 보기
        </button>
      </div>
    </div>
  )
}
