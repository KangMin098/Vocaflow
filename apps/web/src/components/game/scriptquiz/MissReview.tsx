// apps/web/src/components/game/scriptquiz/MissReview.tsx
// P-2 — 결과 화면 오답 복기. 틀린 문항을 펼치면 등록된 근거 문장을 본문 앞뒤 문장과 함께 강조해 보여 주고,
// 근거를 읽은 뒤 선지를 다시 고르게 한다. 정답은 다시 고르거나 「정답 보기」를 누른 뒤에만 펼친다.
// ⚠️ 다시 고르기는 기록·점수·숙달 어디에도 넣지 않는다 — 이미 채점된 답(QuizAnswer)만 쓴다.
// ⚠️ 등록된 근거(sourceSnippet)가 없는 문항은 다시 고르기를 막고 이유를 말한다 — 근거 없이 다시 묻지 않는다.

'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import type { QuizAnswer, QuizQuestion } from './types'
import { locateEvidence, splitSentences } from '@/lib/scriptquiz/evidence'

export interface EvidenceContext {
  /** 화면 순서대로의 문장 — 근거 앞 1문장 · 근거 · 근거 뒤 1문장 */
  sentences: { text: string; isEvidence: boolean }[]
}

/**
 * 근거 snippet 을 본문에서 찾아 앞뒤 한 문장씩 붙인다. 본문에서 못 찾으면 snippet 하나만 근거로 둔다
 * (근거 자체는 서버가 채점하며 준 등록 근거다 — 본문 위치를 모를 뿐). snippet 이 비면 null.
 */
export function buildEvidenceContext(passage: string | undefined, snippet: string): EvidenceContext | null {
  const s = snippet.trim()
  if (!s) return null
  if (passage && passage.trim()) {
    const sentences = splitSentences(passage)
    const hits = locateEvidence(sentences, s)
    if (hits.length > 0) {
      const from = Math.max(0, hits[0] - 1)
      const to = Math.min(sentences.length - 1, hits[hits.length - 1] + 1)
      const hitSet = new Set(hits)
      const out: EvidenceContext['sentences'] = []
      for (let i = from; i <= to; i++) out.push({ text: sentences[i], isEvidence: hitSet.has(i) })
      return { sentences: out }
    }
  }
  return { sentences: [{ text: s, isEvidence: true }] }
}

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'

export function MissReviewItem({
  question,
  answer,
  passage,
  defaultOpen = false,
}: {
  question: QuizQuestion
  answer: QuizAnswer
  passage?: string
  /** 처음부터 펼친 상태로 — 서버 렌더 테스트용. 화면은 접힌 채 시작한다. */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  /** 다시 고른 선지. 'reveal' = 고르지 않고 정답만 봤다. 기록하지 않는다. */
  const [repick, setRepick] = useState<number | 'reveal' | null>(null)
  const panelId = useId()
  // 「정답 보기」 버튼은 누르면 사라진다 — 포커스를 정답 선지로 옮겨 body 로 떨어지지 않게
  const correctRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (repick === 'reveal') correctRef.current?.focus()
  }, [repick])
  const context = buildEvidenceContext(passage, answer.sourceSnippet)
  const decided = repick !== null || context === null
  const correctText = question.options[answer.correctIndex]?.text ?? '—'
  const mine = answer.selectedIndex >= 0 ? question.options[answer.selectedIndex]?.text ?? '—' : '시간이 지나 못 골랐어요'

  return (
    <li className="rounded-[var(--r-md)] border-l-4 border-[var(--active)] bg-[var(--active-light)]/40 p-3" data-testid="miss-item">
      {/* 영어 본문은 세션 내내 같은 서체(Lora)로 — 문제 화면과 갈리면 같은 문장이 두 얼굴이 된다. */}
      <p className="font-english text-[13px] font-[600] leading-[1.6] text-[var(--t1)]">{question.question}</p>

      {/* 내 답 / 정답 — 색만으로 구분하지 않는다(아이콘 + 라벨 동반). 정답은 복기를 마친 뒤에 편다. */}
      <dl className="mt-2 flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <dt className="inline-flex shrink-0 items-center gap-1 font-display text-[11px] font-[700] text-[var(--error-ink)]">
            <X size={12} strokeWidth={3} aria-hidden />
            <span className="break-keep">내 답</span>
          </dt>
          <dd className="min-w-0 flex-1 font-english text-[12.5px] leading-relaxed text-[var(--t2)]">{mine}</dd>
        </div>
        {decided && (
          <div className="flex items-start gap-2" data-testid="miss-correct">
            <dt className="inline-flex shrink-0 items-center gap-1 font-display text-[11px] font-[700] text-[var(--success)]">
              <Check size={12} strokeWidth={3} aria-hidden />
              <span className="break-keep">정답</span>
            </dt>
            <dd className="min-w-0 flex-1 font-english text-[12.5px] font-[600] leading-relaxed text-[var(--t1)]">{correctText}</dd>
          </div>
        )}
      </dl>

      {context === null ? (
        <p className="mt-2 break-keep font-body text-[12px] leading-relaxed text-[var(--t2)]" data-testid="miss-no-evidence">
          이 문항은 등록된 근거 문장이 없어 근거와 대조해 다시 고를 수 없어요.
        </p>
      ) : (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className={`mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-md)] px-2 font-display text-[12px] font-[700] text-[var(--t1)] hover:bg-[var(--bg)] ${FOCUS}`}
          >
            <ChevronDown size={14} aria-hidden className={open ? 'rotate-180' : undefined} />
            <span className="break-keep">근거와 대조해 다시 판단하기</span>
          </button>
          {open && (
            <div id={panelId} className="mt-2 flex flex-col gap-3" data-testid="miss-panel">
              <blockquote className="rounded-[var(--r-md)] bg-[var(--bg)] p-3 font-english text-[13px] leading-[1.7] text-[var(--t2)]">
                {context.sentences.map((s, i) =>
                  s.isEvidence ? (
                    <mark
                      key={i}
                      data-testid="miss-evidence"
                      className="rounded-[2px] bg-[var(--success-light)] px-0.5 font-[600] text-[var(--t1)] underline decoration-[var(--success)] decoration-2 underline-offset-4"
                    >
                      {s.text}{' '}
                    </mark>
                  ) : (
                    <span key={i}>{s.text} </span>
                  ),
                )}
              </blockquote>
              <p className="break-keep font-display text-[12px] font-[700] text-[var(--t1)]">
                밑줄 친 근거 문장을 읽고 다시 골라 보세요
                <span className="ml-2 font-body text-[11.5px] font-[500] text-[var(--t2)]">기록·점수에는 들어가지 않아요</span>
              </p>
              <ol className="flex flex-col gap-2">
                {question.options.map((o, i) => {
                  const isCorrect = decided && i === answer.correctIndex
                  const isRepick = repick === i
                  const isFirst = i === answer.selectedIndex
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        ref={i === answer.correctIndex ? correctRef : undefined}
                        data-repick-option={i}
                        aria-disabled={decided || undefined}
                        onClick={() => {
                          if (!decided) setRepick(i)
                        }}
                        className={[
                          'flex min-h-[44px] w-full items-start gap-3 rounded-[var(--r-md)] border bg-[var(--bg)] px-3 py-2 text-left',
                          FOCUS,
                          isCorrect ? 'border-[var(--success)]' : isRepick ? 'border-dashed border-[var(--p)]' : 'border-[var(--bd)]',
                          decided ? 'cursor-default' : 'hover:border-[var(--p)]',
                        ].join(' ')}
                      >
                        <span className="flex-1 font-english text-[13px] leading-[1.6] text-[var(--t1)]">{o.text}</span>
                        <span className="shrink-0 break-keep font-display text-[11px] font-[700] text-[var(--t2)]">
                          {isCorrect && (
                            <span className="inline-flex items-center gap-1 text-[var(--success)]">
                              <Check size={12} strokeWidth={3} aria-hidden />
                              정답
                            </span>
                          )}
                          {isRepick && !isCorrect && <span>다시 고른 답</span>}
                          {!isRepick && isFirst && <span className="ml-1">처음 고른 답</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
              {repick === null ? (
                <button
                  type="button"
                  onClick={() => setRepick('reveal')}
                  className={`min-h-[44px] self-start rounded-[var(--r-md)] px-3 font-display text-[12px] font-[600] text-[var(--t2)] underline-offset-4 hover:underline ${FOCUS}`}
                >
                  정답 보기(건너뛰기)
                </button>
              ) : (
                <p role="status" className="break-keep font-body text-[12.5px] leading-relaxed text-[var(--t2)]" data-testid="miss-status">
                  {repickMessage(repick, answer.correctIndex)}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </li>
  )
}

/** 다시 고른 뒤 한 줄 — 「다시 고른 답」은 채점·기록이 아니라 근거와의 대조를 권하는 문장이다. */
export function repickMessage(repick: number | 'reveal', correctIndex: number): string {
  if (repick === 'reveal') return '표시된 선지가 정답이에요. 근거 문장과 견줘 보세요.'
  if (repick === correctIndex) return '근거를 보고 정답을 골랐어요. 처음 답과 무엇이 달랐는지 근거 문장에서 확인해 보세요.'
  return '이번에도 정답과 달라요. 표시된 정답이 근거 문장의 어느 부분과 맞닿는지 찾아보세요.'
}
