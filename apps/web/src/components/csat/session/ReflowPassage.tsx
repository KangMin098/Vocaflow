// apps/web/src/components/csat/session/ReflowPassage.tsx
'use client'

import { splitSentences } from '@/lib/csat/passage-skeleton'

/** Learner PDF text only: preserve paragraphs during the initial scan. */
export function PlainPassage({ passage }: { passage: string }) {
  const bounds = splitSentences(passage)
  const paragraphs: string[][] = []
  bounds.forEach((bound, i) => {
    if (!paragraphs.length || (i > 0 && /\n\s*\n/.test(passage.slice(bounds[i - 1].end, bound.start)))) paragraphs.push([])
    paragraphs[paragraphs.length - 1].push(passage.slice(bound.start, bound.end))
  })
  return <div className="font-english text-[18px] leading-[1.65] text-[var(--t1)] sm:text-[19px] break-words flex max-w-[65ch] flex-col gap-4" lang="en" data-testid="passage">
    {paragraphs.map((paragraph, index) => <p key={index}>{paragraph.join(' ')}</p>)}
  </div>
}
