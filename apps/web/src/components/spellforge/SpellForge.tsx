// apps/web/src/components/spellforge/SpellForge.tsx

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

import { ConfirmButton } from './ConfirmButton'
import { IMEIndicator } from './IMEIndicator'
import { InputSlots } from './InputSlots'
import { MeaningDisplay } from './MeaningDisplay'
import { MicroPause } from './MicroPause'
import { ModeSelector } from './ModeSelector'
import { ReflectionHint } from './ReflectionHint'
import { SingleBox } from './SingleBox'

import { useActiveHint } from '@/hooks/useActiveHint'
import { useDelayedFeedback } from '@/hooks/useDelayedFeedback'
import { useIMEDetection } from '@/hooks/useIMEDetection'
import { useSpellForgeSession } from '@/hooks/useSpellForgeSession'
import { useTypingMode } from '@/hooks/useTypingMode'

import { SpellForgeCompletion } from './SpellForgeCompletion'

import { useNextAction } from '@/lib/recommend/use-next-action'
import { evaluateInput, generateReflectionMessage } from '@/lib/spellforge/scoring'
import { applyReview, createNewCard } from '@/lib/srs'
import { flushPendingSession } from '@/lib/srs/flush-session'
import { spellforgeResultToRating } from '@/lib/srs/rating-mapper'
import {
  cacheCard,
  getCachedCard,
  pushPendingResult,
} from '@/lib/srs/session-storage'
import { cardToUpdatePayload } from '@/lib/srs/supabase-adapter'
import type { Phase, SpellForgeWord } from '@/types/spellforge'

interface SpellForgeProps {
  textId: string
  textTitle: string
  words: SpellForgeWord[]
  /** 닫기/완료 시 복귀 경로 — 페이지가 ?from/스코프로 계산 (textId 는 세션 키라 링크에 부적합). */
  backHref: string
}

const SUCCESS_MESSAGES = [
  { icon: '✨', message: '완벽해요!' },
  { icon: '🎯', message: '정확하게 맞췄어요.' },
  { icon: '🌱', message: '손가락이 단어를 기억하고 있어요.' },
  { icon: '💫', message: '한 단어가 마음에 새겨졌어요.' },
  { icon: '🏆', message: '스펠링 마스터.' },
]

export function SpellForge({ textId, textTitle, words, backHref }: SpellForgeProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Hooks
  const { mode, setMode } = useTypingMode()
  const { imeStatus, checkInput } = useIMEDetection()
  const { result, confirm, reset: resetFeedback } = useDelayedFeedback()
  const { isHintActive, hintCount, triggerHint, resetHints } = useActiveHint(() => {
    setUserInput('')
    if (inputRef.current) inputRef.current.value = ''
  })
  const { session, currentWord, recordRating, nextWord, skipWord, isComplete } =
    useSpellForgeSession({ textId, words })

  // Local state
  const [userInput, setUserInput] = useState('')
  const [phase, setPhase] = useState<Phase>('typing')
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [showLength, setShowLength] = useState(false)
  const [pauseInfo, setPauseInfo] = useState<{ icon: string; message: string } | null>(null)
  const [reflectionMsg, setReflectionMsg] = useState('')
  const [showCompletion, setShowCompletion] = useState(false)
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null)

  // §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후) — 실 사용자 상태 기반 (decide P1~P4)
  const recommendation = useNextAction()

  // body class for studying mode
  useEffect(() => {
    document.body.classList.add('studying')
    return () => document.body.classList.remove('studying')
  }, [])

  // 세션 종료 시 SRS 큐 → DB flush (멱등 가드, 1회).
  const flushedRef = useRef(false)
  useEffect(() => {
    if (showCompletion && !flushedRef.current) {
      flushedRef.current = true
      void flushPendingSession()
    }
  }, [showCompletion])

  // 모드 변경 시 reset
  useEffect(() => {
    setUserInput('')
    if (inputRef.current) inputRef.current.value = ''
    resetFeedback()
    resetHints()
    setPhase('typing')
    setReflectionMsg('')
    inputRef.current?.focus()
  }, [mode, resetFeedback, resetHints])

  // 단어 변경 시 reset
  useEffect(() => {
    setUserInput('')
    if (inputRef.current) inputRef.current.value = ''
    resetFeedback()
    resetHints()
    setPhase('typing')
    setReflectionMsg('')
  }, [currentWord?.id, resetFeedback, resetHints])

  /**
   * 입력 변경
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const sanitized = checkInput(e.target.value)
      e.target.value = sanitized

      const value = sanitized.toLowerCase()
      setUserInput(value)

      // Realtime 모드 — 즉시 평가
      if (mode === 'realtime' && currentWord && value === currentWord.text.toLowerCase()) {
        handleSuccess()
      }
    },
    [mode, currentWord, checkInput]
  )

  /**
   * 정답 처리
   */
  const handleSuccess = useCallback(() => {
    if (!currentWord) return

    setPhase('success')

    // 발음 자동 재생
    setTimeout(() => playWordAudio(currentWord.text), 200)

    // §17 [4] 기억 축 — FSRS applyReview (L4b 시각 생성)
    // sessionStorage 캐시 사용 — DB 연동 시 vocabularies 조회로 교체
    const errorsCount = result?.errorPositions.length ?? 0
    const existingCard = getCachedCard(currentWord.id) ?? createNewCard(currentWord.id)
    const reviewResult = applyReview({
      card: existingCard,
      rating: spellforgeResultToRating({
        finalCorrect: true,
        hintsUsed: hintCount,
        errors: errorsCount,
      }),
      reviewedAt: new Date(),
      module: 'spellforge',
    })
    cacheCard(reviewResult.card)
    pushPendingResult({
      cardId: reviewResult.card.id,
      word: currentWord.text,
      cardUpdate: cardToUpdatePayload(reviewResult.card),
      rating: reviewResult.log.rating,
      reviewedAt: reviewResult.log.reviewedAt.toISOString(),
      module: 'spellforge',
    })

    // Rating 기록 (UI 통계용 — 그대로 유지)
    recordRating({
      wordId: currentWord.id,
      attempts: 1,
      errors: errorsCount,
      hintsUsed: hintCount,
      finalCorrect: true,
      timeSpentMs: Date.now() - session.startedAt.getTime(),
    })

    // Micro-pause
    setTimeout(() => {
      const msg = SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)]
      setPauseInfo(msg)
      setPhase('paused')
    }, 800)
  }, [currentWord, hintCount, recordRating, result?.errorPositions.length, session.startedAt])

  /**
   * Confirm Answer (Delayed/Blind 모드)
   */
  const handleConfirm = useCallback(() => {
    if (!currentWord || userInput.length === 0) return
    if (mode === 'realtime') return

    const evalResult = confirm(userInput, currentWord.text)

    if (evalResult.correct) {
      handleSuccess()
    } else {
      handleError(evalResult)
    }
  }, [currentWord, userInput, mode, confirm, handleSuccess])

  /**
   * 오답 처리 + Reflection
   */
  const handleError = useCallback(
    (evalResult: ReturnType<typeof evaluateInput>) => {
      setPhase('error')
      setReflectionMsg(generateReflectionMessage(evalResult))

      // 3초 후 reset
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
      errorTimerRef.current = setTimeout(() => {
        setUserInput('')
        if (inputRef.current) inputRef.current.value = ''
        resetFeedback()
        setReflectionMsg('')
        setPhase('typing')
        inputRef.current?.focus()
      }, 3000)
    },
    [resetFeedback]
  )

  /**
   * Pause → 다음 단어
   * 마지막 단어(isComplete) 처리 직후엔 nextWord 호출 대신 완료 화면으로 전환
   */
  const handlePauseSkip = useCallback(() => {
    setPauseInfo(null)
    setPhase('typing')
    if (isComplete) {
      setShowCompletion(true)
      return
    }
    nextWord()
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [isComplete, nextWord])

  /**
   * 발음 재생
   */
  const playWordAudio = useCallback(
    (word: string) => {
      if (isAudioPlaying || typeof window === 'undefined') return
      if (!('speechSynthesis' in window)) return

      setIsAudioPlaying(true)
      const utterance = new SpeechSynthesisUtterance(word)
      utterance.lang = 'en-US'
      utterance.rate = 0.85
      utterance.onend = () => setIsAudioPlaying(false)
      window.speechSynthesis.speak(utterance)
    },
    [isAudioPlaying]
  )

  /**
   * 단어 건너뛰기
   */
  const handleSkip = useCallback(() => {
    if (!currentWord) return
    if (window.confirm('이 단어를 건너뛸까요? 다음에 다시 만나게 됩니다.')) {
      // §17 [4] 기억 축 — FSRS applyReview (오답 처리, Again rating)
      const existingCard = getCachedCard(currentWord.id) ?? createNewCard(currentWord.id)
      const reviewResult = applyReview({
        card: existingCard,
        rating: spellforgeResultToRating({
          finalCorrect: false,
          hintsUsed: hintCount,
          errors: 0,
        }),
        reviewedAt: new Date(),
        module: 'spellforge',
      })
      cacheCard(reviewResult.card)
      pushPendingResult({
        cardId: reviewResult.card.id,
        word: currentWord.text,
        cardUpdate: cardToUpdatePayload(reviewResult.card),
        rating: reviewResult.log.rating,
        reviewedAt: reviewResult.log.reviewedAt.toISOString(),
        module: 'spellforge',
      })

      recordRating({
        wordId: currentWord.id,
        attempts: 0,
        errors: 0,
        hintsUsed: hintCount,
        finalCorrect: false,
        timeSpentMs: 0,
      })
      skipWord()
    }
  }, [currentWord, hintCount, recordRating, skipWord])

  /**
   * Keyboard
   */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTextInput = target.tagName === 'TEXTAREA'
      if (isTextInput) return

      // Tab — 힌트
      if (e.key === 'Tab') {
        e.preventDefault()
        triggerHint()
        playWordAudio(currentWord?.text ?? '')
        return
      }

      // Enter — Confirm
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (mode === 'delayed' || mode === 'blind') {
          handleConfirm()
        }
        return
      }

      // Esc — Skip
      if (e.key === 'Escape') {
        e.preventDefault()
        handleSkip()
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [mode, currentWord, triggerHint, handleConfirm, handleSkip, playWordAudio])

  // 자동 포커스
  useEffect(() => {
    inputRef.current?.focus()
    const onFocus = () => inputRef.current?.focus()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  if (!currentWord) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-body text-[var(--t3)]">학습할 단어가 없어요.</p>
      </div>
    )
  }

  if (showCompletion) {
    return (
      <SpellForgeCompletion
        totalWords={session.words.length}
        correctCount={session.totalCorrect}
        startedAt={session.startedAt}
        backHref={backHref}
        recommendation={recommendation}
      />
    )
  }

  // 정확도 계산
  const sessionAccuracy =
    session.totalAttempts > 0
      ? Math.round((session.totalCorrect / session.totalAttempts) * 100)
      : 100

  return (
    <div className="flex min-h-screen flex-col bg-[var(--reading-bg)]">
      {/* IME Indicator (좌상단 fixed) */}
      <div className="fixed left-[260px] top-4 z-[55]">
        <IMEIndicator status={imeStatus} />
      </div>

      {/* 닫기 — 학습하던 스크립트로 복귀 (우상단 fixed) */}
      <Link
        href={backHref}
        aria-label="스펠 닫기 — 스크립트로 돌아가기"
        title="스크립트로 돌아가기"
        className="fixed right-4 top-4 z-[55] inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] text-[var(--t2)] transition-colors hover:bg-[var(--error-light)] hover:text-[var(--error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        <X size={18} strokeWidth={2} aria-hidden />
      </Link>

      {/* Word Stage */}
      <section className="flex flex-1 flex-col items-center justify-center px-8 py-8">
        <div className="flex w-full max-w-[720px] flex-col items-center">
          <MeaningDisplay
            meaning={currentWord.meaning}
            pos={currentWord.pos || 'Word'}
            pronunciation={currentWord.pronunciation}
            source={`${textTitle} · Chapter 1`}
            onPlayAudio={() => playWordAudio(currentWord.text)}
            isPlaying={isAudioPlaying}
          />

          <ModeSelector mode={mode} onChange={setMode} />

          {/* Input Area */}
          <div
            className="relative mb-4 flex w-full flex-col items-center"
            onClick={() => inputRef.current?.focus()}
          >
            {/* Hidden Input */}
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={handleInputChange}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="absolute inset-0 h-full w-full cursor-text border-none bg-transparent text-[16px] opacity-0 outline-none"
              style={{ caretColor: 'transparent' }}
              aria-label="단어 입력"
            />

            {/* Slots or Single Box */}
            {(mode === 'realtime' || mode === 'delayed') && (
              <InputSlots
                target={currentWord.text}
                input={userInput}
                mode={mode}
                isHintActive={isHintActive}
                isSuccess={phase === 'success'}
              />
            )}

            {mode === 'blind' && (
              <SingleBox
                input={userInput}
                showLength={showLength}
                targetLength={currentWord.text.length}
                isSuccess={phase === 'success'}
                isError={phase === 'error'}
                revealValue={
                  phase === 'success' ? currentWord.text : phase === 'error' ? userInput : undefined
                }
              />
            )}
          </div>

          {/* Confirm Button */}
          <ConfirmButton
            visible={mode === 'delayed' || mode === 'blind'}
            disabled={userInput.length === 0 || phase === 'success'}
            onClick={handleConfirm}
          />

          {/* Reflection */}
          <ReflectionHint
            visible={phase === 'error' && reflectionMsg.length > 0}
            message={reflectionMsg}
          />

          {/* Example */}
          {currentWord.exampleSentence && (
            <div className="relative mt-6 w-full rounded-r-[var(--r-md)] border-l-[3px] border-[var(--p)] bg-gradient-to-br from-[var(--p-light)] to-[var(--bg2)] px-5 py-4 font-english text-[15px] italic leading-relaxed text-[var(--t1)]">
              {currentWord.exampleSentence}
              <span className="mt-2 block font-body text-[11px] not-italic text-[var(--t3)]">
                — {textTitle}
              </span>
            </div>
          )}

          {/* Feedback Strip */}
          <div className="mt-4 flex w-full items-center justify-center gap-5 py-2 font-mono text-[11px] text-[var(--t3)] opacity-40 transition-opacity duration-[var(--dur-normal)] hover:opacity-100">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-[9px] font-[700] uppercase tracking-[0.08em]">
                정확도
              </span>
              <strong className="font-[700] text-[var(--t1)]">{sessionAccuracy}%</strong>
            </div>
            <span className="h-3 w-px bg-[var(--bd)]" />
            <div className="flex items-center gap-1.5">
              <span className="font-display text-[9px] font-[700] uppercase tracking-[0.08em]">
                힌트
              </span>
              <strong className="font-[700] text-[var(--t1)]">{hintCount}</strong>
            </div>
            <span className="h-3 w-px bg-[var(--bd)]" />
            <div className="flex items-center gap-1.5">
              <span className="font-display text-[9px] font-[700] uppercase tracking-[0.08em]">
                진행
              </span>
              <strong className="font-[700] text-[var(--t1)]">
                {session.currentIdx + 1} / {session.words.length}
              </strong>
            </div>
          </div>
        </div>

        {/* Hint Bar */}
        <div className="mt-3 flex w-full max-w-[720px] items-center justify-center gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] px-6 py-3.5">
          <button
            onClick={triggerHint}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3.5 py-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:-translate-y-px hover:border-[var(--p)] hover:bg-[var(--bg)] hover:text-[var(--t1)]"
          >
            <kbd className="rounded border border-[var(--bd)] bg-[var(--bg)] px-1 py-0.5 font-mono text-[9px] font-[700] text-[var(--t3)]">
              Tab
            </kbd>
            <span>힌트 (잠깐 보기)</span>
          </button>

          {mode === 'blind' && (
            <button
              onClick={() => setShowLength((s) => !s)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3.5 py-2 font-display text-[11px] font-[600] text-[var(--t3)] transition-all duration-[var(--dur-normal)] hover:-translate-y-px hover:border-[var(--p)] hover:bg-[var(--bg)] hover:text-[var(--t1)]"
            >
              {showLength ? '글자 수 가리기' : '글자 수 보기'}
            </button>
          )}

          <button
            onClick={handleSkip}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-3.5 py-2 font-display text-[12px] font-[600] text-[var(--t3)] transition-all duration-[var(--dur-normal)] hover:-translate-y-px hover:border-solid hover:border-[var(--t3)] hover:bg-[var(--bg)] hover:text-[var(--t1)]"
          >
            <kbd className="rounded border border-[var(--bd)] bg-[var(--bg)] px-1 py-0.5 font-mono text-[9px] font-[700] text-[var(--t3)]">
              Esc
            </kbd>
            <span>건너뛰기</span>
          </button>
        </div>
      </section>

      {/* Micro-Pause */}
      {pauseInfo && (
        <MicroPause
          visible={phase === 'paused'}
          icon={pauseInfo.icon}
          message={pauseInfo.message}
          currentIdx={session.currentIdx}
          totalCount={session.words.length}
          accuracy={sessionAccuracy}
          onSkip={handlePauseSkip}
        />
      )}
    </div>
  )
}
