// apps/web/src/components/admin/curation/ChapterQuizPreviewModal.tsx
//
// Admin 전용 챕터 퀴즈 미리보기 모달 (도서 검수).
// - 학습자 플레이 화면과 달리 정답을 처음부터 노출 — 검수 시점이라 적절.
// - 문항별: 질문(EN+KO) · 4지선다(정답 초록+체크, 오답 중립) · 본문 근거 snippet(Lora italic).
// - 데이터는 서버(authed admin)에서 pre-fetch → props 로 전달(모달 client fetch 없음, RLS 안전).
// - Esc / 오버레이 클릭 / X 닫기 · body scroll lock.

'use client'

import { useEffect, useRef } from 'react'
import { X, CheckCircle2, Quote } from 'lucide-react'

import type { AdminChapterQuiz } from '@/lib/library/admin-quiz-queries'

interface Props {
  chapter: AdminChapterQuiz | null
  onClose: () => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function ChapterQuizPreviewModal({ chapter, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chapter) return
    const prevActive = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevActive?.focus()
    }
  }, [chapter, onClose])

  if (!chapter) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ch.${chapter.chapterIdx} ${chapter.chapterTitle} 퀴즈 미리보기`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-[var(--r-xl)] bg-[var(--bg)] shadow-[var(--sh-xl)] focus:outline-none"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--bd)] p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="rounded-[var(--r-full)] bg-[#8B5CF6]/10 px-2 py-0.5 font-display text-[10px] font-[700] text-[#6D28D9]">
                Ch.{chapter.chapterIdx}
              </span>
              <h3 className="font-display text-[16px] font-[700] text-[var(--t1)]">
                {chapter.chapterTitle}
              </h3>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-body text-[11px] text-[var(--t3)]">
              <span className="font-display font-[700] text-[var(--t1)]">
                {chapter.questions.length}문항
              </span>
              {chapter.bookVLevel != null && (
                <>
                  <span>·</span>
                  <span>V{chapter.bookVLevel}</span>
                </>
              )}
              <span>·</span>
              <span>정답·근거 노출 (검수용)</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--r-sm)] text-[var(--t3)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {chapter.questions.length === 0 ? (
            <p className="font-body text-[13px] text-[var(--t3)]">문항이 없어요.</p>
          ) : (
            chapter.questions.map((q) => (
              <article
                key={q.id}
                className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[var(--r-full)] bg-[#8B5CF6]/10 font-display text-[11px] font-[700] tabular-nums text-[#6D28D9]">
                    {q.qOrder}
                  </span>
                  <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-1.5 py-0.5 font-display text-[9px] font-[700] uppercase tracking-wider text-[var(--t3)]">
                    {q.type}
                  </span>
                </div>

                <p className="font-display text-[14px] font-[600] leading-snug text-[var(--t1)]">
                  {q.question}
                </p>
                {q.questionKo && (
                  <p className="mt-1 font-body text-[12px] leading-snug text-[var(--t3)]">
                    {q.questionKo}
                  </p>
                )}

                <ul className="mt-3 flex flex-col gap-1.5">
                  {q.options.map((opt, i) => {
                    const isCorrect = i === q.correctIndex
                    return (
                      <li
                        key={i}
                        className={`flex items-start gap-2 rounded-[var(--r-md)] border px-3 py-2 ${
                          isCorrect
                            ? 'border-[var(--success)]/40 bg-[var(--success-light)]'
                            : 'border-[var(--bd)] bg-[var(--bg)]'
                        }`}
                      >
                        <span
                          className={`mt-0.5 font-display text-[11px] font-[700] ${
                            isCorrect ? 'text-[var(--success)]' : 'text-[var(--t3)]'
                          }`}
                        >
                          {LETTERS[i] ?? i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span
                            className={`font-english text-[13px] ${
                              isCorrect
                                ? 'font-[600] text-[var(--success)]'
                                : 'text-[var(--t2)]'
                            }`}
                          >
                            {opt.text}
                          </span>
                          {opt.textKo && (
                            <span className="ml-1.5 font-body text-[11px] text-[var(--t3)]">
                              {opt.textKo}
                            </span>
                          )}
                        </div>
                        {isCorrect && (
                          <span className="flex shrink-0 items-center gap-1 font-display text-[10px] font-[700] text-[var(--success)]">
                            <CheckCircle2 size={13} aria-hidden />
                            정답
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>

                {q.sourceSnippet && (
                  <div className="mt-3 flex items-start gap-2 border-t border-[var(--bd)]/60 pt-2.5">
                    <Quote size={12} aria-hidden className="mt-1 shrink-0 text-[var(--t4)]" />
                    <p className="font-english text-[12px] italic leading-relaxed text-[var(--t3)]">
                      {q.sourceSnippet}
                    </p>
                  </div>
                )}
              </article>
            ))
          )}
        </div>

        <footer className="border-t border-[var(--bd)] bg-[var(--bg2)] p-3">
          <p className="font-body text-[10px] text-[var(--t3)]">
            ※ 정답(초록)·본문 근거는 검수 확인용 — 학습자 플레이 화면에는 노출되지 않습니다.
          </p>
        </footer>
      </div>
    </div>
  )
}
