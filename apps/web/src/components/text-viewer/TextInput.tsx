// apps/web/src/components/text-viewer/TextInput.tsx
// 영어 스크립트 입력 textarea
// Lora serif 폰트로 영어 표시 (CLAUDE.md 규정)
//
// ── v06.35 실측 결함 (런타임 e2e 로만 드러남) ──
// textarea 에 `maxLength={5100}` 하드 속성이 걸려 있어, 20,818자를 붙여넣으면
// **브라우저가 5,100자에서 잘라내고 나머지 75%를 조용히 버렸다.**
// 경고도 없고 저장은 성공해서, 학습자는 강연 전체를 넣었다고 믿는다.
// (실측: 20,818자 입력 → 본문 783어만 인식 = 1.47배분)
//
// 원칙: **학습자가 넣은 글을 조용히 버리지 않는다.**
//   · 하드 절단 제거 — 붙여넣은 것은 전부 화면에 남는다
//   · 한도는 실제 강연 분량 기준 (50,000자 ≈ 8,000단어 ≈ 50분 강연)
//   · 넘치면 숨기지 말고 말하고, 무엇을 하면 되는지 알려준다

'use client'

import { Trash2, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'

/** 단일 스크립트 본문 상한 — 50분 강연(≈8,000단어)까지 여유로 수용. */
export const CONTENT_MAX = 50_000

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
  maxLength = CONTENT_MAX,
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
  const isNearLimit = !isOverLimit && stats.chars > maxLength * 0.9

  return (
    <div className="focus-within:ring-p/20 overflow-hidden rounded-xl border border-bd bg-bg transition-all duration-normal focus-within:border-bdf focus-within:ring-2">
      {/* Textarea — maxLength 속성 없음(의도적).
          하드 절단은 학습자의 글을 말없이 버린다. 넘치면 아래에서 알린다. */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={10}
        aria-invalid={isOverLimit}
        className="min-h-[280px] w-full resize-y bg-transparent px-s-5 py-s-4 font-serif text-base leading-[1.7] text-t1 placeholder:font-serif placeholder:italic placeholder:text-t3 focus:outline-none"
      />

      {/* 상한 초과 안내 — 무엇이 문제고 무엇을 하면 되는지 (Empathetic Feedback) */}
      {isOverLimit && (
        <p
          role="alert"
          className="flex items-start gap-s-2 border-t border-bd bg-warning-light px-s-4 py-s-3 font-body text-xs leading-relaxed text-warning-ink"
        >
          <TriangleAlert size={13} className="mt-0.5 shrink-0 text-warning" aria-hidden />
          <span>
            글이 {(stats.chars - maxLength).toLocaleString()}자 길어요. 입력한 내용은 그대로
            있으니 안심하세요 — 저장하려면 조금 줄이거나,{' '}
            <strong>책 (챕터별)</strong> 모드로 나눠 담아 주세요.
          </span>
        </p>
      )}

      {/* 하단 통계 바 */}
      <div className="flex items-center justify-between gap-s-3 border-t border-bd bg-bg2 px-s-4 py-s-2">
        <div className="flex items-center gap-s-4 font-mono text-xs uppercase tracking-wider text-t3">
          <div className="flex items-center gap-s-1">
            <span className={isOverLimit ? 'text-error' : 'text-t1'}>
              <span className="font-bold tabular-nums">{stats.words.toLocaleString()}</span> 단어
            </span>
          </div>

          <span className="text-t3">·</span>

          <div className="flex items-center gap-s-1">
            <span className={isOverLimit ? 'text-error' : isNearLimit ? 'text-warning' : 'text-t2'}>
              <span className="font-bold tabular-nums">{stats.chars.toLocaleString()}</span>
              <span className="text-t3"> / {maxLength.toLocaleString()}</span>
            </span>
          </div>

          {value && (
            <>
              <span className="text-t3">·</span>
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
