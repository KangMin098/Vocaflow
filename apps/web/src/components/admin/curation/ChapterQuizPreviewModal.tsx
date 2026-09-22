// apps/web/src/components/admin/curation/ChapterQuizPreviewModal.tsx
//
// Admin 전용 챕터 퀴즈 미리보기 모달 (도서 검수).
// - 학습자 플레이 화면과 달리 정답을 처음부터 노출 — 검수 시점이라 적절.
// - 문항별: 질문(EN+KO) · 4지선다(정답 초록+체크, 오답 중립) · 본문 근거 snippet(Lora italic).
// - 데이터는 서버(authed admin)에서 pre-fetch → props 로 전달(모달 client fetch 없음, RLS 안전).
// - 껍데기는 `ui/Dialog`(DD-68 · tines-mapping §28) — Esc · 바깥 · 뒤로가기 · 포커스는 그 계약.

'use client'

import { CheckCircle2, Quote } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import type { AdminChapterQuiz } from '@/lib/library/admin-quiz-queries'

interface Props {
  chapter: AdminChapterQuiz | null
  onClose: () => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function ChapterQuizPreviewModal({ chapter, onClose }: Props) {
  if (!chapter) return null

  return (
    <Dialog
      onClose={onClose}
      size="lg"
      crumbs={['Admin', '도서 큐레이션', `Ch.${chapter.chapterIdx}`]}
      title={chapter.chapterTitle}
      ariaLabel={`Ch.${chapter.chapterIdx} ${chapter.chapterTitle} 퀴즈 미리보기`}
      byline="정답·본문 근거를 함께 보여 주는 검수용 화면"
      tags={[
        `${chapter.questions.length}문항`,
        ...(chapter.bookVLevel != null ? [`V${chapter.bookVLevel}`] : []),
      ]}
      footer={
        <p className="font-body text-[10px] leading-relaxed text-[var(--t2)]">
          ※ 정답(초록)·본문 근거는 검수 확인용 — 학습자 플레이 화면에는 노출되지 않습니다.
        </p>
      }
    >
        <div className="space-y-4">
          {chapter.questions.length === 0 ? (
            <p className="font-body text-[13px] text-[var(--t2)]">문항이 없어요.</p>
          ) : (
            chapter.questions.map((q) => (
              <article
                key={q.id}
                className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[var(--r-full)] bg-[var(--p)]/10 font-display text-[11px] font-[700] tabular-nums text-[var(--p-hover)]">
                    {q.qOrder}
                  </span>
                  <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-1 font-display text-[9px] font-[700] uppercase tracking-wider text-[var(--t2)]">
                    {q.type}
                  </span>
                </div>

                <p className="font-display text-[14px] font-[600] leading-snug text-[var(--t1)]">
                  {q.question}
                </p>
                {q.questionKo && (
                  <p className="mt-1 font-body text-[12px] leading-snug text-[var(--t2)]">
                    {q.questionKo}
                  </p>
                )}

                <ul className="mt-3 flex flex-col gap-2">
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
                            isCorrect ? 'text-[var(--success)]' : 'text-[var(--t2)]'
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
                            <span className="ml-1.5 font-body text-[11px] text-[var(--t2)]">
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
                  <div className="mt-3 flex items-start gap-2 border-t border-[var(--bd)]/60 pt-3">
                    <Quote size={12} aria-hidden className="mt-1 shrink-0 text-[var(--t2)]" />
                    <p className="font-english text-[12px] italic leading-relaxed text-[var(--t2)]">
                      {q.sourceSnippet}
                    </p>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
    </Dialog>
  )
}
