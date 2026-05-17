// apps/web/src/components/library/EnrollModal.tsx
// LCP v2.0 Phase 8 — 라이브러리 책 enroll 모달
// CLAUDE.md §"폰트" + §"Modal" + §"Colors CSS Variables" 정합

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { enrollBook } from '@/lib/library/enroll'
import { createClient } from '@/lib/supabase/client'

export interface EnrollModalProps {
  bookId: string
  bookTitle: string
  bookAuthor?: string | null
  cefrLevel?: string | null
  chapterCount: number
  wordCount: number
  readingMinutes: number
  /** chapter 1 첫 30줄 정도의 미리보기 텍스트 */
  previewText: string
  open: boolean
  onClose: () => void
}

export function EnrollModal({
  bookId,
  bookTitle,
  bookAuthor,
  cefrLevel,
  chapterCount,
  wordCount,
  readingMinutes,
  previewText,
  open,
  onClose,
}: EnrollModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleEnroll(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const client = createClient()
      const textIds = await enrollBook(client, bookId)
      if (textIds.length === 0) {
        throw new Error('No chapters created')
      }
      // 첫 chapter workspace 진입
      router.push(`/text/${textIds[0]}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enrollment failed')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="enroll-modal-title"
    >
      <div
        className="
          relative max-w-md w-[92%]
          bg-[var(--bg)] rounded-[var(--r-lg)]
          shadow-[var(--sh-xl)] border border-[var(--bd)]
          p-6
        "
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={loading}
          className="
            absolute top-4 right-4 w-8 h-8 rounded-full
            flex items-center justify-center
            text-[var(--t3)] hover:text-[var(--t1)]
            hover:bg-[var(--bg2)]
            transition-colors duration-[var(--dur-fast)]
            disabled:opacity-50
          "
          aria-label="모달 닫기"
        >
          ×
        </button>

        <h2
          id="enroll-modal-title"
          className="font-display font-[700] text-[20px] text-[var(--t1)] mb-1 pr-8"
        >
          {bookTitle}
        </h2>

        {bookAuthor && (
          <p className="font-body text-[13px] text-[var(--t3)] mb-3">
            {bookAuthor}
          </p>
        )}

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {cefrLevel && (
            <span
              className="
                px-2 py-0.5 rounded text-[11px] font-[600]
                bg-[var(--p-light)] text-[var(--p-dark)]
              "
            >
              {cefrLevel}
            </span>
          )}
          <span className="font-mono text-[11px] text-[var(--t3)]">
            {chapterCount}장 · {wordCount.toLocaleString()}단어 · 약{' '}
            {readingMinutes}분
          </span>
        </div>

        <div
          className="
            font-english text-[14px] leading-relaxed text-[var(--t2)]
            bg-[var(--bg2)] border-l-[3px] border-[var(--p)]
            p-3 rounded-r mb-5 max-h-32 overflow-y-auto
          "
        >
          {previewText}
        </div>

        {error && (
          <div
            className="
              text-[var(--error)] text-[13px] mb-3
              bg-[var(--error-light)] rounded p-2
            "
          >
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="
              flex-1 px-4 py-3 rounded-[var(--r-md)]
              border border-[var(--bd)]
              font-display font-[600] text-[var(--t2)]
              hover:bg-[var(--bg2)]
              transition-colors duration-[var(--dur-fast)]
              disabled:opacity-50
            "
          >
            취소
          </button>
          <button
            onClick={handleEnroll}
            disabled={loading}
            className="
              flex-1 px-4 py-3 rounded-[var(--r-md)]
              bg-gradient-to-br from-[var(--p)] to-[var(--p-dark)]
              text-[var(--ti)] font-display font-[600]
              hover:opacity-90 active:scale-[0.97]
              transition-all duration-[var(--dur-normal)]
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {loading ? '추가 중…' : '내 학습에 추가'}
          </button>
        </div>
      </div>
    </div>
  )
}
