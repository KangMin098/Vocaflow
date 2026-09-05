// apps/web/src/components/game/scriptquiz/ScriptQuiz.tsx
// ScriptQuiz — 3-screen flow (start → question → result)
// CLAUDE.md §12 기준
//   · 능동적 회상 (Active Recall) — 보기 → 답하기
//   · 맥락 의존 기억 — sourceSnippet 으로 스크립트 근거 표시
//   · 공감 피드백 — 오답을 부드럽게 ("다시 만나봐요")

'use client'

import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Check, Clock, Play, RefreshCw, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { MOCK_SESSION } from './mock-data'
import type { AnswerState, QuizAnswer, QuizQuestion, QuizScreen, QuizSession } from './types'

import { NextActionCard } from '@/components/recommend/NextActionCard'
import { sanitizeInternalPath } from '@/lib/layout/session-return'
import type { RecommendedAction } from '@/lib/recommend/types'
import { useNextAction } from '@/lib/recommend/use-next-action'
import { recordGameScore } from '@/lib/scores/record-score'
import { gradeScriptQuizAnswer, type ScriptQuizGrade } from '@/lib/scriptquiz/grade-actions'
import { pushPendingTextResult } from '@/lib/srs/session-storage'

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════
/**
 * OX 선지가 「참」쪽인가 — **자리가 아니라 글자로 판정한다.**
 *
 * DB 의 options 순서가 회차마다 다르다(실측 2026-09-05: `["False","True"]` 인 행이 4/47).
 * 자리로 기호를 정하면 참이라고 판단해 큰 O 를 누른 학습자가 오답 처리된다 — 정답이
 * X 버튼에 앉아 있기 때문이다. 정답을 알아도 틀리는 유일한 유형이었다.
 *
 * 판정은 **머리글자**로 한다. 선지가 `False — he asks so that he himself will not rust.`
 * 처럼 뒤에 설명을 달고 오므로 전체 일치로는 못 잡는다. 못 알아보면 `false` 를 돌려
 * 두 번째 자리(관례상 X)로 두되, 두 선지가 같은 답이 되지는 않게 호출부가 보정한다.
 */
export function isTrueOption(text: string): boolean {
  const t = String(text ?? '').trim().toLowerCase()
  return /^(true|참|o\b|yes)/.test(t)
}

/**
 * O/X 오버레이가 떠 있는 시간.
 *
 * ⚠️ **이 값은 더 이상 "다음 문항까지의 시간" 이 아니다.** 예전에는 이 800ms 뒤 200ms 를
 *   더해 **1,000ms 만에 화면이 다음 문항으로 갈아치워졌다.** 정답 선지와 「스크립트 근거」가
 *   딱 그 1초만 존재했고, 390px 에서는 근거가 접힘선 아래라 스크롤할 새도 없었다.
 *   되감기·이전 문항도 없어서 **틀린 문항의 정답을 알 길이 세션 전체에 없었다.**
 *   지금은 학습자가 「다음」을 누른다(Calm UI — 재촉하지 않고, 모달로 끊지도 않는다).
 */
const FEEDBACK_DURATION = 800 // ms — O/X 오버레이 표시 시간
const QUESTION_TIME_LIMIT = 30 // sec — 한 문제당 권장 시간

// ══════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════
export interface ScriptQuizProps {
  /** 한국어 번역 보조 표시 여부 — hub 토글에서 결정 */
  showKorean?: boolean
  /** 스크립트 식별자 — 미지정 시 session.textTitle 을 stable key 로 사용 */
  textId?: string
  /** 실 퀴즈 세션 (quiz_questions). 미지정 시 MOCK_SESSION 폴백(데모/문제 미생성). */
  session?: QuizSession
}

export function ScriptQuiz({ showKorean = false, textId, session: sessionProp }: ScriptQuizProps = {}) {
  const session = sessionProp ?? MOCK_SESSION

  // §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후) — 실 사용자 상태 기반 (decide P1~P4)
  const recommendation = useNextAction()

  const [screen, setScreen] = useState<QuizScreen>('start')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_TIME_LIMIT)
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(0)
  const [feedback, setFeedback] = useState<'O' | 'X' | null>(null)
  /** 서버가 채점하며 돌려준 이 문항의 정답·근거. **답하기 전에는 null 이고 아무 데도 없다.** */
  const [graded, setGraded] = useState<{ correctIndex: number; sourceSnippet: string } | null>(null)
  /** 채점을 **못 한** 이유. 오답이 아니다 — 같은 값으로 뭉개면 맞힌 사람에게 틀렸다고 말한다. */
  const [gradeError, setGradeError] = useState<string | null>(null)

  const currentQ = session.questions[currentIdx]
  const totalQ = session.questions.length

  // ── 타이머 ──
  // 채점을 기다리는 동안(`grading`)과 채점 실패 뒤에는 멈춘다 — 안 그러면 네트워크가
  // 죽은 동안 시간이 흘러 「시간 초과」가 다시 실패하는 고리가 된다.
  useEffect(() => {
    if (screen !== 'question' || answerState !== 'idle' || gradeError) return
    if (secondsLeft <= 0) {
      void handleAnswer(-1) // 시간 초과
      return
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
    // handleAnswer 는 currentIdx · currentQ 캡처 — 의도된 stale closure
    // (currentIdx 변경 시 secondsLeft가 리셋되어 useEffect 재실행)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, screen, answerState, gradeError])

  // ── 답한 뒤 Enter/Space 로 다음 ── (「다음」 버튼과 같은 동작 — 손을 안 옮겨도 되게)
  useEffect(() => {
    if (screen !== 'question' || answerState !== 'answered') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, answerState, currentIdx, answers])

  // ── 키보드 단축키 (1~4 / O,X) ──
  useEffect(() => {
    if (screen !== 'question' || answerState !== 'idle') return
    const handler = (e: KeyboardEvent) => {
      const max = currentQ.options.length
      const num = parseInt(e.key, 10)
      if (!isNaN(num) && num >= 1 && num <= max) {
        e.preventDefault()
        void handleAnswer(num - 1)
        return
      }
      if (currentQ.type === 'truefalse') {
        const k = e.key.toLowerCase()
        // 화면의 기호와 같은 규칙으로 고른다 — 자리가 아니라 뜻. 둘이 어긋나면
        // 키보드로 O 를 눌렀는데 화면의 X 가 눌리는 일이 생긴다.
        const oIdx = currentQ.options.findIndex((o) => isTrueOption(o.text))
        const yes = oIdx >= 0 ? oIdx : 0
        const no = yes === 0 ? 1 : 0
        if (k === 'o' || e.key === 'ArrowLeft') {
          e.preventDefault()
          void handleAnswer(yes)
        } else if (k === 'x' || e.key === 'ArrowRight') {
          e.preventDefault()
          void handleAnswer(no)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, answerState, currentIdx])

  // ── 시작 ──
  function startQuiz() {
    setScreen('question')
    setCurrentIdx(0)
    setSelectedIdx(null)
    setAnswerState('idle')
    setAnswers([])
    setGraded(null)
    setGradeError(null)
    setFeedback(null)
    setSecondsLeft(QUESTION_TIME_LIMIT)
    setQuestionStartedAt(Date.now())
  }

  // ── 답변 처리 — **채점은 서버가 한다** ──
  //
  // ⚠️ 예전에는 `idx === currentQ.correctIndex` 였다. 정답이 이미 브라우저에 있었기 때문인데,
  //   그건 곧 **시작하기를 누르기 전에 페이지 소스에 정답표가 다 있었다**는 뜻이다.
  //   지금은 답을 서버로 보내고 정답·근거를 **그때 하나만** 받는다(DCP 와 같은 모양).
  async function handleAnswer(idx: number) {
    if (answerState !== 'idle') return
    const timeMs = Date.now() - questionStartedAt
    const q = currentQ

    setSelectedIdx(idx)
    setAnswerState('grading')
    setGradeError(null)

    let res: ScriptQuizGrade
    try {
      res = await gradeScriptQuizAnswer(session.source, q.id, idx)
    } catch (e) {
      // 채점 실패를 오답으로 번역하지 않는다 — 다시 고를 수 있는 상태로 되돌린다.
      setGradeError(e instanceof Error ? e.message : '연결이 끊겼어요.')
      setSelectedIdx(null)
      setAnswerState('idle')
      return
    }
    if (!res.ok) {
      setGradeError(res.error)
      setSelectedIdx(null)
      setAnswerState('idle')
      return
    }

    const g = res
    setGraded({ correctIndex: g.correctIndex, sourceSnippet: g.sourceSnippet })
    setAnswerState('answered')
    setFeedback(g.correct ? 'O' : 'X')
    setAnswers((prev) => [
      ...prev,
      {
        questionId: q.id,
        selectedIndex: idx,
        correctIndex: g.correctIndex,
        isCorrect: g.correct,
        sourceSnippet: g.sourceSnippet,
        timeMs,
      },
    ])
    // 오버레이만 800ms 뒤 사라진다. **화면은 그대로 남는다** — 넘기는 것은 학습자다.
    window.setTimeout(() => setFeedback(null), FEEDBACK_DURATION)
  }

  // ── 다음 문항 / 마무리 — 학습자가 누른다 ──
  function goNext() {
    if (answerState !== 'answered') return
    if (currentIdx + 1 >= totalQ) {
      finishSession(answers)
      setScreen('result')
      return
    }
    setCurrentIdx((i) => i + 1)
    setSelectedIdx(null)
    setAnswerState('idle')
    setGraded(null)
    setGradeError(null)
    setFeedback(null)
    setSecondsLeft(QUESTION_TIME_LIMIT)
    setQuestionStartedAt(Date.now())
  }

  function finishSession(finalAnswers: QuizAnswer[]) {
    // §17 [4] L4d 통합 검증 — 텍스트 단위 결과 (Plan B)
    // textId 미지정 시 session.textTitle 을 stable key 로 사용 (Phase 2: real textId 교체)
    const correctCount = finalAnswers.filter((a) => a.isCorrect).length
    const totalCount = finalAnswers.length
    const accuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 0
    pushPendingTextResult({
      textId: textId ?? session.textTitle,
      accuracy,
      correctCount,
      totalCount,
      completedAt: new Date().toISOString(),
      module: 'scriptquiz',
    })
    // scores 영속화 (fire-and-forget) — sessionStorage pending 은 소비자가 없어
    // 여기서 직접 적재해야 daily_activity/최근활동/주간리포트에 반영된다.
    void recordGameScore({
      module: 'scriptquiz',
      score: correctCount * 20,
      totalQuestions: totalCount,
      correctCount,
      accuracy: Math.round(accuracy),
      durationSeconds: Math.round(finalAnswers.reduce((s, a) => s + a.timeMs, 0) / 1000),
      textId, // 큐레이션 챕터 경로는 undefined — texts FK 아닌 값은 넣지 않음
      // 그 경로가 남길 자리가 없던 "어떤 도서였나" 를 content_ref 가 받는다.
      content: session.content,
      metadata: { textTitle: session.textTitle, textChapter: session.textChapter },
    })
  }

  // ── Result 통계 ──
  const stats = useMemo(() => {
    const correct = answers.filter((a) => a.isCorrect).length
    const wrong = answers.length - correct
    const accuracy = answers.length ? Math.round((correct / answers.length) * 100) : 0
    const avgTimeSec =
      answers.length > 0
        ? Math.round(answers.reduce((s, a) => s + a.timeMs, 0) / answers.length / 1000)
        : 0
    return { correct, wrong, accuracy, avgTimeSec }
  }, [answers])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg2)]">
      {/* ─── 1. START ─── */}
      {screen === 'start' && <StartScreen session={session} onStart={startQuiz} />}

      {/* ─── 2. QUESTION ─── */}
      {screen === 'question' && (
        <QuestionScreen
          questionIdx={currentIdx}
          totalQ={totalQ}
          score={stats.correct * 20}
          secondsLeft={secondsLeft}
          question={currentQ}
          selectedIdx={selectedIdx}
          answerState={answerState}
          graded={graded}
          gradeError={gradeError}
          isLast={currentIdx + 1 >= totalQ}
          onSelect={handleAnswer}
          onNext={goNext}
          showKorean={showKorean}
        />
      )}

      {/* ─── 3. RESULT ─── */}
      {screen === 'result' && (
        <ResultScreen
          totalQ={totalQ}
          stats={stats}
          questions={session.questions}
          answers={answers}
          onRetry={startQuiz}
          recommendation={recommendation}
        />
      )}

      {/* ─── O/X Feedback Overlay ─── */}
      {feedback && (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          aria-hidden
        >
          <div
            className="flex h-[140px] w-[140px] items-center justify-center rounded-[var(--r-2xl)] bg-[var(--bg)]/90 shadow-[var(--sh-xl)] backdrop-blur"
            style={{ animation: 'feedbackPop 0.3s var(--ease-spring)' }}
          >
            {feedback === 'O' ? (
              <div className="h-[100px] w-[100px] rounded-full border-[10px] border-[var(--p)] opacity-70" />
            ) : (
              <X size={100} strokeWidth={3} className="text-[var(--error-ink)] opacity-70" />
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes feedbackPop {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Start Screen
// ══════════════════════════════════════════════════════════════
function StartScreen({
  session,
  onStart,
}: {
  session: QuizSession
  onStart: () => void
}) {
  // 닫기: ?from(계획/워크스페이스 진입) 우선, 없으면 ScriptQuiz 허브 (라이브러리 하드코딩 제거).
  const backHref = sanitizeInternalPath(useSearchParams()?.get('from')) ?? '/scriptquiz'
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
      {/* QUIZ 로고 — **제목이 아니라 워드마크다.** `h1` 으로 두면 SessionFrame 의 h1 과
          둘이 되어 화면의 주제가 모호해진다. 보이는 것은 그대로다. */}
      <p className="font-display text-[64px] font-[900] leading-none tracking-tight md:text-[80px]">
        <span className="bg-gradient-to-br from-[#5BC8F5] to-[#1A7AB8] bg-clip-text text-transparent drop-shadow-sm">
          QUIZ
        </span>
      </p>
      <p className="mt-3 font-mono text-[11px] font-[700] uppercase tracking-[0.20em] text-[var(--t2)]">
        스크립트 독해 퀴즈
      </p>

      {/* 스크립트 정보 */}
      <div className="mt-10 rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-8 shadow-[var(--sh-md)]">
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--p-light)] px-3 py-1 font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--on-p-tint)]">
          <BookOpen size={11} aria-hidden />
          스크립트 기반 퀴즈
        </span>
        <h2 className="mt-4 font-english text-[24px] font-[700] text-[var(--t1)] md:text-[28px]">
          {session.textTitle}
        </h2>
        {session.textChapter && (
          <p className="mt-1 font-display text-[14px] font-[600] text-[var(--t2)]">
            {session.textChapter}
          </p>
        )}

        <div className="mt-6 grid grid-cols-3 gap-4 border-y border-[var(--bd)] py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--t2)]">
              문항
            </p>
            <p className="mt-1 font-display text-[20px] font-[800] tabular-nums text-[var(--t1)]">
              {session.questions.length}
            </p>
          </div>
          <div className="border-x border-[var(--bd)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--t2)]">
              제한 시간
            </p>
            <p className="mt-1 font-display text-[20px] font-[800] tabular-nums text-[var(--t1)]">
              {QUESTION_TIME_LIMIT}
              <span className="text-[12px] text-[var(--t2)]">s</span>
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--t2)]">
              만점
            </p>
            <p className="mt-1 font-display text-[20px] font-[800] tabular-nums text-[var(--t1)]">
              {session.questions.length * 20}
            </p>
          </div>
        </div>

        <p className="mt-6 font-body text-[13px] leading-relaxed text-[var(--t2)]">
          스크립트에 근거한 문제만 출제됩니다. 추론보다 <strong className="text-[var(--t1)]">근거 찾기</strong>에 집중하세요.
        </p>
      </div>

      {/* Start 버튼 */}
      <button
        onClick={onStart}
        className="mt-8 inline-flex items-center gap-2 rounded-[var(--r-full)] bg-[var(--p)] px-10 py-4 font-display text-[16px] font-[700] text-[var(--on-p)] shadow-[0_4px_0_var(--p-dark),var(--sh-md)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] active:translate-y-1 active:shadow-[0_2px_0_var(--p-dark)]"
      >
        <Play size={16} strokeWidth={2.5} aria-hidden />
        시작하기
      </button>

      <Link
        href={backHref}
        className="mt-4 inline-flex items-center gap-1 font-display text-[13px] font-[600] text-[var(--t2)] hover:text-[var(--t1)]"
      >
        <ArrowLeft size={13} aria-hidden />
        돌아가기
      </Link>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Question Screen
// ══════════════════════════════════════════════════════════════
function QuestionScreen({
  questionIdx,
  totalQ,
  score,
  secondsLeft,
  question,
  selectedIdx,
  answerState,
  graded,
  gradeError,
  isLast,
  onSelect,
  onNext,
  showKorean = false,
}: {
  questionIdx: number
  totalQ: number
  score: number
  secondsLeft: number
  question: QuizQuestion
  selectedIdx: number | null
  answerState: AnswerState
  /** 서버 채점 결과 — 답하기 전에는 null. 정답 인덱스가 화면에 들어오는 유일한 통로다. */
  graded: { correctIndex: number; sourceSnippet: string } | null
  gradeError: string | null
  isLast: boolean
  onSelect: (idx: number) => void
  onNext: () => void
  showKorean?: boolean
}) {
  const progressPct = ((questionIdx + 1) / totalQ) * 100
  const timeColor =
    secondsLeft > 15 ? 'var(--success)' : secondsLeft > 7 ? 'var(--active)' : 'var(--error)'
  const answered = answerState === 'answered' && graded !== null
  const locked = answerState !== 'idle'
  const correctIdx = graded?.correctIndex ?? -1
  const isRight = answered && selectedIdx === correctIdx

  return (
    <>
      {/* HUD bar */}
      <div className="sticky top-0 z-10 bg-[var(--p)] text-[var(--on-p)] shadow-[var(--sh-sm)]">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 md:px-6">
          <span className="font-mono text-[12px] font-[700] uppercase tracking-[0.10em] opacity-80">
            {String(questionIdx + 1).padStart(2, '0')} / {String(totalQ).padStart(2, '0')}
          </span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--ti)]/20">
            <div
              className="h-full rounded-full bg-[var(--ti)] transition-[width] duration-[var(--dur-slow)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span
            className="inline-flex items-center gap-1 rounded-full bg-[var(--ti)]/15 px-3 py-1 font-mono text-[12px] font-[700] tabular-nums"
            style={{ color: timeColor === 'var(--error)' ? '#FFD9D9' : 'inherit' }}
          >
            <Clock size={11} aria-hidden />
            {secondsLeft}s
          </span>
          <span className="hidden font-mono text-[12px] font-[700] tabular-nums opacity-90 sm:inline">
            {score}점
          </span>
        </div>
      </div>

      {/* Question body */}
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-10">
        {/* 문제 박스 */}
        <div className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-sm)] md:p-7">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--p-light)] px-3 py-1 font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--on-p-tint)]">
            {question.type === 'truefalse' ? 'OX' : '4지선다'}
          </span>
          <h2 className="mt-3 font-english text-[18px] font-[600] leading-[1.6] text-[var(--t1)] md:text-[20px]">
            {question.question}
          </h2>
          {showKorean && question.questionKo && (
            <p className="mt-1.5 font-body text-[12px] leading-relaxed text-[var(--t2)]">
              {question.questionKo}
            </p>
          )}
        </div>

        {/* ── 채점 실패 — **오답이 아니다.** 다시 고를 수 있는 상태로 되돌아와 있다. ── */}
        {gradeError && !answered && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-5 flex items-start gap-3 rounded-[var(--r-lg)] border border-[var(--error)] bg-[var(--error-light)] p-4"
          >
            <span
              className="mt-[1px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--error-ink)]"
              aria-hidden
            >
              <AlertTriangle size={14} strokeWidth={2.5} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-keep font-display text-[13px] font-[700] text-[var(--error-ink)]">
                채점을 못 했어요 — 오답 처리하지 않았어요.
              </p>
              <p className="mt-1 break-keep font-body text-[12px] leading-relaxed text-[var(--t2)]">
                한 번 더 골라 주세요. 시간은 멈춰 뒀어요.
              </p>
            </div>
          </div>
        )}

        {/* ── 판정 + 스크립트 근거 — **선택지 위**에 둔다 ──
            390px 에서 선택지 아래는 접힘선 밑이라 아무도 못 읽었다. 게다가 예전에는
            1,000ms 뒤 화면이 통째로 갈아치워져 스크롤할 새조차 없었다.
            색(배경) + 아이콘 + 등장 애니메이션 3중 + `aria-live` — 색상 단독 금지. */}
        {answered && (
          <div
            aria-live="polite"
            className="mt-5 flex flex-col gap-3 rounded-[var(--r-lg)] border-l-4 p-4"
            style={{
              borderColor: isRight ? 'var(--success)' : 'var(--error)',
              background: isRight ? 'var(--success-light)' : 'var(--error-light)',
              animation: 'fadeInScale var(--dur-slow) var(--ease-out)',
            }}
          >
            <p className="flex items-center gap-2 break-keep font-display text-[14px] font-[700]">
              <span
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg)]"
                style={{ color: isRight ? 'var(--success)' : 'var(--error-ink)' }}
                aria-hidden
              >
                {isRight ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
              </span>
              <span style={{ color: isRight ? 'var(--success)' : 'var(--error-ink)' }}>
                {isRight ? '맞혔어요' : selectedIdx === -1 ? '시간이 지났어요' : '아쉬워요'}
              </span>
              {!isRight && (
                <span className="font-mono text-[12px] font-[700] text-[var(--t2)]">
                  정답 {correctIdx + 1}번
                </span>
              )}
            </p>
            {!isRight && (
              <p className="break-keep font-body text-[12.5px] leading-relaxed text-[var(--t2)]">
                내 답{' '}
                <span className="font-english text-[13px] text-[var(--t1)]">
                  {selectedIdx != null && selectedIdx >= 0
                    ? question.options[selectedIdx]?.text ?? '—'
                    : '고르지 못했어요'}
                </span>
                {' · '}정답{' '}
                <span className="font-english text-[13px] font-[600] text-[var(--t1)]">
                  {question.options[correctIdx]?.text ?? '—'}
                </span>
              </p>
            )}
            {graded?.sourceSnippet && (
              <div>
                <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--t2)]">
                  스크립트 근거
                </p>
                <p className="mt-1.5 font-english text-[14px] italic leading-[1.7] text-[var(--t1)]">
                  {graded.sourceSnippet}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 선택지 — OX 타입은 가로 2열 큰 버튼, multiple 은 세로 리스트 */}
        {question.type === 'truefalse' ? (
          <ul className="mt-5 grid grid-cols-2 gap-3" role="radiogroup" aria-label="OX 선택">
            {question.options.map((opt, i) => {
              const isSelected = selectedIdx === i
              // 정답 표시는 **서버가 돌려준 correctIndex** 로만 한다 — 답하기 전에는 -1 이라 아무것도 안 켜진다.
              const isCorrect = i === correctIdx
              const showCorrect = answered && isCorrect
              const showWrong = answered && isSelected && !isCorrect
              const isOther = answered && !isSelected && !isCorrect
              // ⚠️ **기호는 자리가 아니라 선지의 뜻에서 온다.**
              //    예전에는 `i === 0 ? 'O' : 'X'` 였다. 그런데 DB 에는 options 가
              //    `["False","True"]` 순서인 행이 있어(실측 2026-09-05 · 4/47건),
              //    참이라고 판단해 큰 O 를 누르면 **오답 처리**됐다 — 정답 "True" 가
              //    X 버튼에 앉아 있었기 때문이다. 버튼 아래 12px 글씨가 `False · O` 라고
              //    적어 두긴 했지만 72px 기호가 그것을 압도한다.
              const symbol = isTrueOption(opt.text) ? 'O' : 'X'
              const symbolColor = symbol === 'O' ? 'var(--p)' : 'var(--error)'

              return (
                <li key={i}>
                  <button
                    type="button"
                    role="radio"
                    onClick={() => onSelect(i)}
                    disabled={locked}
                    aria-checked={isSelected}
                    className={`flex h-32 w-full flex-col items-center justify-center gap-2 rounded-[var(--r-lg)] border-2 transition-all duration-[var(--dur-normal)] md:h-40 ${
                      showCorrect
                        ? 'border-[var(--success)] bg-[var(--success-light)]'
                        : showWrong
                          ? 'border-[var(--error)] bg-[var(--error-light)]'
                          : isSelected
                            ? 'border-[var(--p)] bg-[var(--p-light)]'
                            : isOther
                              ? 'border-[var(--bd)] bg-[var(--bg)] opacity-45'
                              : 'border-[var(--bd)] bg-[var(--bg)] hover:scale-[1.02] hover:border-[var(--p)] hover:bg-[var(--p-light)]'
                    }`}
                  >
                    <span
                      className="font-display text-[56px] font-[800] leading-none md:text-[72px]"
                      style={{ color: symbolColor }}
                      aria-hidden
                    >
                      {symbol}
                    </span>
                    <span className="font-display text-[12px] font-[600] text-[var(--t2)]">
                      {opt.text} ·{' '}
                      <kbd className="rounded bg-[var(--bg2)] px-1 py-1 font-mono text-[10px] text-[var(--t2)]">
                        {symbol}
                      </kbd>
                    </span>
                    {showKorean && opt.textKo && (
                      <span className="font-body text-[10px] text-[var(--t2)]">
                        {opt.textKo}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className="mt-5 space-y-3">
            {question.options.map((opt, i) => {
              const isSelected = selectedIdx === i
              // 정답 표시는 **서버가 돌려준 correctIndex** 로만 한다 — 답하기 전에는 -1 이라 아무것도 안 켜진다.
              const isCorrect = i === correctIdx
              const showCorrect = answered && isCorrect
              const showWrong = answered && isSelected && !isCorrect
              const isOther = answered && !isSelected && !isCorrect

              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onSelect(i)}
                    disabled={locked}
                    className={`relative flex w-full items-center gap-4 rounded-[var(--r-lg)] border-2 p-4 text-left transition-all duration-[var(--dur-normal)] md:p-5 ${
                      showCorrect
                        ? 'border-[var(--success)] bg-[var(--success-light)]'
                        : showWrong
                          ? 'border-[var(--error)] bg-[var(--error-light)]'
                          : isSelected
                            ? 'border-[var(--p)] bg-[var(--p-light)]'
                            : isOther
                              ? 'border-[var(--bd)] bg-[var(--bg)] opacity-45'
                              : 'border-[var(--bd)] bg-[var(--bg)] hover:border-[var(--p)] hover:bg-[var(--p-light)]'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-[700] tabular-nums ${
                        showCorrect
                          ? 'bg-[var(--success)] text-[var(--ti)]'
                          : showWrong
                            ? 'bg-[var(--error)] text-[var(--ti)]'
                            : 'bg-[var(--bg2)] text-[var(--t2)]'
                      }`}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1">
                      <span className="block font-english text-[15px] leading-[1.55] text-[var(--t1)]">
                        {opt.text}
                      </span>
                      {showKorean && opt.textKo && (
                        <span className="mt-0.5 block font-body text-[12px] text-[var(--t2)]">
                          {opt.textKo}
                        </span>
                      )}
                    </span>
                    {showCorrect && (
                      <span
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--active)]"
                        aria-label="정답"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                          <path
                            d="M3 12.5l5.5 5.5L21 6"
                            stroke="#FFE234"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                    {showWrong && <X size={20} strokeWidth={3} className="text-[var(--error-ink)]" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {/* 키보드 힌트 */}
        {answerState === 'idle' && (
          <p className="mt-3 text-center font-mono text-[10px] text-[var(--t2)]">
            키보드 {question.type === 'truefalse' ? 'O / X (← →)' : '1 ~ ' + question.options.length}{' '}
            도 사용할 수 있어요.
          </p>
        )}

        {/* 채점 중 — 「아무 일도 안 일어난다」로 보이지 않게 말해 준다. */}
        {answerState === 'grading' && (
          <p className="mt-3 text-center font-mono text-[10px] text-[var(--t2)]" aria-live="polite">
            채점하는 중…
          </p>
        )}

        {/* ── 다음으로 — **넘기는 것은 학습자다.** 자동 전진(1,000ms)을 없앤 자리. ── */}
        {answered && (
          <button
            type="button"
            onClick={onNext}

            className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-6 py-3 font-display text-[15px] font-[700] text-[var(--on-p)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {isLast ? '결과 보기' : '다음 문항'}
            <ArrowRight size={15} strokeWidth={2.25} aria-hidden />
          </button>
        )}
        {answered && (
          <p className="mt-2 text-center font-mono text-[10px] text-[var(--t2)]">
            Enter 로도 넘어가요. 근거를 다 읽고 눌러도 괜찮아요.
          </p>
        )}
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// Result Screen
// ══════════════════════════════════════════════════════════════
function ResultScreen({
  totalQ,
  stats,
  questions,
  answers,
  onRetry,
  recommendation,
}: {
  totalQ: number
  stats: { correct: number; wrong: number; accuracy: number; avgTimeSec: number }
  questions: QuizQuestion[]
  answers: QuizAnswer[]
  onRetry: () => void
  recommendation?: RecommendedAction
}) {
  // ⚠️ **문항이 아니라 답에서 만든다.** 예전에는 틀린 문항의 `question` 과 `sourceSnippet`
  //   만 그리고 **정답도, 내가 고른 것도 안 보여 줬다** — 즉 틀린 문항의 정답을 알 경로가
  //   세션 전체에 하나도 없었다. 채점 결과(`QuizAnswer`)에 둘 다 들어 있으므로 여기서 편다.
  const wrongItems = answers
    .filter((a) => !a.isCorrect)
    .map((a) => ({ answer: a, question: questions.find((q) => q.id === a.questionId) }))
    .filter((x): x is { answer: QuizAnswer; question: QuizQuestion } => x.question !== undefined)

  // 격려 메시지 — 공감 피드백
  const encouragement =
    stats.accuracy >= 90
      ? '훌륭한 흐름이에요. 스크립트을 깊이 이해하셨네요.'
      : stats.accuracy >= 70
        ? '탄탄한 회상이었어요. 오답은 곧 익숙해질 거예요.'
        : '괜찮아요, 인지적 분투는 기억을 단단하게 만들어요.'

  // SVG 점수 링 — strokeDashoffset 애니메이션
  const radius = 70
  const circumference = 2 * Math.PI * radius

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <div className="rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 shadow-[var(--sh-md)] md:p-10">
        {/* 헤더 */}
        <header className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--success-light)] px-3 py-1 font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--success)]">
            <Sparkles size={11} aria-hidden />
            완료
          </span>
          {/* 완료 문구 — 화면의 이름은 SessionFrame 이 낸다. 여기는 그 아래 단계다. */}
          <h2 className="mt-3 font-display text-[26px] font-[800] tracking-tight text-[var(--t1)] md:text-[32px]">
            오늘 잘 마쳤어요
          </h2>
          <p className="mt-2 font-body text-[14px] leading-relaxed text-[var(--t2)]">
            {encouragement}
          </p>
        </header>

        {/* 점수 링 */}
        <div className="mt-8 flex justify-center">
          <div className="relative">
            <svg width="180" height="180" viewBox="0 0 180 180">
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="var(--bg3)"
                strokeWidth="10"
              />
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="var(--p)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - stats.accuracy / 100)}
                transform="rotate(-90 90 90)"
                style={{ transition: 'stroke-dashoffset 1s var(--ease-out)' }}
              />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--t2)]">
                정확도
              </p>
              <p className="font-display text-[40px] font-[800] tabular-nums leading-none text-[var(--t1)]">
                {stats.accuracy}%
              </p>
            </div>
          </div>
        </div>

        {/* 통계 3분할 */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          <div className="rounded-[var(--r-md)] bg-[var(--success-light)] p-4 text-center">
            <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--success)]">
              정답
            </p>
            <p className="mt-1 font-display text-[24px] font-[800] tabular-nums leading-none text-[var(--success)]">
              {stats.correct}
              <span className="ml-1 text-[12px] text-[var(--t2)]">/ {totalQ}</span>
            </p>
          </div>
          <div className="rounded-[var(--r-md)] bg-[var(--error-light)] p-4 text-center">
            <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--error-ink)]">
              오답
            </p>
            <p className="mt-1 font-display text-[24px] font-[800] tabular-nums leading-none text-[var(--error-ink)]">
              {stats.wrong}
            </p>
          </div>
          <div className="rounded-[var(--r-md)] bg-[var(--bg2)] p-4 text-center">
            <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--t2)]">
              평균 시간
            </p>
            <p className="mt-1 font-display text-[24px] font-[800] tabular-nums leading-none text-[var(--t1)]">
              {stats.avgTimeSec}
              <span className="ml-1 text-[12px] text-[var(--t2)]">s</span>
            </p>
          </div>
        </div>

        {/* 오답 복습 */}
        {wrongItems.length > 0 && (
          <section className="mt-8" aria-label="오답 복습">
            <header className="mb-3 flex items-center gap-2">
              <RefreshCw size={14} className="text-[var(--active)]" aria-hidden />
              <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
                다시 만나봐요
              </h2>
              <span className="font-mono text-[11px] text-[var(--t2)]">{wrongItems.length}문제</span>
            </header>
            <ul className="space-y-2">
              {wrongItems.map(({ answer, question }) => (
                <li
                  key={question.id}
                  className="rounded-[var(--r-md)] border-l-4 border-[var(--active)] bg-[var(--active-light)]/40 p-3"
                >
                  {/* 영어 본문은 세션 내내 같은 서체(Lora)로 — 문제 화면과 갈리면 같은 문장이 두 얼굴이 된다. */}
                  <p className="font-english text-[13px] font-[600] leading-[1.6] text-[var(--t1)]">
                    {question.question}
                  </p>

                  {/* 내 답 / 정답 — 색만으로 구분하지 않는다(아이콘 + 라벨 동반). */}
                  <dl className="mt-2 flex flex-col gap-1.5">
                    <div className="flex items-start gap-2">
                      <dt className="inline-flex shrink-0 items-center gap-1 font-display text-[11px] font-[700] text-[var(--error-ink)]">
                        <X size={12} strokeWidth={3} aria-hidden />
                        <span className="break-keep">내 답</span>
                      </dt>
                      <dd className="min-w-0 flex-1 font-english text-[12.5px] leading-relaxed text-[var(--t2)]">
                        {answer.selectedIndex >= 0
                          ? question.options[answer.selectedIndex]?.text ?? '—'
                          : '시간이 지나 못 골랐어요'}
                      </dd>
                    </div>
                    <div className="flex items-start gap-2">
                      <dt className="inline-flex shrink-0 items-center gap-1 font-display text-[11px] font-[700] text-[var(--success)]">
                        <Check size={12} strokeWidth={3} aria-hidden />
                        <span className="break-keep">정답</span>
                      </dt>
                      <dd className="min-w-0 flex-1 font-english text-[12.5px] font-[600] leading-relaxed text-[var(--t1)]">
                        {question.options[answer.correctIndex]?.text ?? '—'}
                      </dd>
                    </div>
                  </dl>

                  {answer.sourceSnippet && (
                    <p className="mt-2 font-english text-[12px] italic leading-relaxed text-[var(--t2)]">
                      “{answer.sourceSnippet}”
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후) */}
        {recommendation && (
          <div className="mt-8">
            <NextActionCard
              recommendation={recommendation}
              prelude="이 스크립트을 잘 다뤘어요. 다음으로 어떤 학습을 해볼까요?"
            />
          </div>
        )}

        {/* CTA */}
        <footer className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={onRetry}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] border-2 border-[var(--bd)] bg-[var(--bg)] px-6 py-3 font-display text-[14px] font-[700] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[var(--p-light)] sm:w-auto"
          >
            <RefreshCw size={14} aria-hidden />
            다시 풀기
          </button>
          <Link
            href="/wordvault"
            className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-6 py-3 font-display text-[14px] font-[700] text-[var(--on-p)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] sm:w-auto"
          >
            오답 단어 학습으로
            <ArrowRight size={14} aria-hidden />
          </Link>
        </footer>
      </div>
    </div>
  )
}
