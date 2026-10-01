// apps/web/src/components/csat/theater/EvidenceQuote.tsx
import { findQuote } from '@/lib/csat/quote-match'

/** 기기의 현재 지문에서 확인한 인용만 표시한다. 지문 미확보도 미확인이다. */
export function EvidenceQuote({ passage, quote, truncated = false }: {
  passage: string | null
  quote: string | null
  truncated?: boolean
}) {
  const text = quote?.trim()
  if (!passage || !text) return null
  const matchText = truncated ? text.replace(/ …$/, '') : text
  if (!matchText || !findQuote(passage, matchText)) return null
  return <blockquote lang="en">{text}</blockquote>
}
