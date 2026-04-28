// apps/web/src/components/text-viewer/ScriptDisplay.tsx
// 원문 표시 — Lora serif 폰트
// 추출된 단어 하이라이트 (선택된 단어는 더 강하게)

'use client'

import { cn } from '@/lib/utils/cn'
import { FileText } from 'lucide-react'
import { useMemo } from 'react'
import type { ExtractedWord } from './analysis-types'

export interface ScriptDisplayProps {
  text: string
  totalWords: number
  totalChars: number
  words: ExtractedWord[]
  selectedIds: Set<string>
  hoveredWordId?: string | null
  onWordClick?: (id: string) => void
}

export function ScriptDisplay({
  text,
  totalWords,
  totalChars,
  words,
  selectedIds,
  hoveredWordId,
  onWordClick,
}: ScriptDisplayProps) {
  // 단어 → ExtractedWord 매핑 (lemma 기준)
  const wordMap = useMemo(() => {
    const m = new Map<string, ExtractedWord>()
    words.forEach((w) => {
      m.set(w.word.toLowerCase(), w)
      m.set(w.lemma.toLowerCase(), w)
    })
    return m
  }, [words])

  // 텍스트를 단어 단위로 토큰화하면서 하이라이트
  const tokens = useMemo(() => {
    // 단어 + 공백/구두점 분리 (괄호 안은 그룹 1: 단어, 그 외: 구분자)
    const parts = text.split(/([a-zA-Z]+(?:'[a-zA-Z]+)?)/)
    return parts.map((part, idx) => {
      // 단어인지 확인
      if (/^[a-zA-Z]/.test(part)) {
        const matched = wordMap.get(part.toLowerCase())
        return {
          type: 'word' as const,
          text: part,
          word: matched,
          key: idx,
        }
      }
      return { type: 'delim' as const, text: part, key: idx }
    })
  }, [text, wordMap])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-bd bg-bg">
      {/* 헤더 */}
      <div className="border-b border-bd bg-bg2 px-s-5 py-s-3">
        <div className="mb-s-1 flex items-center gap-s-2">
          <FileText size={12} className="text-p" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-t3">
            — Step 02 / 원문
          </span>
        </div>
        <h3 className="font-display text-base font-bold text-t1">분석된 영어 스크립트</h3>
      </div>

      {/* 원문 본문 */}
      <div className="flex-1 overflow-y-auto px-s-5 py-s-5">
        <p className="font-serif text-base leading-[1.85] text-t1">
          {tokens.map((token) => {
            if (token.type === 'delim') {
              return <span key={token.key}>{token.text}</span>
            }

            // 추출되지 않은 단어
            if (!token.word) {
              return <span key={token.key}>{token.text}</span>
            }

            const isSelected = selectedIds.has(token.word.id)
            const isHovered = hoveredWordId === token.word.id

            return (
              <span
                key={token.key}
                onClick={() => onWordClick?.(token.word!.id)}
                className={cn(
                  'cursor-pointer rounded px-[2px] transition-all duration-fast',
                  isHovered && 'ring-2 ring-p ring-offset-1',
                  isSelected
                    ? 'bg-p-light font-semibold text-p'
                    : 'bg-warning-light/40 text-t1 hover:bg-warning-light'
                )}
                title={`${token.word.meaning} (${token.word.level})`}
              >
                {token.text}
              </span>
            )
          })}
        </p>
      </div>

      {/* 푸터 통계 */}
      <div className="border-t border-bd bg-bg2 px-s-5 py-s-3">
        <div className="flex items-center justify-between gap-s-3 font-mono text-xs uppercase tracking-wider text-t3">
          <div className="flex items-center gap-s-3">
            <span>
              <span className="font-bold tabular-nums text-t1">{totalWords}</span> 단어
            </span>
            <span className="text-t4">·</span>
            <span>
              <span className="font-bold tabular-nums text-t1">{totalChars}</span> 자
            </span>
            <span className="text-t4">·</span>
            <span>
              <span className="font-bold tabular-nums text-p">{words.length}</span> 학습 단어
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
