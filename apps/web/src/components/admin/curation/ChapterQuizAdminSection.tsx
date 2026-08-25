// apps/web/src/components/admin/curation/ChapterQuizAdminSection.tsx
//
// /admin/curation/preview/[bookId] 도서 검수 페이지의 챕터 퀴즈 검수 섹션.
// - 도서별 챕터 퀴즈(library_chapter_quiz) 일람 + 문항 수 분포 + 생성 잡 상태.
// - 커버리지 경고(퀴즈 없는 챕터) + 저문항 경고(< 3문항) highlight.
// - 행 클릭 → ChapterQuizPreviewModal (문항·정답·본문 근거 확인).
// - 학습자 플레이(정답 숨김)와 구분 — admin 검수 전용(정답·근거 노출).

'use client'

import { useState } from 'react'
import { ListChecks, AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react'

import type { AdminChapterQuiz, AdminQuizJob } from '@/lib/library/admin-quiz-queries'
import { ChapterQuizPreviewModal } from './ChapterQuizPreviewModal'

interface Props {
  chapters: AdminChapterQuiz[]
  totalChapters: number
  job: AdminQuizJob | null
}

const LOW_QUESTION_THRESHOLD = 3

export function ChapterQuizAdminSection({ chapters, totalChapters, job }: Props) {
  const [selected, setSelected] = useState<AdminChapterQuiz | null>(null)

  const totalQuestions = chapters.reduce((sum, c) => sum + c.questions.length, 0)
  const avg = chapters.length > 0 ? Math.round(totalQuestions / chapters.length) : 0
  const lowChapters = chapters.filter((c) => c.questions.length < LOW_QUESTION_THRESHOLD)
  const uncovered = Math.max(0, totalChapters - chapters.length)

  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks size={16} className="text-[#8B5CF6]" aria-hidden />
          <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
            챕터 퀴즈 검수
          </h2>
          <span className="font-display text-[12px] font-[600] text-[var(--t2)]">
            {chapters.length}
            {totalChapters > 0 && (
              <span className="text-[var(--t2)]">/{totalChapters}</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3 font-body text-[11px] text-[var(--t2)]">
          {chapters.length > 0 && (
            <>
              <span>총 {totalQuestions.toLocaleString()}문항</span>
              <span>·</span>
              <span>평균 {avg}/챕터</span>
            </>
          )}
          {job && <QuizJobBadge job={job} />}
        </div>
      </header>

      {chapters.length === 0 ? (
        <div className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-4 font-body text-[13px] text-[var(--t2)]">
          <p>챕터 퀴즈가 아직 생성되지 않았어요.</p>
          <p className="mt-1.5">
            <code className="font-mono text-[11px]">/admin/curation</code> 의{' '}
            <strong className="text-[var(--t2)]">&ldquo;스크립트 퀴즈 큐&rdquo;</strong> 로 잡을
            적재하면, Claude Code 드레인이 챕터별 스토리 문항을{' '}
            <code className="font-mono text-[11px]">library_chapter_quiz</code> 에 채웁니다.
          </p>
        </div>
      ) : (
        <>
          {(uncovered > 0 || lowChapters.length > 0) && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--warning)]/30 bg-[var(--warning-light)] p-3 font-body text-[12px] text-[#92400E]"
            >
              <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                {uncovered > 0 && (
                  <>
                    <strong>{uncovered}개 챕터</strong>에 퀴즈가 없어요 (커버리지{' '}
                    {chapters.length}/{totalChapters}).
                  </>
                )}
                {uncovered > 0 && lowChapters.length > 0 && ' '}
                {lowChapters.length > 0 && (
                  <>
                    <strong>{lowChapters.length}개 챕터</strong>가 문항 &lt;{' '}
                    {LOW_QUESTION_THRESHOLD} —{' '}
                    {lowChapters.map((c) => `Ch.${c.chapterIdx}(${c.questions.length})`).join(', ')}
                  </>
                )}
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full font-body text-[12px]">
              <thead>
                <tr className="border-b border-[var(--bd)] font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t2)]">
                  <th className="py-2 pr-3 text-left">챕터</th>
                  <th className="py-2 pr-3 text-left">제목</th>
                  <th className="py-2 pr-3 text-right tabular-nums">문항수</th>
                  <th className="py-2 pr-3 text-left">확인</th>
                </tr>
              </thead>
              <tbody>
                {chapters.map((c) => {
                  const isLow = c.questions.length < LOW_QUESTION_THRESHOLD
                  return (
                    <tr
                      key={c.chapterIdx}
                      onClick={() => setSelected(c)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Ch.${c.chapterIdx} ${c.chapterTitle} 문항 확인`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelected(c)
                        }
                      }}
                      className={`cursor-pointer border-b border-[var(--bd)]/40 transition-colors hover:bg-[var(--bg2)] focus-visible:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] ${
                        isLow ? 'bg-[var(--warning-light)]/50' : ''
                      }`}
                    >
                      <td className="py-2 pr-3 font-display font-[700] text-[var(--t1)]">
                        Ch.{c.chapterIdx}
                      </td>
                      <td className="py-2 pr-3 text-[var(--t2)]">{c.chapterTitle}</td>
                      <td
                        className={`py-2 pr-3 text-right tabular-nums ${
                          isLow ? 'font-[700] text-[#92400E]' : 'text-[var(--t1)]'
                        }`}
                      >
                        {c.questions.length}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1 text-[#6D28D9]">
                          <ListChecks size={11} aria-hidden />
                          미리보기
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 font-body text-[10px] text-[var(--t2)]">
            ※ 행 클릭으로 문항 + 정답 + 본문 근거 미리보기 ·{' '}
            <code className="font-mono">library_chapter_quiz</code> · 학습자 공유(정답 숨김)
          </p>
        </>
      )}

      <ChapterQuizPreviewModal chapter={selected} onClose={() => setSelected(null)} />
    </section>
  )
}

function QuizJobBadge({ job }: { job: AdminQuizJob }) {
  const label = `${job.chaptersDone}/${job.chaptersTotal}`
  if (job.status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--success-light)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--success)]">
        <CheckCircle2 size={11} aria-hidden />
        done {label}
      </span>
    )
  }
  if (job.status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--error-light)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--error-ink)]">
        <XCircle size={11} aria-hidden />
        failed {label}
      </span>
    )
  }
  if (job.status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--warning-light)] px-2 py-1 font-display text-[10px] font-[700] text-[#92400E]">
        <Loader2 size={11} aria-hidden className="animate-spin" />
        running {label}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--t2)]">
      {job.status} {label}
    </span>
  )
}
