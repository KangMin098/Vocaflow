// apps/web/src/components/practice/DcpPlayer.tsx
//
// CTP DCP(구문 연습) 플레이어 — 오늘 처방 practice 블록의 order/insert 문항 세션.
// 흐름: 문항 → 제출(grade_dcp_item 서버 채점) → 피드백(정답/오답+정답 공개) → 오답 시 error_cause 1-tap → 다음 → 요약.
// Calm UI · Empathetic Feedback(비난 대신 격려) · 색+아이콘 이중부호 · aria-live · 44px+ · 다크 토큰.

'use client'

import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Check, Home, RefreshCw, X } from 'lucide-react'
import { Gwonjeom } from '@/components/ui/press/Gwonjeom'

import {
  correctOrderFromKey,
  type DcpErrorCause,
  type DcpGradeOk,
  type DcpChoicePayload,
  type DcpInsertPayload,
  type DcpItem,
  type DcpOrderPayload,
  ERROR_CAUSES,
  pickExplanationText,
} from '@/lib/learner/dcp'

import { isChoiceDcpType } from '@/lib/learner/dcp-types'
import { isUnderlineChoiceDcpType, type DcpUnderlinePayload } from '@/lib/learner/dcp-underline'
import { gradeDcpItem, recordDcpErrorCause } from '@/lib/learner/dcp-actions'

import { DcpChoiceItem, DcpInsertItem, DcpOrderItem, DcpUnderlineChoiceItem } from './DcpItems'
import { MeaningEvidence } from './MeaningEvidence'
import { insertSeamCandidates } from '@vocaflow/library-pipeline/insert-coordinates'
import { meaningEvidenceSentences, isMeaningEvidenceType, preEvidenceSentences } from '@/lib/learner/meaning-evidence'
import { PreEvidenceNote, preEvidenceFor, type PreEvidenceSnapshot } from './PreEvidence'

type Phase = 'answering' | 'grading' | 'graded' | 'done'

export function DcpPlayer({
  items,
  backHref = '/hub',
  backCta = '홈으로',
  grade = gradeDcpItem,
  recordCause = recordDcpErrorCause,
  doneCopy,
  onGraded,
  onBack,
  revisit = false,
  causeChips = true,
  causeHref,
  causeLabel,
  nextChoice,
  doneChoice,
  afterFeedback,
  preEvidence = false,
  revisitExtra,
  feedbackFocus = false,
}: {
  items: DcpItem[]
  /** 온 곳으로 돌아가는 경로 — 페이지가 `?from=` 을 검증해 넘긴다(하드코딩 `/hub` 였다). */
  backHref?: string
  backCta?: string
  /**
   * 채점 · 오답 원인 기록 — 기본은 서버(`grade_dcp_item` · attempt 기록). 격리 개발 화면(/dev/vocab-practice)만
   * 합성 문항용 로컬 채점을 넣는다(v6.2 P-F8d). 학습자 화면은 기본값을 쓴다.
   */
  grade?: typeof gradeDcpItem
  recordCause?: typeof recordDcpErrorCause
  /**
   * 완료 문구 교체 — 기본 격려(「꾸준함이 실력이 돼요」)가 향상 근거처럼 읽히면 안 되는 화면(공장 안내 연습 · 1D)이 넣는다.
   */
  doneCopy?: (s: { total: number; correct: number }) => { title: string; body: string }
  /** 채점 성공 직후(계측용) — 실패는 부르지 않는다 */
  onGraded?: (item: DcpItem, result: DcpGradeOk) => void
  /** 완료 화면의 돌아가기를 눌렀다(계측용) */
  onBack?: () => void
  /**
   * 완료 화면의 「이미 본 해설 다시 보기」(opt-in). 세션 · 자료 경계를 확인한 호출자(기사 연습 다리 · 합성 dev)만 켠다.
   * 끄면 피드백 기록을 아예 모으지 않는다(예전 동작).
   */
  revisit?: boolean
  /**
   * 오답 원인 칩(+ 그 팁의 복습 링크) — 기본 켬. 기록할 곳이 없는 체험(공개 예시)만 끈다.
   */
  causeChips?: boolean
  /**
   * 오답 원인별 「복습하기」 목적지 교체(opt-in). 없으면 ERROR_CAUSES 기본(예: vocab → /flashcard/play).
   * 자료 문맥을 아는 호출자(기사 연습 다리)가 그 자료 범위의 목록을 넣는다.
   */
  causeHref?: Partial<Record<DcpErrorCause, string>>
  /** 오답 원인별 링크 문구 교체(opt-in) — 목적지가 복습 목록이 아닐 때만. 없으면 「복습하기」. */
  causeLabel?: Partial<Record<DcpErrorCause, string>>
  /**
   * 완료 화면의 보조 다음 선택(opt-in) — 돌아가기 아래 링크 하나. 없으면 그리지 않는다(예전 동작).
   * 기사 연습 다리만 「다른 글 살펴보기」 를 넣는다. 처방 · 평가가 아니라 자율 선택이다.
   */
  nextChoice?: { href: string; label: string }
  /** T-0212 — 완료 화면 보조 선택(opt-in) 하나 더 — 돌아가기와 nextChoice 사이. 없으면 그리지 않는다(예전 출력 그대로). 정오와 무관하게 완료에서만. */
  doneChoice?: { href: string; label: string }
  /**
   * 채점 뒤 피드백 안의 보조 영역(opt-in, T-0207) — 기사 연습 다리만 「읽은 글 참고」 를 넣는다. 없으면 그리지 않는다(예전 동작).
   * 문항마다 새로 그린다(key) · 완료 뒤 다시 보기에는 넣지 않는다.
   */
  afterFeedback?: ReactNode
  /**
   * R0-PRE-EVIDENCE-01 — 제목 · 주제 문항의 제출 전 선택적 본문 짚기(opt-in). 기사 연습 다리만 켠다.
   * 짚은 문장은 grade · onGraded · seen 에 넣지 않는다 — 성공한 피드백에 「이번 제출 당시 짚은 문장」 으로만 보인다.
   */
  preEvidence?: boolean
  /**
   * 완료 뒤 다시 보기 안의 보조 영역(opt-in, R0-REVISIT-READ-01) — 기사 연습 다리만 같은 「읽은 글 참고」 를 넣는다.
   * 없으면 다시 보기는 예전 그대로. 다시 보기마다 새로 그린다(key) — 다른 문항 다시 보기는 접힌 채 시작한다.
   */
  revisitExtra?: ReactNode
  /**
   * T-0259 — 명시적 제출이 성공하면 피드백 제목으로 초점을 한 번 인계(opt-in, 기사 연습 다리만). 기본 꺼짐 — 다른 호출자는 예전 그대로.
   * 기다리는 동안 학습자가 다른 곳으로 옮긴 초점은 빼앗지 않는다(초점이 body · 사라진 요소일 때만).
   */
  feedbackFocus?: boolean
}) {
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('answering')
  const [result, setResult] = useState<DcpGradeOk | null>(null)
  /**
   * 채점을 **못 한** 이유. 오답과 다른 상태다 — 예전에는 둘이 같은 값이라
   * 세션이 「채점 중」에 잠기거나(예외) 맞힌 학습자에게 「아쉬워요」라고 말했다(RPC 오류).
   */
  const [gradeError, setGradeError] = useState<string | null>(null)
  const [cause, setCause] = useState<DcpErrorCause | null>(null)
  /** 이 문항에 실제로 제출한 답 — 근거 짚기가 「무엇의 근거」인지 되짚는다(다음 문항 · 재시도 때 지운다) */
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  /** 제출 시작 순간의 짚은 문장 — 같은 문항 객체에 묶는다. 실패하면 피드백이 없어 보이지 않고, 재시도가 덮어쓴다 */
  const [preSnap, setPreSnap] = useState<PreEvidenceSnapshot<DcpItem> | null>(null)
  /**
   * 이번 세션에서 **채점에 성공해 공개된** 피드백(당시 선택 · 당시 서버 결과) — 완료 화면의 「이미 본 해설 다시 보기」.
   * 메모리에만 둔다(저장 · 새 조회 없음). 채점 실패는 넣지 않는다. 현재 items 의 같은 문항 객체에 묶인 것만 보인다.
   */
  const [seen, setSeen] = useState<SeenFeedback[]>([])
  const [reviewAt, setReviewAt] = useState<number | null>(null)
  const lastReviewed = useRef<number | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const reviewHeadRef = useRef<HTMLHeadingElement | null>(null)
  useEffect(() => {
    if (reviewAt !== null) reviewHeadRef.current?.focus()
    else if (lastReviewed.current !== null) listRef.current?.querySelectorAll('button')[lastReviewed.current]?.focus()
  }, [reviewAt])

  // T-0249 — 학습자가 피드백의 「다음 · 마치기」 를 실행한 전환에만 한 번 초점을 인계한다(새 문항 시작 영역 · 완료 제목).
  // 부모 재렌더 · 일반 갱신에는 의도가 없어 움직이지 않는다. 복기 왕복은 위의 기존 효과가 맡는다.
  const focusIntent = useRef<FocusIntent>(null)
  const itemStartRef = useRef<HTMLDivElement | null>(null)
  const doneHeadRef = useRef<HTMLHeadingElement | null>(null)
  useEffect(() => {
    const target = focusTargetAfter(focusIntent.current, phase)
    if (!target) return
    focusIntent.current = null
    ;(target === 'item' ? itemStartRef.current : doneHeadRef.current)?.focus()
  }, [idx, phase])

  // T-0259 — 제출 → 성공 피드백 전환에만 한 번. 실패 · 다음 문항 · 재렌더에는 의도가 없다
  const feedbackIntent = useRef(false)
  const feedbackTitleRef = useRef<HTMLParagraphElement | null>(null)
  useEffect(() => {
    if (!feedbackIntent.current || phase === 'grading') return
    const go = shouldFocusFeedback({ intent: feedbackIntent.current, phase, active: typeof document === 'undefined' ? null : document.activeElement, body: typeof document === 'undefined' ? null : document.body })
    feedbackIntent.current = false
    if (go) feedbackTitleRef.current?.focus()
  }, [phase])

  const item = items[idx]
  const total = items.length
  const isLast = idx === total - 1
  const preSentences = preEvidence && item && isChoiceDcpType(item.type) ? preEvidenceSentences(item.type, (item.payload as DcpChoicePayload | undefined)?.passage) : null
  const preShown = preEvidenceFor(preSnap, item)

  async function handleSubmit(answer: Record<string, unknown>, pre?: { sentence: string | null }) {
    if (!item) return
    setGradeError(null)
    setSubmitted(answer)
    setPreSnap(preSentences && pre ? { item, sentence: pre.sentence } : null)
    feedbackIntent.current = feedbackFocus
    setPhase('grading')
    // ⚠️ **reject 도 잡는다.** try/catch 가 없던 동안 세션 만료·네트워크 끊김이
    //   `setPhase('graded')` 에 못 닿아 제출 버튼이 회색으로 잠긴 채 영영 멈췄다.
    //   새로고침이 유일한 탈출이었고, 그러면 1번 문항부터 다시였다.
    let res
    try {
      res = await grade(item.id, answer)
    } catch (e) {
      // 학습자가 고른 답은 그대로 둔다(입력 유실 금지) — 화면을 'answering' 으로 되돌리면
      // 문항 컴포넌트가 언마운트되지 않으므로 배열·선택이 남는다.
      setGradeError(e instanceof Error ? e.message : '연결이 끊겼어요.')
      setPhase('answering')
      return
    }
    if (!res.ok) {
      setGradeError(res.error)
      setPhase('answering')
      return
    }
    setResult(res)
    if (revisit) setSeen((s) => [...s, { item, result: res, submitted: answer }])
    onGraded?.(item, res)
    if (res.correct) setCorrectCount((c) => c + 1)
    setPhase('graded')
  }

  /**
   * T-0247 — 원인 기록을 확인하지 못했을 때({ok:false} · 예외). 자동 재전송 없음 — 학습자가 같은 칩을 다시 누르면 그때 한 번 더 시도한다.
   * 늦게 온 응답은 **문항 · attempt · 현재 선택 · 마지막 호출**이 모두 같을 때만 표시한다(선택을 바꿨거나 다음 문항이면 버린다).
   */
  const [causeFailed, setCauseFailed] = useState<{ item: DcpItem; attemptId: string; cause: DcpErrorCause } | null>(null)
  const causeSeq = useRef(0)
  const live = useRef<{ item: DcpItem | undefined; attemptId: string | null; cause: DcpErrorCause | null }>({ item: undefined, attemptId: null, cause: null })
  live.current = { item: items[idx], attemptId: result?.attemptId ?? null, cause }

  async function handleCause(next: DcpErrorCause) {
    setCause(next)
    setCauseFailed(null)
    const attemptId = result?.attemptId ?? null
    if (!item || !shouldRecordCause({ attemptId, causeChips, reviewing: false })) return
    const my = ++causeSeq.current
    const at = item
    // 선택을 바로 반영해 늦은 응답 판정이 이번 선택을 본다(렌더 전에도)
    live.current = { ...live.current, cause: next }
    const outcome = await causeOutcome(() => recordCause(attemptId as string, next))
    if (outcome === 'ok') return
    const now = live.current
    if (shouldShowCauseFailure({ seq: my, lastSeq: causeSeq.current, item: at, curItem: now.item, attempt: attemptId, curAttempt: now.attemptId, choice: next, curChoice: now.cause })) {
      setCauseFailed({ item: at, attemptId: attemptId as string, cause: next })
    }
  }

  function handleNext() {
    focusIntent.current = isLast ? 'done' : 'item'
    if (isLast) {
      setPhase('done')
      return
    }
    setIdx((i) => i + 1)
    setResult(null)
    setSubmitted(null)
    setPreSnap(null)
    setCause(null)
    setCauseFailed(null)
    causeSeq.current++
    setGradeError(null)
    setPhase('answering')
  }

  // ── 완료 요약 ──
  if (phase === 'done') {
    const custom = doneCopy?.({ total, correct: correctCount })
    const revisit = revisitable(seen, items)
    const open = reviewAt !== null ? revisit[reviewAt] : undefined
    if (open) {
      return (
        <DcpRevisitView entry={open} items={items} headRef={reviewHeadRef} onBack={() => setReviewAt(null)} extra={revisitExtra ? <div key={`revisit-extra-${reviewAt}-${open.item.id}`}>{revisitExtra}</div> : null} />
      )
    }
    return (
      <section
        aria-label="구문 연습 완료"
        className="flex flex-col items-center gap-4 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-8 text-center shadow-[var(--sh-sm)]"
      >
        <span
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]"
          aria-hidden
        >
          <Gwonjeom size={26} strokeWidth={2} />
        </span>
        <div>
          <h2
            ref={doneHeadRef}
            tabIndex={-1}
            data-testid="dcp-done-title"
            className="rounded-[var(--r-sm)] font-display text-[18px] font-[800] text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            {custom ? custom.title : items.every((x) => isUnderlineChoiceDcpType(x.type)) ? '어휘 연습을 마쳤어요' : '오늘 구문 연습을 마쳤어요'}
          </h2>
          <p className="mt-1 break-keep font-body text-[13px] text-[var(--t2)]" data-testid="dcp-done-body">
            {custom ? custom.body : `${total}문항 중 ${correctCount}문항을 맞혔어요. 꾸준함이 실력이 돼요.`}
          </p>
        </div>
        <Link
          href={backHref}
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--ju)] px-5 font-display text-[14px] font-[700] text-[var(--on-ju)] no-underline shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--ju-ink)] active:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)]"
        >
          <Home size={16} strokeWidth={2} aria-hidden />
          {backCta}
        </Link>
        {doneChoice && (
          <Link
            href={doneChoice.href}
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-4 font-display text-[13px] font-[700] text-[var(--t1)] no-underline transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            data-testid="dcp-done-choice"
          >
            {doneChoice.label}
          </Link>
        )}
        {nextChoice && (
          <Link
            href={nextChoice.href}
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-4 font-display text-[13px] font-[700] text-[var(--t1)] no-underline transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            data-testid="dcp-next-choice"
          >
            {nextChoice.label}
          </Link>
        )}
        {revisit.length > 0 && (
          <div className="flex w-full flex-col gap-2 border-t border-[var(--bd)] pt-4 text-left" data-testid="dcp-revisit">
            <p className="break-keep font-display text-[12px] font-[700] text-[var(--t2)]">이미 본 해설 다시 보기 · 안내 복습</p>
            <ul ref={listRef} className="m-0 flex list-none flex-wrap gap-2 p-0">
              {revisit.map((e, i) => (
                <li key={`${e.item.id}-${i}`}>
                  <button
                    type="button"
                    onClick={() => { lastReviewed.current = i; setReviewAt(i) }}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-display text-[12px] font-[700] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                  >
                    {e.result.correct ? <Check size={13} strokeWidth={2.5} aria-hidden /> : <X size={13} strokeWidth={2.5} aria-hidden />}
                    {items.indexOf(e.item) + 1}번 {e.result.correct ? '맞힘' : '틀림'} · 해설 보기
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    )
  }

  if (!item) return null

  return (
    <section aria-label="구문 연습" className="flex flex-col gap-4">
      {/* 진행 */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-[12px] font-[700] text-[var(--t2)]">
          {idx + 1} / {total}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg3)]" aria-hidden>
          <div
            className="h-full rounded-full bg-[var(--p)] transition-[width] duration-[var(--dur-normal)]"
            style={{ width: `${((idx + (phase === 'graded' ? 1 : 0)) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* 채점 실패 — **오답이 아니라 「못 했다」**. 고른 답은 그대로 남아 있으므로
          「제출」을 다시 누르면 된다(그 사실을 말해 주지 않으면 학습자는 새로고침한다). */}
      {gradeError && phase !== 'graded' && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--error)] bg-[var(--error-light)] p-3"
        >
          <span
            className="mt-[1px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--error-ink)]"
            aria-hidden
          >
            <AlertTriangle size={14} strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="break-keep font-display text-[13px] font-[700] text-[var(--error-ink)]">
              채점을 못 했어요 — 고른 답은 그대로 있어요.
            </p>
            <p className="mt-1 break-keep font-body text-[12px] leading-relaxed text-[var(--t2)]">
              아래 「제출」을 한 번 더 눌러 주세요. 계속 안 되면 로그인이 풀렸을 수 있어요.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-[var(--t3)]" aria-hidden>
            <RefreshCw size={12} strokeWidth={2.25} />
          </span>
        </div>
      )}

      <div
        ref={itemStartRef}
        tabIndex={-1}
        role="group"
        aria-label={`${idx + 1}번 문항`}
        data-testid="dcp-item-start"
        className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4 shadow-[var(--sh-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        {phase === 'graded' && result ? (
          <Feedback item={item} result={result} submitted={submitted} cause={cause} titleRef={feedbackFocus ? feedbackTitleRef : undefined} onCause={handleCause} causeFailed={!!causeFailed && causeFailed.item === item && causeFailed.attemptId === result.attemptId && causeFailed.cause === cause} onNext={handleNext} isLast={isLast} review={!causeChips ? 'noCause' : false} causeHref={causeHref} causeLabel={causeLabel} pre={preShown ? <PreEvidenceNote key={`pre-${item.id}`} sentence={preShown.sentence} /> : null} extra={afterFeedback ? <div key={`extra-${item.id}`}>{afterFeedback}</div> : null} />
        ) : isUnderlineChoiceDcpType(item.type) ? (
          <DcpUnderlineChoiceItem
            payload={item.payload as DcpUnderlinePayload}
            submitting={phase === 'grading'}
            onSubmit={handleSubmit}
          />
        ) : isChoiceDcpType(item.type) ? (
          <DcpChoiceItem
            payload={item.payload as DcpChoicePayload}
            submitting={phase === 'grading'}
            onSubmit={handleSubmit}
            evidenceSentences={preSentences}
          />
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

// ── T-0259 — 제출 성공 뒤 피드백 제목 초점(순수) ──

/** 성공 피드백으로 초점을 옮길지 — 제출 의도가 있고 · 피드백 단계이고 · 초점이 사라졌거나(body · 연결 끊김) 없을 때만 */
export function shouldFocusFeedback({ intent, phase, active, body }: { intent: boolean; phase: Phase; active: unknown; body: unknown }): boolean {
  if (!intent || phase !== 'graded') return false
  const a = active as { isConnected?: boolean } | null
  return !a || a === body || a.isConnected === false
}

// ── T-0249 — 다음 · 마치기 뒤 초점 인계(순수) ──

export type FocusIntent = 'item' | 'done' | null

/** 학습자가 남긴 전환 의도와 지금 단계로 초점 대상을 고른다 — 의도가 없으면(부모 재렌더 · 일반 갱신) null */
export function focusTargetAfter(intent: FocusIntent, phase: Phase): 'item' | 'done' | null {
  if (intent === 'item' && phase === 'answering') return 'item'
  if (intent === 'done' && phase === 'done') return 'done'
  return null
}

// ── T-0247 — 오답 원인 기록 판정(순수) ──

/** 원인 기록을 보낼지 — attempt 가 있고 · 원인 칩이 켜져 있고 · 완료 뒤 다시 보기가 아닐 때만 */
export function shouldRecordCause({ attemptId, causeChips, reviewing }: { attemptId: string | null | undefined; causeChips: boolean; reviewing: boolean }): boolean {
  return typeof attemptId === 'string' && attemptId.length > 0 && causeChips && !reviewing
}

/** 기록 호출 결과 → ok | failed. {ok:true} 만 성공 — {ok:false} · 모양이 틀린 응답 · 예외는 모두 failed(자동 재전송은 하지 않는다) */
export async function causeOutcome(call: () => Promise<unknown>): Promise<'ok' | 'failed'> {
  try {
    const res = await call()
    return (res as { ok?: unknown } | null)?.ok === true ? 'ok' : 'failed'
  } catch {
    return 'failed'
  }
}

/** 늦게 온 실패를 지금 보여도 되는가 — 마지막 호출 · 같은 문항 객체 · 같은 attempt · 같은 현재 선택일 때만 */
export function shouldShowCauseFailure(x: {
  seq: number
  lastSeq: number
  item: unknown
  curItem: unknown
  attempt: string | null
  curAttempt: string | null
  choice: DcpErrorCause
  curChoice: DcpErrorCause | null
}): boolean {
  return x.seq === x.lastSeq && x.item === x.curItem && x.attempt !== null && x.attempt === x.curAttempt && x.choice === x.curChoice
}

/** 이번 세션에서 채점에 성공해 공개된 피드백 한 건 — 당시 제출 · 당시 서버 결과 그대로 */
export interface SeenFeedback { item: DcpItem; result: DcpGradeOk; submitted: Record<string, unknown> }

/** 다시 볼 수 있는 것 — 지금 items 에 있는 **같은 문항 객체**에 묶인 기록만(자료가 바뀌면 옛 피드백은 사라진다) */
export function revisitable(seen: SeenFeedback[], items: DcpItem[]): SeenFeedback[] {
  return seen.filter((e) => items.includes(e.item))
}

/** 완료 뒤 「이미 본 해설 다시 보기 · 안내 복습」 — 새 채점 · 기록 없음, 원인 칩 없음, 「요약으로」 로 돌아간다 */
export function DcpRevisitView({ entry, items, headRef, onBack, extra = null }: { entry: SeenFeedback; items: DcpItem[]; headRef?: Ref<HTMLHeadingElement>; onBack: () => void; extra?: ReactNode }) {
  return (
    <section aria-label="이미 본 해설 다시 보기" className="flex flex-col gap-3">
      <h2
        ref={headRef}
        tabIndex={-1}
        className="break-keep font-display text-[14px] font-[700] text-[var(--t2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        data-testid="dcp-revisit-label"
      >
        이미 본 해설 다시 보기 · 안내 복습 — {items.indexOf(entry.item) + 1}번 문항, 그때 고른 답과 받은 해설 그대로예요.
      </h2>
      <div className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4 shadow-[var(--sh-sm)]">
        <Feedback item={entry.item} result={entry.result} submitted={entry.submitted} cause={null} onCause={() => {}} onNext={onBack} isLast review extra={extra} />
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
  submitted,
  cause,
  onCause,
  causeFailed = false,
  onNext,
  isLast,
  review = false,
  causeHref,
  causeLabel,
  extra = null,
  pre = null,
  titleRef,
}: {
  item: DcpItem
  result: DcpGradeOk
  submitted: Record<string, unknown> | null
  cause: DcpErrorCause | null
  onCause: (c: DcpErrorCause) => void
  /** 원인 기록을 확인하지 못함(T-0247) — 진행 중 피드백에서만 */
  causeFailed?: boolean
  onNext: () => void
  isLast: boolean
  /** true = 완료 뒤 다시 보기(원인 칩 없음 · 「요약으로」) · 'noCause' = 진행 중이지만 원인 칩만 숨김 */
  review?: boolean | 'noCause'
  causeHref?: Partial<Record<DcpErrorCause, string>>
  causeLabel?: Partial<Record<DcpErrorCause, string>>
  /** 호출자가 넣은 보조 영역 — 진행 중 피드백(afterFeedback) · 완료 뒤 다시 보기(revisitExtra, opt-in) */
  extra?: ReactNode
  /** 이번 제출 당시 짚은 문장(R0-PRE-EVIDENCE-01) — 진행 중 성공 피드백에서만 */
  pre?: ReactNode
  /** T-0259 — 진행 중 피드백 제목(초점 인계 대상, opt-in) */
  titleRef?: Ref<HTMLParagraphElement>
}) {
  const correct = result.correct
  return (
    <div className="flex flex-col gap-4">
      {/* 배너 (색+아이콘 이중부호 · aria-live) */}
      <div
        aria-live="polite"
        className="flex items-center gap-3 rounded-[var(--r-md)] p-3"
        style={{
          background: correct ? 'var(--success-light)' : 'var(--error-light)',
          color: correct ? 'var(--success)' : 'var(--error)',
        }}
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg)]" aria-hidden>
          {correct ? <Check size={16} strokeWidth={2.5} /> : <X size={16} strokeWidth={2.5} />}
        </span>
        <p
          ref={titleRef}
          tabIndex={titleRef ? -1 : undefined}
          data-testid={titleRef ? 'dcp-feedback-title' : undefined}
          className="rounded-[var(--r-sm)] font-display text-[14px] font-[700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          {/* 유형마다 '무엇을 잘했는지' 가 다르다 — 한 문장으로 뭉개면 선택지 유형에서 어색해진다. */}
          {correct
            ? isUnderlineChoiceDcpType(item.type)
              ? '정확해요! 문맥에 맞지 않는 낱말을 찾았어요.'
              : isMeaningEvidenceType(item.type)
              ? '정확해요! 고른 답이 맞았어요.'
              : isChoiceDcpType(item.type)
              ? '정확해요! 근거를 잘 찾았어요.'
              : '정확해요! 문장 흐름을 잘 잡았어요.'
            : isChoiceDcpType(item.type) || isUnderlineChoiceDcpType(item.type)
              ? '아쉬워요 — 정답과 근거를 함께 볼게요.'
              : '아쉬워요 — 정답 흐름을 함께 볼게요.'}
        </p>
      </div>

      {/* 오답이면 정답 공개 — 맞혔으면 **해설만**.
          맞힌 학습자에게 필요한 것은 "정답이 무엇이었나" 가 아니라 "왜" 다. 찍어서 맞힌
          경우가 특히 그렇다 — 근거를 못 배우고 넘어가면 다음에 같은 자리에서 또 틀린다.

          ⚠️ **오늘은 대개 비어 있다.** `grade_dcp_item` 이
             `answer_key := CASE WHEN v_correct THEN NULL ELSE it.answer_key END` 이라
             정답일 때 해설이 아예 안 내려온다(본문 실측 2026-09-06). `csat_dcp_items` 는
             학습자 정책이 없어 앱에서 따로 읽을 수도 없다. 그래서 화면 쪽 문은 여기서
             열어 두고, 서버가 해설만 돌려주게 되면 그날로 보이기 시작한다.
             (정답 선지·정답 순서까지 다시 보여 줄 필요는 없다 — 방금 고른 것이다.) */}
      {result.answerKey &&
        (correct ? (
          <ExplanationNote answerKey={result.answerKey} />
        ) : (
          <Reveal item={item} answerKey={result.answerKey} />
        ))}

      {pre}

      {/* 중심 의미 유형 — 채점 뒤 본문 근거 짚기 → 해설과 나란히(판정 없음 · 건너뛰기 가능 · 문항마다 새로) */}
      {(() => {
        const choicePayload = item.payload as DcpChoicePayload | undefined
        const sentences = meaningEvidenceSentences(item.type, choicePayload?.passage)
        return sentences ? (
          <MeaningEvidence
            key={item.id}
            sentences={sentences}
            explanation={pickExplanationText(result.answerKey ?? null)}
            chosen={submittedChoice(item, submitted)}
            correct={result.correct}
            // 원래 발문 · 선택지 그대로(채점 전에도 보던 것) — 다른 선택지 하나와 견주기. 새 정답 · 조회 없음
            stem={choicePayload?.stemKo ?? null}
            choices={choicePayload?.choices ?? null}
          />
        ) : null
      })()}

      {extra}

      {/* 오답이면 error_cause 1-tap */}
      {!correct && review === false && (
        <div className="flex flex-col gap-2">
          <p className="font-display text-[12px] font-[700] text-[var(--t2)]">어떤 점이 어려웠나요? (선택)</p>
          <div className="flex flex-wrap gap-2">
            {ERROR_CAUSES.map((ec) => (
              <button
                key={ec.cause}
                type="button"
                onClick={() => onCause(ec.cause)}
                aria-pressed={cause === ec.cause}
                className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border px-3 font-display text-[12px] font-[700] transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
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
          {causeFailed && (
            <p role="status" className="break-keep font-body text-[12.5px] leading-relaxed text-[var(--t1)]" data-testid="dcp-cause-failed">
              원인 기록을 확인하지 못했어요. 고른 칩을 다시 누르면 한 번 더 기록해 볼게요. 답 · 해설 · 다음 이동은 그대로예요.
            </p>
          )}
          {cause && <CauseTip cause={cause} href={causeHref?.[cause]} label={causeLabel?.[cause]} />}
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-[var(--r-md)] bg-[var(--ju)] px-5 font-display text-[14px] font-[700] text-[var(--on-ju)] shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--ju-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)]"
      >
        {review === true ? '요약으로' : isLast ? '마치기' : '다음'}
        <ArrowRight size={15} strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  )
}

/** 제출한 선택지(번호 · 문구) — 의미 선택 유형의 근거 짚기가 되짚는다. 못 읽으면 null */
function submittedChoice(item: DcpItem, submitted: Record<string, unknown> | null): { n: number; text: string } | null {
  const n = Number(submitted?.choice)
  const choices = (item.payload as DcpChoicePayload | undefined)?.choices
  if (!Number.isInteger(n) || !Array.isArray(choices) || n < 1 || n > choices.length) return null
  return { n, text: choices[n - 1] }
}

export function CauseTip({ cause, href: override, label = '복습하기' }: { cause: DcpErrorCause; href?: string; label?: string }) {
  const def = ERROR_CAUSES.find((e) => e.cause === cause)
  if (!def) return null
  const href = override ?? def.href
  return (
    <div className="flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--bg)] p-3">
      <p className="min-w-0 flex-1 font-body text-[12.5px] leading-relaxed text-[var(--t2)]">{def.tip}</p>
      {href && (
        <Link
          href={href}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 font-display text-[12px] font-[700] text-[var(--on-p-tint)] no-underline transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[var(--p-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          {label}
          <ArrowRight size={12} strokeWidth={2.25} aria-hidden />
        </Link>
      )}
    </div>
  )
}

/**
 * 해설 한 덩이.
 *
 * ⚠️ **해설은 두 이름으로 산다** — 생성형 드레인은 `rationale_ko`, 결정론·배치는
 *   `explanation_ko`. 한쪽만 읽으면 그 유형의 해설이 있는데도 화면에 안 나온다.
 *   순서·삽입이 실제로 그랬다: 2026-08-30 에 2,755건을 채웠는데 화면은 정답 순서만
 *   보여 주고 **왜 그렇게 이어지는지는 한 글자도 안 보여 줬다.**
 */
function ExplanationNote({ answerKey }: { answerKey: Record<string, unknown> }) {
  // 두 키 중 무엇을 읽을지는 `pickExplanationText` 한 곳에만 있다.
  // ⚠️ 여기에 **규칙 해설 대체를 붙이려다 되돌렸다** — 실측 0건이었다. 이유는 `dcp.ts` 참조.
  const text = pickExplanationText(answerKey)
  if (!text) return null
  return (
    <p className="rounded-[var(--r-sm)] bg-[var(--bg)] p-3 font-body text-[12.5px] leading-relaxed text-[var(--t2)]">
      {text}
    </p>
  )
}

// 정답 공개 — order: 원래 순서 문장 / insert: 삽입 위치에 문장 배치
function Reveal({ item, answerKey }: { item: DcpItem; answerKey: Record<string, unknown> }) {
  // ── 밑줄 선택(어휘) — 어색한 자리 번호 · 그 자리에 와야 할 낱말 · 해설 ──
  if (isUnderlineChoiceDcpType(item.type)) {
    const pos = Number(answerKey.position)
    const u = (item.payload as DcpUnderlinePayload).underlines[pos - 1]
    if (!u) return null
    const original = typeof answerKey.original === 'string' ? answerKey.original : null
    return (
      <div className="flex flex-col gap-2">
        <p className="font-display text-[12px] font-[700] text-[var(--t2)]">정답</p>
        <div className="flex items-start gap-3 rounded-[var(--r-sm)] border border-[var(--success)] bg-[var(--success-light)] p-3">
          <span className="mt-[1px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--success)] font-mono text-[12px] font-[700] text-[var(--bg)]" aria-hidden>
            {pos}
          </span>
          <p className="min-w-0 flex-1 break-keep font-body text-[13px] leading-relaxed text-[var(--t1)]">
            {u.label} <span className="font-serif line-through">{u.word}</span>
            {original ? <> → <span className="font-serif font-[700]">{original}</span> 가 와야 뜻이 이어져요</> : null}
          </p>
        </div>
        <ExplanationNote answerKey={answerKey} />
      </div>
    )
  }
  // ── 선택지 9종 — 정답 번호 + 해설 ──
  if (isChoiceDcpType(item.type)) {
    const answer = answerKey.answer
    const p = item.payload as DcpChoicePayload
    if (typeof answer !== 'number') return null
    return (
      <div className="flex flex-col gap-2">
        <p className="font-display text-[12px] font-[700] text-[var(--t2)]">정답</p>
        <div className="flex items-start gap-3 rounded-[var(--r-sm)] border border-[var(--success)] bg-[var(--success-light)] p-3">
          <span className="mt-[1px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--success)] font-mono text-[12px] font-[700] text-[var(--bg)]" aria-hidden>
            {answer}
          </span>
          <p className="min-w-0 flex-1 font-body text-[13px] leading-relaxed text-[var(--t1)]">
            {p.choices[answer - 1] ?? ''}
          </p>
        </div>
        {/* 해설은 **왜 나머지가 아닌지**까지 적혀 있다 — 오답 노트가 따로 필요 없게 만든 자리다. */}
        <ExplanationNote answerKey={answerKey} />
      </div>
    )
  }

  if (item.type === 'order') {
    const sourceOrder = answerKey.source_order
    const presented = (item.payload as DcpOrderPayload).presented
    if (!Array.isArray(sourceOrder)) return null
    const correctOrder = correctOrderFromKey(sourceOrder as number[])
    return (
      <div className="flex flex-col gap-2">
        <p className="font-display text-[12px] font-[700] text-[var(--t2)]">정답 순서</p>
        <ol className="flex flex-col gap-2">
          {correctOrder.map((pIdx, pos) => (
            <li
              key={pos}
              className="flex items-start gap-2 rounded-[var(--r-sm)] border border-[var(--success)] bg-[var(--success-light)] p-3"
            >
              <span className="font-mono text-[12px] font-[700] text-[var(--success)]">{pos + 1}</span>
              <p className="min-w-0 flex-1 font-body text-[13px] leading-relaxed text-[var(--t1)]">{presented[pIdx]}</p>
            </li>
          ))}
        </ol>
        <ExplanationNote answerKey={answerKey} />
      </div>
    )
  }

  // insert
  const position = answerKey.position
  const p = item.payload as DcpInsertPayload
  if (typeof position !== 'number') return null
  // 해설의 ①~⑤ 는 **해설 후보 번호**다(화면 자리 순번이 아니다). 채점 뒤 key 로만, 해설 조각이 실제 앞뒤 문장과
  //   모두 맞을 때만 이음매에 붙인다 — 증명 못 하면 null 이고 예전처럼 해설 문장만 보인다(lib insert-coordinates).
  const candidates = insertSeamCandidates({
    remaining: p.remaining,
    insertSentence: p.insert_sentence,
    position,
    explanation: pickExplanationText(answerKey),
    writer: answerKey.explanation_writer,
  })
  const labelAt = new Map((candidates ?? []).map((c) => [c.seam, c.label]))
  const rows: { kind: 'sentence' | 'inserted' | 'seam'; text: string; label?: string }[] = []
  for (let g = 0; g <= p.remaining.length; g++) {
    if (g === position) rows.push({ kind: 'inserted', text: p.insert_sentence, label: labelAt.get(g) })
    else if (labelAt.has(g)) rows.push({ kind: 'seam', text: '', label: labelAt.get(g) })
    if (g < p.remaining.length) rows.push({ kind: 'sentence', text: p.remaining[g] })
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="font-display text-[12px] font-[700] text-[var(--t2)]">정답 위치</p>
      {candidates && (
        <p className="break-keep font-body text-[12px] leading-relaxed text-[var(--t2)]" data-testid="insert-seam-legend">
          해설의 {candidates.map((c) => c.label).join('')} 는 화면의 자리 순번이 아니라 해설이 고른 후보 번호예요 — 아래에 그 자리를 표시했어요.
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {rows.map((r, i) => {
          if (r.kind === 'seam') {
            return (
              <li key={i} className="flex items-center gap-2" data-testid="insert-seam-mark" aria-label={`해설 ${r.label} 자리 — 위아래 두 문장 사이`}>
                <span className="inline-flex h-6 min-w-[44px] items-center justify-center rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-2 font-display text-[11.5px] font-[700] text-[var(--t2)]">
                  해설 {r.label}
                </span>
                <span className="h-px flex-1 border-t border-dashed border-[var(--bd)]" aria-hidden />
              </li>
            )
          }
          const isInserted = r.kind === 'inserted'
          return (
            <li
              key={i}
              data-testid={isInserted ? 'insert-seam-answer' : undefined}
              className="rounded-[var(--r-sm)] border p-3 font-body text-[13px] leading-relaxed"
              style={{
                borderColor: isInserted ? 'var(--success)' : 'var(--bd)',
                background: isInserted ? 'var(--success-light)' : 'var(--bg)',
                color: 'var(--t1)',
                fontWeight: isInserted ? 700 : 400,
              }}
            >
              {isInserted && r.label && (
                <span className="mr-2 inline-flex items-center rounded-[var(--r-full)] bg-[var(--success)] px-2 font-display text-[11.5px] font-[700] text-[var(--bg)]">
                  해설 {r.label} · 정답 자리
                </span>
              )}
              {isInserted ? `〔${r.text}〕` : r.text}
            </li>
          )
        })}
      </ol>
      <ExplanationNote answerKey={answerKey} />
    </div>
  )
}
