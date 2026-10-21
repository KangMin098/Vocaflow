// apps/web/src/components/workspace/TypePopover.tsx
//
// 읽기 본문 글자 크기 · 줄 간격 설정(앵커형 설정 패널).
// 2026-10-18 learner-tines-audit S3 ④ — 열 때 **현재 값**을 읽는다. 예전에는 열리는 순간 자기 초기값(19px · 1.85)을
// 문서에 써서 고르지 않아도 본문이 바뀌었고, 고른 값은 저장되지 않았다. 「기본」 칸은 실제 기본값(15px · 1.55 —
// v06.62 사용자 피드백)과 같아야 거짓이 아니다. 저장 · 적용은 `lib/reader/type-prefs`.

'use client'

import { useEffect, useRef, useState } from 'react'
import { POPOVER_MENU } from '@/components/ui/tines-kit'
import { usePopoverFocus } from '@/lib/ui/use-popover-focus'
import {
  applyReaderTypePrefs,
  readReaderTypePrefs,
  saveReaderTypePrefs,
  type ReaderTypePrefs,
} from '@/lib/reader/type-prefs'

interface TypePopoverProps {
  id?: string
  onClose: () => void
}

/** 첫 칸 = 기본값(15px). 「A」 글자 크기는 칸이 무엇을 바꾸는지 보이는 표시다. */
const FONT_SIZES = [
  { px: 15, label: 'A', size: 12, name: '기본' },
  { px: 17, label: 'A', size: 14, name: '조금 크게' },
  { px: 19, label: 'A', size: 16, name: '크게' },
  { px: 22, label: 'A', size: 18, name: '아주 크게' },
]

/** 가운데 = 기본값(1.55). 막대 간격은 칸이 무엇을 바꾸는지 보이는 표시다. */
const LINE_HEIGHTS = [
  { value: 1.4, label: '좁게', gap: '2px' },
  { value: 1.55, label: '기본', gap: '4px' },
  { value: 1.85, label: '넓게', gap: '6px' },
]

export function TypePopover({ id, onClose }: TypePopoverProps) {
  const [prefs, setPrefs] = useState<ReaderTypePrefs>(readReaderTypePrefs)
  const ref = useRef<HTMLDivElement>(null)
  usePopoverFocus(ref)

  /** 고를 때만 적용 · 저장한다 — 여는 것만으로는 본문이 바뀌지 않는다. */
  const choose = (patch: Partial<ReaderTypePrefs>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    applyReaderTypePrefs(next)
    saveReaderTypePrefs(next)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const outsideTimer = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0)
    document.addEventListener('keydown', handleKey)
    return () => {
      clearTimeout(outsideTimer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div
      id={id}
      ref={ref}
      className={`absolute right-0 top-[calc(100%+8px)] z-[70] w-60 p-4 ${POPOVER_MENU}`}
      role="dialog"
      aria-label="타이포 설정"
    >
      {/* Font Size */}
      <div className="mb-4">
        <p className="mb-2 font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t2)]">
          글자 크기
        </p>
        <div className="flex gap-1 rounded-[var(--r-md)] bg-[var(--bg2)] p-[4px]">
          {FONT_SIZES.map((opt) => (
            <button
              key={opt.px}
              type="button"
              onClick={() => choose({ fontSize: opt.px })}
              aria-pressed={prefs.fontSize === opt.px}
              aria-label={`글자 크기 ${opt.name}`}
              className={`flex min-h-11 flex-1 items-center justify-center rounded-[var(--r-sm)] font-english transition-all duration-[var(--dur-normal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--p)] ${
                prefs.fontSize === opt.px
                  ? 'bg-[var(--bg)] text-[var(--t1)] shadow-[var(--sh-sm)]'
                  : 'text-[var(--t2)] hover:text-[var(--t1)]'
              } `}
              style={{ fontSize: `${opt.size}px` }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Line Height */}
      <div>
        <p className="mb-2 font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t2)]">
          줄 간격
        </p>
        <div className="flex gap-1 rounded-[var(--r-md)] bg-[var(--bg2)] p-[4px]">
          {LINE_HEIGHTS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => choose({ lineHeight: opt.value })}
              aria-label={`줄 간격 ${opt.label}`}
              aria-pressed={prefs.lineHeight === opt.value}
              className={`flex min-h-11 flex-1 items-center justify-center rounded-[var(--r-sm)] transition-all duration-[var(--dur-normal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--p)] ${
                prefs.lineHeight === opt.value
                  ? 'bg-[var(--bg)] shadow-[var(--sh-sm)]'
                  : 'hover:bg-[var(--bg)]'
              } `}
            >
              <span className="flex flex-col items-center justify-center" style={{ gap: opt.gap }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="block h-[1.5px] w-4 rounded-full"
                    style={{
                      background: prefs.lineHeight === opt.value ? 'var(--p)' : 'var(--t3)',
                    }}
                  />
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
