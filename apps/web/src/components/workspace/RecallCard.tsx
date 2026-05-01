// apps/web/src/components/workspace/RecallCard.tsx

'use client'

import type { Word } from '@/types/library'
import { Brain, Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface RecallCardProps {
  word: Word | null
  anchorRect: DOMRect | null
  onClose: () => void
  onJudge: (judgment: 'knew' | 'unsure' | 'didnt') => void
}

export function RecallCard({ word, anchorRect, onClose, onJudge }: RecallCardProps) {
  const [isRevealed, setIsRevealed] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // 카드가 변경될 때 reveal 초기화
  useEffect(() => {
    setIsRevealed(false)
  }, [word?.id])

  // 카드 외부 클릭 시 닫기
  useEffect(() => {
    if (!word) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (cardRef.current && !cardRef.current.contains(target) && !target.closest('[data-word]')) {
        onClose()
      }
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [word, onClose])

  // ESC 키로 닫기
  useEffect(() => {
    if (!word) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [word, onClose])

  if (!word || !anchorRect) return null

  // 위치 계산
  const cardWidth = 280
  const margin = 16
  let left = anchorRect.left + anchorRect.width / 2 - cardWidth / 2
  let top = anchorRect.top + window.scrollY - 8
  let isAbove = true

  if (left < margin) left = margin
  if (left + cardWidth > window.innerWidth - margin) {
    left = window.innerWidth - cardWidth - margin
  }

  // 위 공간 부족하면 아래로
  if (anchorRect.top < 200) {
    top = anchorRect.bottom + window.scrollY + 8
    isAbove = false
  }

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="단어 회상"
      className="fixed z-[100] w-[280px] animate-[fadeInScale_200ms_cubic-bezier(.34,1.56,.64,1)] rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-xl)]"
      style={{
        left: `${left}px`,
        top: isAbove ? `${top - (cardRef.current?.offsetHeight ?? 240)}px` : `${top}px`,
      }}
    >
      <p className="mb-2 flex items-center gap-1.5 font-display text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--p)]">
        <Brain size={11} strokeWidth={2} aria-hidden="true" />
        <span>기억나시나요?</span>
      </p>

      <p className="mb-1 font-english text-[22px] font-[600] text-[var(--t1)]">{word.text}</p>
      <p className="mb-4 font-mono text-[12px] text-[var(--t3)]">{word.pronunciation}</p>

      {/* Meaning Blur */}
      <div
        onClick={() => setIsRevealed(true)}
        role="button"
        tabIndex={0}
        aria-label="뜻 확인"
        onKeyDown={(e) => {
          if (e.key === 'Enter') setIsRevealed(true)
        }}
        className={`relative mb-4 flex h-[60px] cursor-pointer items-center justify-center overflow-hidden rounded-[var(--r-md)] transition-all duration-[var(--dur-normal)] ${
          isRevealed
            ? 'bg-gradient-to-br from-[var(--bg2)] to-[var(--bg3)]'
            : 'bg-gradient-to-br from-[var(--bg2)] to-[var(--bg3)] hover:from-[var(--p-light)] hover:to-[var(--bg2)]'
        } `}
      >
        {!isRevealed && (
          <>
            <span
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, var(--bg2) 0, var(--bg2) 8px, var(--bg3) 8px, var(--bg3) 16px)',
              }}
              aria-hidden="true"
            />
            <span className="relative font-display text-[11px] font-[600] uppercase tracking-[0.05em] text-[var(--t3)]">
              탭해서 뜻 확인
            </span>
          </>
        )}
        {isRevealed && (
          <p className="px-3 text-center font-body text-[14px] leading-snug text-[var(--t1)]">
            {word.meaning}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={() => onJudge('didnt')}
          className="border-[var(--error)]/30 hover:bg-[var(--error)]/15 inline-flex flex-1 items-center justify-center gap-1 rounded-[var(--r-md)] border bg-[var(--error-light)] px-2.5 py-2 font-display text-[12px] font-[600] text-[var(--error)] transition-all duration-[var(--dur-normal)]"
        >
          <X size={11} strokeWidth={2.5} aria-hidden="true" />
          모름
        </button>
        <button
          onClick={() => onJudge('unsure')}
          className="flex-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2.5 py-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]"
        >
          애매
        </button>
        <button
          onClick={() => onJudge('knew')}
          className="border-[var(--success)]/30 hover:bg-[var(--success)]/15 inline-flex flex-1 items-center justify-center gap-1 rounded-[var(--r-md)] border bg-[var(--success-light)] px-2.5 py-2 font-display text-[12px] font-[600] text-[var(--success)] transition-all duration-[var(--dur-normal)]"
        >
          <Check size={11} strokeWidth={2.5} aria-hidden="true" />
          안다
        </button>
      </div>
    </div>
  )
}
