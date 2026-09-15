// apps/web/src/components/echo/SentenceCarousel.tsx
'use client'

import type { EchoSentence } from './EchoMatchPlayer'

interface Props {
  sentence: EchoSentence
  index: number
  total: number
}

export function SentenceCarousel({ sentence, index, total }: Props) {
  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-sm)] md:p-8">
      <p className="mb-3 font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t2)]">
        문장 {index + 1} / {total}
      </p>
      <p className="font-english text-[18px] leading-relaxed text-[var(--t1)] md:text-[22px]">
        &ldquo;{sentence.text}&rdquo;
      </p>
    </section>
  )
}
