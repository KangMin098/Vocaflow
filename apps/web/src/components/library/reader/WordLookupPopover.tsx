// apps/web/src/components/library/reader/WordLookupPopover.tsx
// 본문 단어 클릭 시 뜨는 사전 툴팁 — 자체 dict+lemma 해소 (외부 의존 없음).
//
// found: 해소 단어 + 한국어 뜻 + 품사·CEFR·V-Level + 예문 + 발음(Web Speech).
// not_found: "사전에 없는 단어" (불어·고유명사·OCR — 영어 어휘 아님) + 발음만.
//
// 위치: anchorRect(클릭한 단어의 viewport 좌표) 아래에 fixed 배치, 뷰포트 클램프.
// 닫기: 바깥 클릭 · Esc · 스크롤.

'use client'

import { lookupWord, type WordLookup } from '@/lib/library/reader-queries'
import { createClient } from '@/lib/supabase/client'
import { Volume2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { RegisterBadge } from '@/components/library/RegisterBadge'
import { PosBadge } from '@/components/library/PosBadge'

interface WordLookupPopoverProps {
  surface: string
  anchorRect: DOMRect
  onClose: () => void
}

const POPOVER_W = 288

export function WordLookupPopover({ surface, anchorRect, onClose }: WordLookupPopoverProps) {
  const [result, setResult] = useState<WordLookup | null>(null)
  const [loading, setLoading] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  // fetch
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setResult(null)
    const client = createClient()
    lookupWord(client, surface)
      .then((r) => {
        if (!cancelled) setResult(r)
      })
      .catch(() => {
        if (!cancelled) setResult(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [surface])

  // close on Esc / scroll / outside click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onScroll = () => onClose()
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  // position — 단어 아래, 뷰포트 클램프 (공간 부족 시 위로)
  const left = Math.min(Math.max(8, anchorRect.left), window.innerWidth - POPOVER_W - 8)
  const below = anchorRect.bottom + 6
  const placeAbove = below + 220 > window.innerHeight && anchorRect.top > 240
  const top = placeAbove ? undefined : below
  const bottom = placeAbove ? window.innerHeight - anchorRect.top + 6 : undefined

  const speak = (text: string): void => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    window.speechSynthesis.speak(u)
  }

  const headWord = result?.found ? (result.resolvedWord ?? surface) : surface

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${surface} 뜻`}
      className="fixed z-[120] rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-lg)]"
      style={{ left, top, bottom, width: POPOVER_W }}
    >
      {/* header — 단어 + 발음 + 닫기 */}
      <div className="flex items-center gap-2 border-b border-[var(--bd)] px-3.5 py-2.5">
        <span className="min-w-0 flex-1 truncate font-english text-[18px] font-[600] text-[var(--t1)]">
          {headWord}
        </span>
        <button
          type="button"
          onClick={() => speak(headWord)}
          aria-label="발음 듣기"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--p-light)] text-[var(--p)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--p)] hover:text-[var(--ti)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <Volume2 size={14} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--t3)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      {/* body */}
      <div className="px-3.5 py-3">
        {loading ? (
          <div className="flex items-center gap-2 py-1">
            <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-[var(--bg3)]" />
            <span className="font-body text-[12px] text-[var(--t3)]">찾는 중…</span>
          </div>
        ) : result?.found ? (
          <FoundBody result={result} surface={surface} />
        ) : (
          <NotFoundBody />
        )}
      </div>
    </div>
  )
}

function FoundBody({ result, surface }: { result: WordLookup; surface: string }) {
  const showResolved =
    result.resolvedWord && result.resolvedWord.toLowerCase() !== surface.toLowerCase()
  return (
    <div className="flex flex-col gap-2">
      {/* meta badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <RegisterBadge register={result.wordRegister} />
        <PosBadge pos={result.pos} />
        {result.cefrLevel && (
          <span className="rounded-[var(--r-sm)] bg-[var(--p-light)] px-1.5 py-0.5 font-mono text-[10px] font-[600] text-[var(--p)]">
            {result.cefrLevel}
          </span>
        )}
        {result.vLevel != null && (
          <span className="rounded-[var(--r-sm)] bg-[var(--bg3)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--t3)]">
            V{result.vLevel}
          </span>
        )}
        {showResolved && (
          <span className="font-body text-[10px] text-[var(--t3)]">
            ← {surface} 의 원형
          </span>
        )}
      </div>

      {/* 한국어 뜻 */}
      <p className="font-body text-[14px] leading-relaxed text-[var(--t1)]">{result.meaningKo}</p>

      {/* 예문 */}
      {result.exampleEn && (
        <p className="border-l-[3px] border-[var(--bd)] pl-2 font-english text-[12px] italic leading-relaxed text-[var(--t2)]">
          {result.exampleEn}
        </p>
      )}

      {/* 자주 함께 쓰는 표현 — 데이터 있을 때만 절제 노출(Progressive Disclosure) · 최대 3개 */}
      {result.collocations && result.collocations.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {result.collocations.slice(0, 3).map((c) => (
            <span
              key={c}
              className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-english text-[11px] text-[var(--t2)]"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* 학습 차등 안내 (archaic → 읽기 참고용, 암기 대상 아님) */}
      {result.wordRegister === 'archaic_literary' && (
        <p className="font-body text-[11px] leading-relaxed text-[var(--t3)]">
          📜 고어·문어체 — 읽기 참고용이에요 (암기보다 의미만 알아두면 충분해요)
        </p>
      )}
    </div>
  )
}

function NotFoundBody() {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-body text-[13px] font-[600] text-[var(--t2)]">사전에 없는 단어예요</p>
      <p className="font-body text-[11px] leading-relaxed text-[var(--t3)]">
        외국어·고유명사이거나 인식 오류일 수 있어요. 영어 어휘가 아니면 학습 대상에서 제외됩니다.
      </p>
    </div>
  )
}
