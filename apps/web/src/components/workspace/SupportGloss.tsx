// apps/web/src/components/workspace/SupportGloss.tsx
// 읽기-중 이해 지원 팝오버. RecallCard(학습 인출)와 분리된 수동 gloss — 단어장/SRS 진입 없음.

'use client'

import { Languages, MapPin, ScrollText, User } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SupportToken } from '@/lib/workspace/support'

interface SupportGlossProps {
  support: SupportToken | null
  anchorRect: DOMRect | null
  onClose: () => void
}

const GLOSS_WIDTH = 264

const CATEGORY_META = {
  foreign_word: { label: '외국어', tint: 'var(--info)', bg: 'var(--info-light)', Icon: Languages },
  archaic_grammar: { label: '옛 표현', tint: 'var(--warning)', bg: 'var(--warning-light)', Icon: ScrollText },
  proper_noun: { label: '고유명사', tint: 'var(--t2)', bg: 'var(--bg3)', Icon: MapPin },
} as const

export function SupportGloss({ support, anchorRect, onClose }: SupportGlossProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!anchorRect) {
      setPos(null)
      return
    }
    const margin = 8
    const left = Math.min(
      Math.max(margin, anchorRect.left),
      window.innerWidth - GLOSS_WIDTH - margin,
    )
    setPos({ top: anchorRect.bottom + margin, left })
  }, [anchorRect])

  useEffect(() => {
    if (!support) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
    }
  }, [support, onClose])

  if (!support || !pos) return null

  const meta = CATEGORY_META[support.category]
  const isPerson = support.category === 'proper_noun' && support.entityKind === 'person'
  const ChipIcon = isPerson ? User : meta.Icon
  const chipLabel =
    support.category === 'foreign_word' && support.lang
      ? support.lang
      : support.category === 'proper_noun'
        ? isPerson
          ? '인물'
          : support.entityKind === 'place'
            ? '지명'
            : '고유명사'
        : meta.label

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${chipLabel} 도움말: ${support.text}`}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: GLOSS_WIDTH }}
      className="z-[75] rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-lg)]"
    >
      {/* category chip */}
      <div className="mb-2.5 flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[700] uppercase tracking-[0.06em]"
          style={{ color: meta.tint, background: meta.bg }}
        >
          <ChipIcon size={11} strokeWidth={2} aria-hidden="true" />
          {chipLabel}
        </span>
        <span className="font-body text-[10px] text-[var(--t2)]">도움말</span>
      </div>

      {/* original surface — Lora (영어) */}
      <p className="mb-1 font-english text-[18px] font-[600] leading-snug text-[var(--t1)]">
        {support.text}
      </p>

      {/* gloss — DM Sans (한글) */}
      <p className="font-body text-[13.5px] leading-relaxed text-[var(--t2)]">{support.gloss}</p>

      {/* footer — 멘탈 모델: 학습 단어 아님 */}
      <p className="mt-3 border-t border-[var(--bd)] pt-2 font-body text-[11px] italic text-[var(--t2)]">
        학습 단어가 아니에요 · 뜻만 참고하고 지나가세요
      </p>
    </div>
  )
}
