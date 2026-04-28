// apps/web/src/components/text-viewer/TextInput.tsx
// 영어 스크립트 입력 textarea
// Lora serif 폰트로 영어 표시 (CLAUDE.md 규정)

'use client'

import { Trash2 } from 'lucide-react'
import { useMemo } from 'react'

export interface TextInputProps {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  maxLength?: number
  placeholder?: string
}

export function TextInput({
  value,
  onChange,
  onClear,
  maxLength = 5000,
  placeholder = '여기에 영어 스크립트를 입력하거나 붙여넣으세요...\n\nThe quick brown fox jumps over the lazy dog.',
}: TextInputProps) {
  // 단어 수 계산
  const stats = useMemo(() => {
    const trimmed = value.trim()
    if (!trimmed) return { words: 0, chars: 0 }
    const words = trimmed.split(/\s+/).filter((w) => w.length > 0).length
    const chars = value.length
    return { words, chars }
  }, [value])

  const isOverLimit = stats.chars > maxLength
  const isNearLimit = stats.chars > maxLength * 0.9

  return (
    <div className="focus-within:ring-p/20 overflow-hidden rounded-xl border border-bd bg-bg transition-all duration-normal focus-within:border-bdf focus-within:ring-2">
      {/* Textarea */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength + 100} // 약간의 여유 (UI는 maxLength 기준 경고)
        rows={10}
        className="min-h-[280px] w-full resize-y bg-transparent px-s-5 py-s-4 font-serif text-base leading-[1.7] text-t1 placeholder:font-serif placeholder:italic placeholder:text-t3 focus:outline-none"
      />

      {/* 하단 통계 바 */}
      <div className="flex items-center justify-between gap-s-3 border-t border-bd bg-bg2 px-s-4 py-s-2">
        <div className="flex items-center gap-s-4 font-mono text-xs uppercase tracking-wider text-t3">
          <div className="flex items-center gap-s-1">
            <span className={isOverLimit ? 'text-error' : 'text-t1'}>
              <span className="font-bold tabular-nums">{stats.words}</span> 단어
            </span>
          </div>

          <span className="text-t4">·</span>

          <div className="flex items-center gap-s-1">
            <span className={isOverLimit ? 'text-error' : isNearLimit ? 'text-warning' : 'text-t2'}>
              <span className="font-bold tabular-nums">{stats.chars}</span>
              <span className="text-t3"> / {maxLength}</span>
            </span>
          </div>

          {value && (
            <>
              <span className="text-t4">·</span>
              <span className="text-success">자동 감지: 영어</span>
            </>
          )}
        </div>

        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-s-1 rounded-md px-s-2 py-s-1 font-mono text-[10px] uppercase tracking-wider text-t3 transition-colors duration-normal hover:bg-error-light hover:text-error"
          >
            <Trash2 size={11} />
            지우기
          </button>
        )}
      </div>
    </div>
  )
}
