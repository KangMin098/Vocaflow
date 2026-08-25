// apps/web/src/components/workspace/TypePopover.tsx

'use client'

import { useEffect, useRef, useState } from 'react'

interface TypePopoverProps {
  onClose: () => void
}

const FONT_SIZES = [
  { px: 16, label: 'A', size: 12 },
  { px: 18, label: 'A', size: 14 },
  { px: 19, label: 'A', size: 16 },
  { px: 22, label: 'A', size: 18 },
]

const LINE_HEIGHTS = [
  { value: 1.5, label: '좁게' },
  { value: 1.85, label: '기본' },
  { value: 2.2, label: '넓게' },
]

export function TypePopover({ onClose }: TypePopoverProps) {
  const [fontSize, setFontSize] = useState(19)
  const [lineHeight, setLineHeight] = useState(1.85)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.style.setProperty('--reader-font-size', `${fontSize}px`)
  }, [fontSize])

  useEffect(() => {
    document.documentElement.style.setProperty('--reader-line-height', String(lineHeight))
  }, [lineHeight])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-[calc(100%+8px)] z-[70] w-60 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-xl)]"
      role="dialog"
      aria-label="타이포 설정"
    >
      {/* Font Size */}
      <div className="mb-4">
        <p className="mb-2 font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
          글자 크기
        </p>
        <div className="flex gap-1 rounded-[var(--r-md)] bg-[var(--bg2)] p-[4px]">
          {FONT_SIZES.map((opt) => (
            <button
              key={opt.px}
              onClick={() => setFontSize(opt.px)}
              aria-pressed={fontSize === opt.px}
              className={`flex-1 rounded-[var(--r-sm)] py-2 font-english transition-all duration-[var(--dur-normal)] ${
                fontSize === opt.px
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
        <p className="mb-2 font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]">
          줄 간격
        </p>
        <div className="flex gap-1 rounded-[var(--r-md)] bg-[var(--bg2)] p-[4px]">
          {LINE_HEIGHTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLineHeight(opt.value)}
              aria-label={opt.label}
              aria-pressed={lineHeight === opt.value}
              className={`flex flex-1 items-center justify-center rounded-[var(--r-sm)] py-2 transition-all duration-[var(--dur-normal)] ${
                lineHeight === opt.value
                  ? 'bg-[var(--bg)] shadow-[var(--sh-sm)]'
                  : 'hover:bg-[var(--bg)]'
              } `}
            >
              <span
                className="flex flex-col items-center justify-center"
                style={{ gap: opt.value === 1.5 ? '2px' : opt.value === 1.85 ? '4px' : '6px' }}
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="block h-[1.5px] w-4 rounded-full"
                    style={{
                      background: lineHeight === opt.value ? 'var(--p)' : 'var(--t3)',
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
