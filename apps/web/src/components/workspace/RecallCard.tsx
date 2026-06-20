// apps/web/src/components/workspace/RecallCard.tsx
// v06.34 — 가장 간단한 단어 팝업: 단어·뜻·듣기만, 인터랙션 없음.
//   - "기억나시나요?" 헤더 제거
//   - 뜻 blur reveal 제거 → 즉시 표시
//   - 모름/애매/안다 3-button 판정 제거
//   - 단어 노출 시 자동 TTS 1회 + 듣기 버튼으로 재재생 가능

'use client'

import type { Word } from '@/types/library'
import { Volume2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'
import { PosBadge } from '@/components/library/PosBadge'
import { ZoomableImage } from '@/components/ui/ZoomableImage'

interface RecallCardProps {
  word: Word | null
  anchorRect: DOMRect | null
  onClose: () => void
  /** 그림책 단어면 그 페이지 삽화 url — Dual Coding(Paivio) 시각 단서 */
  illustrationUrl?: string | null
}

export function RecallCard({ word, anchorRect, onClose, illustrationUrl }: RecallCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const { speak, isPlaying } = useSpeechSynthesis({ lang: 'en-US', rate: 0.9 })

  // 위치 계산 — fixed(뷰포트). 위 공간 충분하면 위, 아니면 아래.
  useLayoutEffect(() => {
    if (!word || !anchorRect) {
      setPos(null)
      return
    }
    const CARD_WIDTH = 264
    const margin = 12
    const gap = 8
    const cardH = cardRef.current?.offsetHeight ?? 140
    let left = anchorRect.left + anchorRect.width / 2 - CARD_WIDTH / 2
    left = Math.min(Math.max(margin, left), window.innerWidth - CARD_WIDTH - margin)
    const top =
      anchorRect.top >= cardH + gap
        ? anchorRect.top - cardH - gap
        : anchorRect.bottom + gap
    setPos({ top, left })
  }, [word?.id, anchorRect])

  // 단어 변경 시 자동 1회 발음 (Dual Coding — 시각+청각)
  useEffect(() => {
    if (!word) return
    const id = window.setTimeout(() => speak(word.text), 80)
    return () => window.clearTimeout(id)
  }, [word?.id, word?.text, speak])

  // 외부 클릭 / ESC 로 닫기
  useEffect(() => {
    if (!word) return
    const onMouse = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (cardRef.current && !cardRef.current.contains(t) && !t.closest('[data-word]')) {
        onClose()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const tid = window.setTimeout(() => document.addEventListener('mousedown', onMouse), 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(tid)
      document.removeEventListener('mousedown', onMouse)
    }
  }, [word, onClose])

  if (!word || !anchorRect) return null

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`${word.text} 뜻: ${word.meaning}`}
      className="fixed z-[100] w-[264px] animate-[fadeInScale_180ms_cubic-bezier(.34,1.56,.64,1)] rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-lg)]"
      style={{
        left: pos ? `${pos.left}px` : '-9999px',
        top: pos ? `${pos.top}px` : '0px',
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {/* 그림책 삽화 — Dual Coding 시각 단서 (단어가 등장한 페이지 장면) */}
      {illustrationUrl && (
        <div className="mb-2.5 overflow-hidden rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]">
          <ZoomableImage
            src={illustrationUrl}
            alt={word.text}
            className="block h-28 w-full object-cover"
          />
        </div>
      )}

      {/* 단어 + 듣기 한 줄 */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-english text-[22px] font-[600] leading-tight text-[var(--t1)]">
          {word.text}
        </p>
        <button
          type="button"
          onClick={() => speak(word.text)}
          aria-label="발음 듣기"
          className={`shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-full)] transition-colors ${
            isPlaying
              ? 'bg-[var(--p)] text-[var(--ti)]'
              : 'bg-[var(--p-light)] text-[var(--p)] hover:bg-[var(--p)] hover:text-[var(--ti)]'
          }`}
        >
          <Volume2 size={13} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      {/* 품사 배지 + 발음 IPA */}
      {(word.pos || word.pronunciation) && (
        <div className="mt-1 flex items-center gap-2">
          <PosBadge pos={word.pos} />
          {word.pronunciation && (
            <span className="font-mono text-[11.5px] text-[var(--t3)]">
              {word.pronunciation}
            </span>
          )}
        </div>
      )}

      {/* 뜻 — DM Sans 즉시 표시 */}
      <p className="mt-2 font-body text-[14px] leading-snug text-[var(--t1)]">{word.meaning}</p>
    </div>
  )
}
