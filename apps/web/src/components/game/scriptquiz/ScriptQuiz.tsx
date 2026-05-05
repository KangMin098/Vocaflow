// apps/web/src/components/game/scriptquiz/ScriptQuiz.tsx
// ScriptQuiz — 3-screen flow (start → question → result)
// CLAUDE.md §12 기준
//   · 능동적 회상 (Active Recall) — 보기 → 답하기
//   · 맥락 의존 기억 — sourceSnippet 으로 스크립트 근거 표시
//   · 공감 피드백 — 오답을 부드럽게 ("다시 만나봐요")

'use client'

import { ArrowLeft, ArrowRight, BookOpen, Clock, Play, RefreshCw, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { MOCK_SESSION } from './mock-data'
import type { AnswerState, QuizAnswer, QuizScreen } from './types'

import { NextActionCard } from '@/components/recommend/NextActionCard'
import {
  getMockNextAction,
  MOCK_USER_CONTEXTS,
} from '@/lib/recommend/next-action.mock'
import type { RecommendedAction } from '@/lib/recommend/types'
import { pushPendingTextResult } from '@/lib/srs/session-storage'

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════
const FEEDBACK_DURATION = 800 // ms — O/X 오버레이 표시 시간
const QUESTION_TIME_LIMIT = 30 // sec — 한 문제당 권장 시간

// ══════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════
export interface ScriptQuizProps {
  /** 한국어 번역 보조 표시 여부 — hub 토글에서 결정 */
  showKorean?: boolean
  /** 스크립트 식별자 — Phase 2: real textId. 미지정 시 session.textTitle 을 stable key 로 사용 */
  textId?: string
}

export function ScriptQuiz({ showKorean = false, textId }: ScriptQuizProps = {}) {
  const session = MOCK_SESSION

  // §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후)
  // ScriptQuiz 직후 → 같은 모듈 self-loop 회피. warm_inprogress → Workspace "이어 듣기" (§17 Context-Dependent L4→L2 cycle)
  // DB 연동 시: getMockNextAction → getNextAction(userId, { context: 'after_scriptquiz' })
  const recommendation = useMemo(
    () => getMockNextAction(MOCK_USER_CONTEXTS.warm_inprogress),
    []
  )

  const [screen, setScreen] = useState<QuizScreen>('start')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_TIME_LIMIT)
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(0)
  const [feedback, setFeedback] = useState<'O' | 'X' | null>(null)

  const currentQ = session.questions[currentIdx]
  const totalQ = session.questions.length

  // ── 타이머 ──
  useEffect(() => {
    if (screen !== 'question' || answerState === 'answered') return
    if (secondsLeft <= 0) {
      handleAnswer(-1) // 시간 초과
      return
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
    // handleAnswer 는 currentIdx · currentQ 캡처 — 의도된 stale closure
    // (currentIdx 변경 시 secondsLeft가 리셋되어 useEffect 재실행)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, screen, answerState])

  // ── 키보드 단축키 (1~4 / O,X) ──
  useEffect(() => {
    if (screen !== 'question' || answerState !== 'idle') return
    const handler = (e: KeyboardEvent) => {
      const max = currentQ.options.length
      const num = parseInt(e.key, 10)
      if (!isNaN(num) && num >= 1 && num <= max) {
        e.preventDefault()
        handleAnswer(num - 1)
        return
      }
      if (currentQ.type === 'truefalse') {
        const k = e.key.toLowerCase()
        if (k === 'o' || e.key === 'ArrowLeft') {
          e.preventDefault()
          handleAnswer(0)
        } else if (k === 'x' || e.key === 'ArrowRight') {
          e.preventDefault()
          handleAnswer(1)
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
    setSecondsLeft(QUESTION_TIME_LIMIT)
    setQuestionStartedAt(Date.now())
  }

  // ── 답변 처리 ──
  function handleAnswer(idx: number) {
    if (answerState !== 'idle') return
    const isCorrect = idx === currentQ.correctIndex
    const timeMs = Date.now() - questionStartedAt
    const newAnswer: QuizAnswer = {
      questionId: currentQ.id,
      selectedIndex: idx,
      isCorrect,
      timeMs,
    }
    const finalAnswers = [...answers, newAnswer]

    setSelectedIdx(idx)
    setAnswerState('answered')
    setFeedback(isCorrect ? 'O' : 'X')
    setAnswers(finalAnswers)

    // 피드백 오버레이 후 다음 문제로
    setTimeout(() => {
      setFeedback(null)
      setTimeout(() => {
        if (currentIdx + 1 >= totalQ) {
          // §17 [4] L4d 통합 검증 — 텍스트 단위 결과 (Plan B)
          // textId 미지정 시 session.textTitle 을 stable key 로 사용 (Phase 2: real textId 교체)
          const correctCount = finalAnswers.filter((a) => a.isCorrect).length
          const totalCount = finalAnswers.length
          pushPendingTextResult({
            textId: textId ?? session.textTitle,
            accuracy: totalCount > 0 ? (correctCount / totalCount) * 100 : 0,
            correctCount,
            totalCount,
            completedAt: new Date().toISOString(),
            module: 'scriptquiz',
          })
          setScreen('result')
        } else {
          setCurrentIdx((i) => i + 1)
          setSelectedIdx(null)
          setAnswerState('idle')
          setSecondsLeft(QUESTION_TIME_LIMIT)
          setQuestionStartedAt(Date.now())
        }
      }, 200)
    }, FEEDBACK_DURATION)
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
          onSelect={handleAnswer}
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
              <X size={100} strokeWidth={3} className="text-[var(--error)] opacity-70" />
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
  session: typeof MOCK_SESSION
  onStart: () => void
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
      {/* QUIZ 로고 */}
      <h1 className="font-display text-[64px] font-[900] leading-none tracking-tight md:text-[80px]">
        <span className="bg-gradient-to-br from-[#5BC8F5] to-[#1A7AB8] bg-clip-text text-transparent drop-shadow-sm">
          QUIZ
        </span>
      </h1>
      <p className="mt-3 font-mono text-[11px] font-[700] uppercase tracking-[0.20em] text-[var(--t3)]">
        스크립트 독해 퀴즈
      </p>

      {/* 스크립트 정보 */}
      <div className="mt-10 rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-8 shadow-[var(--sh-md)]">
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--p-light)] px-3 py-1 font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
          <BookOpen size={11} aria-hidden />
          스크립트 기반 퀴즈
        </span>
        <h2 className="mt-4 font-english text-[24px] font-[700] text-[var(--t1)] md:text-[28px]">
          {session.textTitle}
        </h2>
        {session.textChapter && (
          <p className="mt-1 font-display text-[14px] font-[600] text-[var(--t3)]">
            {session.textChapter}
          </p>
        )}

        <div className="mt-6 grid grid-cols-3 gap-4 border-y border-[var(--bd)] py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--t3)]">
              문항
            </p>
            <p className="mt-1 font-display text-[20px] font-[800] tabular-nums text-[var(--t1)]">
              {session.questions.length}
            </p>
          </div>
          <div className="border-x border-[var(--bd)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--t3)]">
              제한 시간
            </p>
            <p className="mt-1 font-display text-[20px] font-[800] tabular-nums text-[var(--t1)]">
              {QUESTION_TIME_LIMIT}
              <span className="text-[12px] text-[var(--t3)]">s</span>
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--t3)]">
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
        className="mt-8 inline-flex items-center gap-2 rounded-[var(--r-full)] bg-[var(--p)] px-10 py-4 font-display text-[16px] font-[700] text-[var(--ti)] shadow-[0_4px_0_var(--p-dark),var(--sh-md)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] active:translate-y-1 active:shadow-[0_2px_0_var(--p-dark)]"
      >
        <Play size={16} strokeWidth={2.5} aria-hidden />
        시작하기
      </button>

      <Link
        href="/library"
        className="mt-4 inline-flex items-center gap-1 font-display text-[13px] font-[600] text-[var(--t2)] hover:text-[var(--t1)]"
      >
        <ArrowLeft size={13} aria-hidden />
        라이브러리로
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
  onSelect,
  showKorean = false,
}: {
  questionIdx: number
  totalQ: number
  score: number
  secondsLeft: number
  question: typeof MOCK_SESSION.questions[number]
  selectedIdx: number | null
  answerState: AnswerState
  onSelect: (idx: number) => void
  showKorean?: boolean
}) {
  const progressPct = ((questionIdx + 1) / totalQ) * 100
  const timeColor =
    secondsLeft > 15 ? 'var(--success)' : secondsLeft > 7 ? 'var(--active)' : 'var(--error)'

  return (
    <>
      {/* HUD bar */}
      <div className="sticky top-0 z-10 bg-[var(--p)] text-[var(--ti)] shadow-[var(--sh-sm)]">
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
            className="inline-flex items-center gap-1 rounded-full bg-[var(--ti)]/15 px-2.5 py-0.5 font-mono text-[12px] font-[700] tabular-nums"
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--p-light)] px-2.5 py-0.5 font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--p)]">
            {question.type === 'truefalse' ? 'OX' : '4지선다'}
          </span>
          <h2 className="mt-3 font-english text-[18px] font-[600] leading-[1.6] text-[var(--t1)] md:text-[20px]">
            {question.question}
          </h2>
          {showKorean && question.questionKo && (
            <p className="mt-1.5 font-body text-[12px] leading-relaxed text-[var(--t3)]">
              {question.questionKo}
            </p>
          )}
        </div>

        {/* 선택지 — OX 타입은 가로 2열 큰 버튼, multiple 은 세로 리스트 */}
        {question.type === 'truefalse' ? (
          <ul className="mt-5 grid grid-cols-2 gap-3" role="radiogroup" aria-label="OX 선택">
            {question.options.map((opt, i) => {
              const isSelected = selectedIdx === i
              const isCorrect = i === question.correctIndex
              const showCorrect = answerState === 'answered' && isCorrect
              const showWrong = answerState === 'answered' && isSelected && !isCorrect
              const isOther = answerState === 'answered' && !isSelected && !isCorrect
              const symbol = i === 0 ? 'O' : 'X'
              const symbolColor = i === 0 ? 'var(--p)' : 'var(--error)'

              return (
                <li key={i}>
                  <button
                    type="button"
                    role="radio"
                    onClick={() => onSelect(i)}
                    disabled={answerState === 'answered'}
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
                      <kbd className="rounded bg-[var(--bg2)] px-1 py-0.5 font-mono text-[10px] text-[var(--t3)]">
                        {symbol}
                      </kbd>
                    </span>
                    {showKorean && opt.textKo && (
                      <span className="font-body text-[10px] text-[var(--t3)]">
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
              const isCorrect = i === question.correctIndex
              const showCorrect = answerState === 'answered' && isCorrect
              const showWrong = answerState === 'answered' && isSelected && !isCorrect
              const isOther = answerState === 'answered' && !isSelected && !isCorrect

              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onSelect(i)}
                    disabled={answerState === 'answered'}
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
                        <span className="mt-0.5 block font-body text-[12px] text-[var(--t3)]">
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
                    {showWrong && <X size={20} strokeWidth={3} className="text-[var(--error)]" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {/* 키보드 힌트 */}
        {answerState === 'idle' && (
          <p className="mt-3 text-center font-mono text-[10px] text-[var(--t3)]">
            키보드 {question.type === 'truefalse' ? 'O / X (← →)' : '1 ~ ' + question.options.length}{' '}
            도 사용할 수 있어요.
          </p>
        )}

        {/* 답한 후 sourceSnippet 보여주기 */}
        {answerState === 'answered' && question.sourceSnippet && (
          <div className="mt-5 rounded-[var(--r-lg)] border-l-4 border-[var(--active)] bg-[var(--active-light)]/40 p-4">
            <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--active)]">
              스크립트 근거
            </p>
            <p className="mt-2 font-english text-[14px] italic leading-[1.7] text-[var(--t1)]">
              {question.sourceSnippet}
            </p>
          </div>
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
  questions: typeof MOCK_SESSION.questions
  answers: QuizAnswer[]
  onRetry: () => void
  recommendation?: RecommendedAction
}) {
  const wrongQs = questions.filter((q) =>
    answers.find((a) => a.questionId === q.id && !a.isCorrect)
  )

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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-light)] px-3 py-1 font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--success)]">
            <Sparkles size={11} aria-hidden />
            완료
          </span>
          <h1 className="mt-3 font-display text-[26px] font-[800] tracking-tight text-[var(--t1)] md:text-[32px]">
            오늘 잘 마쳤어요
          </h1>
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
              <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--t3)]">
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
              <span className="ml-1 text-[12px] text-[var(--t3)]">/ {totalQ}</span>
            </p>
          </div>
          <div className="rounded-[var(--r-md)] bg-[var(--error-light)] p-4 text-center">
            <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--error)]">
              오답
            </p>
            <p className="mt-1 font-display text-[24px] font-[800] tabular-nums leading-none text-[var(--error)]">
              {stats.wrong}
            </p>
          </div>
          <div className="rounded-[var(--r-md)] bg-[var(--bg2)] p-4 text-center">
            <p className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[var(--t3)]">
              평균 시간
            </p>
            <p className="mt-1 font-display text-[24px] font-[800] tabular-nums leading-none text-[var(--t1)]">
              {stats.avgTimeSec}
              <span className="ml-1 text-[12px] text-[var(--t3)]">s</span>
            </p>
          </div>
        </div>

        {/* 오답 복습 */}
        {wrongQs.length > 0 && (
          <section className="mt-8" aria-label="오답 복습">
            <header className="mb-3 flex items-center gap-2">
              <RefreshCw size={14} className="text-[var(--active)]" aria-hidden />
              <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
                다시 만나봐요
              </h2>
              <span className="font-mono text-[11px] text-[var(--t3)]">{wrongQs.length}문제</span>
            </header>
            <ul className="space-y-2">
              {wrongQs.map((q) => (
                <li
                  key={q.id}
                  className="rounded-[var(--r-md)] border-l-4 border-[var(--active)] bg-[var(--active-light)]/40 p-3"
                >
                  <p className="font-display text-[13px] font-[600] text-[var(--t1)]">
                    {q.question}
                  </p>
                  <p className="mt-1.5 font-english text-[12px] italic leading-relaxed text-[var(--t2)]">
                    “{q.sourceSnippet}”
                  </p>
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-6 py-3 font-display text-[14px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] sm:w-auto"
          >
            오답 단어 학습으로
            <ArrowRight size={14} aria-hidden />
          </Link>
        </footer>
      </div>
    </div>
  )
}
