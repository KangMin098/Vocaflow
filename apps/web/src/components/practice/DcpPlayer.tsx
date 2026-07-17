// apps/web/src/components/practice/DcpPlayer.tsx
//
// CTP DCP(구문 연습) 플레이어 — 오늘 처방 practice 블록의 order/insert 문항 세션.
// 흐름: 문항 → 제출(grade_dcp_item 서버 채점) → 피드백(정답/오답+정답 공개) → 오답 시 error_cause 1-tap → 다음 → 요약.
// Calm UI · Empathetic Feedback(비난 대신 격려) · 색+아이콘 이중부호 · aria-live · 44px+ · 다크 토큰.

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Home, Sparkles, X } from 'lucide-react'

import {
  correctOrderFromKey,
  type DcpErrorCause,
  type DcpGradeResult,
  type DcpInsertPayload,
  type DcpItem,
  type DcpOrderPayload,
  ERROR_CAUSES,
} from '@/lib/learner/dcp'
import { gradeDcpItem, recordDcpErrorCause } from '@/lib/learner/dcp-actions'

import { DcpInsertItem, DcpOrderItem } from './DcpItems'

type Phase = 'answering' | 'grading' | 'graded' | 'done'

export function DcpPlayer({ items }: { items: DcpItem[] }) {
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('answering')
  const [result, setResult] = useState<DcpGradeResult | null>(null)
  const [cause, setCause] = useState<DcpErrorCause | null>(null)
  const [correctCount, setCorrectCount] = useState(0)

  const item = items[idx]
  const total = items.length
  const isLast = idx === total - 1

  async function handleSubmit(answer: Record<string, unknown>) {
    if (!item) return
    setPhase('grading')
    const res = await gradeDcpItem(item.id, answer)
    setResult(res)
    if (res.correct) setCorrectCount((c) => c + 1)
    setPhase('graded')
  }

  async function handleCause(next: DcpErrorCause) {
    setCause(next)
    if (result?.attemptId) await recordDcpErrorCause(result.attemptId, next)
  }

  function handleNext() {
    if (isLast) {
      setPhase('done')
      return
    }
    setIdx((i) => i + 1)
    setResult(null)
    setCause(null)
    setPhase('answering')
  }

  // ── 완료 요약 ──
  if (phase === 'done') {
    return (
      <section
        aria-label="구문 연습 완료"
        className="flex flex-col items-center gap-4 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-8 text-center shadow-[var(--sh-sm)]"
      >
        <span
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]"
          aria-hidden
        >
          <Sparkles size={26} strokeWidth={2} />
        </span>
        <div>
          <h2 className="font-display text-[18px] font-[800] text-[var(--t1)]">오늘 구문 연습을 마쳤어요</h2>
          <p className="mt-1 font-body text-[13px] text-[var(--t2)]">
            {total}문항 중 {correctCount}문항을 정확히 배열했어요. 꾸준함이 실력이 돼요.
          </p>
        </div>
        <Link
          href="/hub"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--ti)] no-underline shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          <Home size={16} strokeWidth={2} aria-hidden />
          홈으로
        </Link>
      </section>
    )
  }

  if (!item) return null

  return (
    <section aria-label="구문 연습" className="flex flex-col gap-4">
      {/* 진행 */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-[12px] font-[700] text-[var(--t3)]">
          {idx + 1} / {total}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg3)]" aria-hidden>
          <div
            className="h-full rounded-full bg-[var(--p)] transition-[width] duration-[var(--dur-normal)]"
            style={{ width: `${((idx + (phase === 'graded' ? 1 : 0)) / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4 shadow-[var(--sh-sm)]">
        {phase === 'graded' && result ? (
          <Feedback item={item} result={result} cause={cause} onCause={handleCause} onNext={handleNext} isLast={isLast} />
        ) : item.type === 'order' ? (
          <DcpOrderItem
            payload={item.payload as DcpOrderPayload}
            submitting={phase === 'grading'}
            onSubmit={handleSubmit}
          />
        ) : (
          <DcpInsertItem
            payload={item.payload as DcpInsertPayload}
            submitting={phase === 'grading'}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────
// 채점 피드백 — 정답/오답 + 정답 공개 + (오답) error_cause 1-tap
// ────────────────────────────────────────────────────────────
function Feedback({
  item,
  result,
  cause,
  onCause,
  onNext,
  isLast,
}: {
  item: DcpItem
  result: DcpGradeResult
  cause: DcpErrorCause | null
  onCause: (c: DcpErrorCause) => void
  onNext: () => void
  isLast: boolean
}) {
  const correct = result.correct
  return (
    <div className="flex flex-col gap-4">
      {/* 배너 (색+아이콘 이중부호 · aria-live) */}
      <div
        aria-live="polite"
        className="flex items-center gap-2.5 rounded-[var(--r-md)] p-3"
        style={{
          background: correct ? 'var(--success-light)' : 'var(--error-light)',
          color: correct ? 'var(--success)' : 'var(--error)',
        }}
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg)]" aria-hidden>
          {correct ? <Check size={16} strokeWidth={2.5} /> : <X size={16} strokeWidth={2.5} />}
        </span>
        <p className="font-display text-[14px] font-[700]">
          {correct ? '정확해요! 문장 흐름을 잘 잡았어요.' : '아쉬워요 — 정답 흐름을 함께 볼게요.'}
        </p>
      </div>

      {/* 오답이면 정답 공개 */}
      {!correct && result.answerKey && <Reveal item={item} answerKey={result.answerKey} />}

      {/* 오답이면 error_cause 1-tap */}
      {!correct && (
        <div className="flex flex-col gap-2">
          <p className="font-display text-[12px] font-[700] text-[var(--t2)]">어떤 점이 어려웠나요? (선택)</p>
          <div className="flex flex-wrap gap-1.5">
            {ERROR_CAUSES.map((ec) => (
              <button
                key={ec.cause}
                type="button"
                onClick={() => onCause(ec.cause)}
                aria-pressed={cause === ec.cause}
                className="inline-flex min-h-[36px] items-center rounded-[var(--r-md)] border px-3 font-display text-[12px] font-[700] transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                style={
                  cause === ec.cause
                    ? { borderColor: 'var(--p)', background: 'var(--p-light)', color: 'var(--p)' }
                    : { borderColor: 'var(--bd)', background: 'var(--bg)', color: 'var(--t2)' }
                }
              >
                {ec.label}
              </button>
            ))}
          </div>
          {cause && <CauseTip cause={cause} />}
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--ti)] shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        {isLast ? '마치기' : '다음'}
        <ArrowRight size={15} strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  )
}

function CauseTip({ cause }: { cause: DcpErrorCause }) {
  const def = ERROR_CAUSES.find((e) => e.cause === cause)
  if (!def) return null
  return (
    <div className="flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--bg)] p-2.5">
      <p className="min-w-0 flex-1 font-body text-[12.5px] leading-relaxed text-[var(--t2)]">{def.tip}</p>
      {def.href && (
        <Link
          href={def.href}
          className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 font-display text-[12px] font-[700] text-[var(--p)] no-underline transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[var(--p-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          복습하기
          <ArrowRight size={12} strokeWidth={2.25} aria-hidden />
        </Link>
      )}
    </div>
  )
}

// 정답 공개 — order: 원래 순서 문장 / insert: 삽입 위치에 문장 배치
function Reveal({ item, answerKey }: { item: DcpItem; answerKey: Record<string, unknown> }) {
  if (item.type === 'order') {
    const sourceOrder = answerKey.source_order
    const presented = (item.payload as DcpOrderPayload).presented
    if (!Array.isArray(sourceOrder)) return null
    const correctOrder = correctOrderFromKey(sourceOrder as number[])
    return (
      <div className="flex flex-col gap-1.5">
        <p className="font-display text-[12px] font-[700] text-[var(--t3)]">정답 순서</p>
        <ol className="flex flex-col gap-1.5">
          {correctOrder.map((pIdx, pos) => (
            <li
              key={pos}
              className="flex items-start gap-2 rounded-[var(--r-sm)] border border-[var(--success)] bg-[var(--success-light)] p-2.5"
            >
              <span className="font-mono text-[12px] font-[700] text-[var(--success)]">{pos + 1}</span>
              <p className="min-w-0 flex-1 font-body text-[13px] leading-relaxed text-[var(--t1)]">{presented[pIdx]}</p>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  // insert
  const position = answerKey.position
  const p = item.payload as DcpInsertPayload
  if (typeof position !== 'number') return null
  const withInsert = [...p.remaining]
  withInsert.splice(position, 0, `〔${p.insert_sentence}〕`)
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-display text-[12px] font-[700] text-[var(--t3)]">정답 위치</p>
      <ol className="flex flex-col gap-1.5">
        {withInsert.map((sentence, i) => {
          const isInserted = i === position
          return (
            <li
              key={i}
              className="rounded-[var(--r-sm)] border p-2.5 font-body text-[13px] leading-relaxed"
              style={{
                borderColor: isInserted ? 'var(--success)' : 'var(--bd)',
                background: isInserted ? 'var(--success-light)' : 'var(--bg)',
                color: 'var(--t1)',
                fontWeight: isInserted ? 700 : 400,
              }}
            >
              {sentence}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
