// apps/web/src/components/wordvault/StudyMode.tsx
// 학습 모드 — 큰 카드 + Active Recall + 1-5 평가

'use client'

import { cn } from '@/lib/utils/cn'
import { Eye, FileText, Mic, Settings as SettingsIcon, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { applyReview, createNewCard } from '@/lib/srs'
import { studyRatingToFsrs } from '@/lib/srs/rating-mapper'
import { cacheCard, getCachedCard, pushPendingResult } from '@/lib/srs/session-storage'
import { cardToUpdatePayload } from '@/lib/srs/supabase-adapter'
import { flushPendingSession } from '@/lib/srs/flush-session'
import { useSpeech } from './hooks/useSpeech'
import type { StudyState, WordItem } from './types'

export interface StudyModeProps {
  /** 학습할 단어 목록 */
  words: WordItem[]
  /** 종료 콜백 */
  onExit: () => void
}

interface RatingConfig {
  rate: 1 | 2 | 3 | 4 | 5
  label: string
  srs: string
  className: string
}

const RATINGS: RatingConfig[] = [
  { rate: 1, label: '다시', srs: '10분 후', className: 'rate-1' },
  { rate: 2, label: '어려움', srs: '1일 후', className: 'rate-2' },
  { rate: 3, label: '애매', srs: '3일 후', className: 'rate-3' },
  { rate: 4, label: '쉬움', srs: '7일 후', className: 'rate-4' },
  { rate: 5, label: '완벽', srs: '14일 후', className: 'rate-5' },
]

export function StudyMode({ words, onExit }: StudyModeProps) {
  const [studyIndex, setStudyIndex] = useState(0)
  const [state, setState] = useState<StudyState>('hidden')
  const [isMicRecording, setIsMicRecording] = useState(false)
  const [isPlayingMain, setIsPlayingMain] = useState(false)

  const { speak } = useSpeech()
  const w = words[studyIndex]
  const progress = words.length > 0 ? Math.round((studyIndex / words.length) * 100) : 0

  // 세션 종료(또는 마지막 단어 완료) 시 SRS 큐 → DB flush (멱등 가드, 1회)
  const flushedRef = useRef(false)
  const finish = useCallback(() => {
    if (!flushedRef.current) {
      flushedRef.current = true
      void flushPendingSession()
    }
    onExit()
  }, [onExit])

  const reset = useCallback(() => {
    setState('hidden')
  }, [])

  // 화면 진입 시 초기화
  useEffect(() => {
    reset()
  }, [reset])

  const revealMeaning = useCallback(() => {
    setState((prev) => {
      if (prev === 'hidden') return 'meaning-shown'
      if (prev === 'meaning-shown') return 'example-shown'
      return prev
    })
  }, [])

  const revealExample = useCallback(() => {
    setState('example-shown')
  }, [])

  const rateWord = useCallback(
    (rate: 1 | 2 | 3 | 4 | 5) => {
      if (w) {
        // §17 [4] 기억 축 — FSRS applyReview (자가평가 1~5 → Rating). 세션 캐시는 단어 텍스트 키.
        const key = w.word.toLowerCase()
        const existingCard = getCachedCard(key) ?? createNewCard(key)
        const reviewResult = applyReview({
          card: existingCard,
          rating: studyRatingToFsrs(rate),
          reviewedAt: new Date(),
          module: 'wordvault',
        })
        cacheCard(reviewResult.card)
        pushPendingResult({
          cardId: reviewResult.card.id,
          word: w.word,
          cardUpdate: cardToUpdatePayload(reviewResult.card),
          rating: reviewResult.log.rating,
          reviewedAt: reviewResult.log.reviewedAt.toISOString(),
          module: 'wordvault',
        })
      }

      const next = studyIndex + 1
      if (next >= words.length) {
        finish() // 마지막 단어 평가 → 큐 flush + 종료
        return
      }
      setStudyIndex(next)
      setState('hidden')
    },
    [w, studyIndex, words.length, finish]
  )

  const playMain = useCallback(() => {
    if (!w) return
    setIsPlayingMain(true)
    speak(w.word, {
      rate: 1.0,
      onEnd: () => setIsPlayingMain(false),
    })
  }, [w, speak])

  const playSlow = useCallback(() => {
    if (!w) return
    speak(w.word, { rate: 0.6 })
  }, [w, speak])

  const toggleMic = useCallback(() => {
    setIsMicRecording((prev) => {
      if (prev) return false
      // 데모 — 2초 후 자동 종료
      setTimeout(() => setIsMicRecording(false), 2000)
      return true
    })
  }, [])

  // 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return

      if (e.code === 'Space') {
        e.preventDefault()
        if (state === 'hidden') revealMeaning()
        else if (state === 'meaning-shown') revealExample()
        else playMain()
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMic()
      } else if (['1', '2', '3', '4', '5'].includes(e.key) && state === 'example-shown') {
        rateWord(parseInt(e.key) as 1 | 2 | 3 | 4 | 5)
      } else if (e.key === 'Escape') {
        finish()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, revealMeaning, revealExample, playMain, toggleMic, rateWord, finish])

  if (!w) return null

  return (
    <div className="mx-auto max-w-[680px] px-s-4 py-s-2">
      {/* 상단 바 */}
      <div className="mb-s-6 flex items-center justify-between rounded-xl border border-bd bg-bg px-s-5 py-s-3">
        <button
          type="button"
          onClick={finish}
          className="py-s-1.5 inline-flex items-center gap-s-2 rounded-md px-s-3 font-display text-[13px] font-semibold text-t2 transition-all duration-fast hover:bg-bg2 hover:text-t1"
        >
          ← 종료
        </button>

        <div className="mx-s-5 flex flex-1 items-center gap-s-3">
          <div className="h-[6px] flex-1 overflow-hidden rounded-[3px] bg-bg2">
            <div
              className="h-full rounded-[3px] shadow-[0_0_6px_rgba(59,130,246,0.3)] transition-all duration-slow"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--learn-fresh), var(--learn-mastered))',
              }}
            />
          </div>
          <span className="whitespace-nowrap font-mono text-xs font-bold tabular-nums text-t1">
            {studyIndex + 1} / {words.length}
          </span>
        </div>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-md text-t2 transition-all duration-fast hover:bg-bg2 hover:text-t1"
          aria-label="설정"
        >
          <SettingsIcon size={14} />
        </button>
      </div>

      {/* 학습 카드 */}
      <div className="relative mb-s-5 flex min-h-[520px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-bd bg-bg px-s-12 py-s-16 text-center shadow-md">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-[100px] -top-[100px] h-[300px] w-[300px] rounded-full opacity-[0.04]"
          style={{
            background: 'radial-gradient(circle, var(--learn-fresh) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* 단어 (★ L1) */}
        <div className="relative mb-s-4 font-serif text-[64px] font-bold leading-[1.05] tracking-[-0.025em] text-t1 sm:text-[44px]">
          {w.word}
        </div>

        <div className="mb-s-8 flex justify-center gap-s-2">
          <span className="rounded-sm bg-bg2 px-s-3 py-s-1 font-mono text-xs font-semibold text-t2">
            {w.pos}
          </span>
          <span
            className={cn(
              'rounded-sm px-s-3 py-s-1 font-mono text-xs font-bold',
              `bg-level-${w.levelClass}-light text-level-${w.levelClass}`
            )}
          >
            {w.level}
          </span>
        </div>

        {/* 음성 버튼 */}
        <div className="mb-s-8 flex justify-center gap-s-3">
          <button
            type="button"
            onClick={playSlow}
            aria-label="천천히"
            className="flex h-[60px] w-[60px] items-center justify-center rounded-xl border-[1.5px] border-bd bg-bg text-t2 transition-all duration-fast hover:-translate-y-0.5 hover:bg-bg2 hover:text-t1 hover:shadow-md"
          >
            <span className="text-[20px]">🐢</span>
          </button>
          <button
            type="button"
            onClick={playMain}
            aria-label="재생"
            className={cn(
              'h-[60px] w-[60px] rounded-xl',
              'bg-learn-fresh border-learn-fresh border-[1.5px] text-white',
              'flex items-center justify-center',
              'transition-all duration-fast',
              'hover:-translate-y-1 hover:bg-[#2563EB] hover:shadow-lg',
              'shadow-[0_4px_14px_rgba(59,130,246,0.3)]',
              isPlayingMain && 'animate-[audio-glow_1.2s_ease-in-out_infinite]'
            )}
          >
            <Volume2 size={20} />
          </button>
          <button
            type="button"
            onClick={toggleMic}
            aria-label="따라말하기"
            className={cn(
              'h-[60px] w-[60px] rounded-xl border-[1.5px]',
              'flex items-center justify-center',
              'transition-all duration-fast',
              isMicRecording
                ? 'bg-learn-error border-learn-error animate-[mic-glow_1s_ease-in-out_infinite] text-white'
                : 'border-bd bg-bg text-t2 hover:-translate-y-0.5 hover:bg-bg2 hover:text-t1 hover:shadow-md'
            )}
          >
            <Mic size={20} />
          </button>
        </div>

        {/* Reveal Area */}
        <div className="mb-s-6 flex min-h-[140px] w-full flex-col items-center justify-center">
          {state === 'hidden' && (
            <RevealPrompt
              icon={<Eye size={14} />}
              label="뜻 보기"
              shortcut="Space"
              onClick={revealMeaning}
            />
          )}

          {state === 'meaning-shown' && (
            <div className="w-full animate-[revealIn_320ms_cubic-bezier(0,0,.2,1)]">
              <div className="mb-s-4 font-body text-[24px] font-bold leading-[1.35] tracking-[-0.015em] text-t1">
                {w.meaning}
              </div>
              <RevealPrompt
                icon={<FileText size={14} />}
                label="예문 보기"
                shortcut="Space"
                onClick={revealExample}
              />
            </div>
          )}

          {state === 'example-shown' && (
            <div className="w-full animate-[revealIn_320ms_cubic-bezier(0,0,.2,1)]">
              <div className="mb-s-4 font-body text-[24px] font-bold leading-[1.35] tracking-[-0.015em] text-t1">
                {w.meaning}
              </div>
              <div className="border-learn-fresh rounded-xl border-l-[3px] bg-bg2 px-s-5 py-s-4 text-left">
                <div
                  className={cn(
                    'font-serif text-base font-medium italic text-t1',
                    'leading-[1.7] tracking-[0.005em]',
                    'before:text-learn-fresh before:mr-[2px] before:text-[22px] before:content-["\\201C"]',
                    'after:text-learn-fresh after:ml-[2px] after:text-[22px] after:content-["\\201D"]'
                  )}
                >
                  {w.exampleEn}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 평가 (예문 공개 후) */}
      {state === 'example-shown' && (
        <div className="mb-s-4 grid grid-cols-5 gap-s-2">
          {RATINGS.map((r) => (
            <button
              key={r.rate}
              type="button"
              onClick={() => rateWord(r.rate)}
              className={cn(
                'rounded-xl border-[1.5px] border-bd bg-bg px-s-2 py-s-4 text-center',
                'transition-all duration-fast hover:-translate-y-1 hover:shadow-md',
                r.rate === 1 && 'hover:border-learn-error hover:bg-learn-error-light',
                r.rate === 2 && 'hover:border-learn-review hover:bg-learn-review-light',
                r.rate === 3 && 'hover:border-learn-fresh hover:bg-learn-fresh-light',
                r.rate === 4 && 'hover:border-learn-progress hover:bg-learn-progress-light',
                r.rate === 5 && 'hover:border-learn-known hover:bg-learn-known-light'
              )}
            >
              <div className="mb-s-1 font-mono text-sm font-bold text-t3">{r.rate}</div>
              <div className="font-display text-xs font-bold tracking-[-0.01em] text-t1">
                {r.label}
              </div>
              <div className="mt-px hidden font-mono text-[9px] font-medium text-t4 sm:block">
                {r.srs}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 단축키 안내 */}
      <div className="flex flex-wrap justify-center gap-s-4 font-display text-[11px] font-medium text-t3">
        <Shortcut keys={['Space']} label="공개/재생" />
        <Shortcut keys={['M']} label="마이크" />
        <Shortcut keys={['1', '2', '3', '4', '5']} label="평가" sep="~" />
        <Shortcut keys={['Esc']} label="종료" />
      </div>
    </div>
  )
}

// ─── 보조 컴포넌트 ───
function RevealPrompt({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  shortcut: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="py-s-3.5 border-bd-strong hover:bg-learn-fresh-light hover:border-learn-fresh hover:text-learn-fresh group inline-flex items-center gap-s-3 rounded-xl border-[1.5px] border-dashed bg-bg2 px-s-6 font-display text-sm font-semibold tracking-[-0.01em] text-t2 transition-all duration-fast hover:-translate-y-px hover:shadow-sm"
    >
      <span className="flex items-center gap-s-2">
        {icon}
        <span>{label}</span>
      </span>
      <kbd className="px-s-1.5 group-hover:bg-learn-fresh group-hover:border-learn-fresh rounded-[4px] border border-bd bg-bg py-[3px] font-mono text-[11px] font-bold text-t3 transition-colors duration-fast group-hover:text-white">
        {shortcut}
      </kbd>
    </button>
  )
}

function Shortcut({ keys, label, sep = '+' }: { keys: string[]; label: string; sep?: string }) {
  return (
    <div className="flex items-center gap-s-1">
      {keys.map((k, i) => (
        <span key={k} className="flex items-center gap-s-1">
          {i > 0 && <span className="text-t4">{sep}</span>}
          <kbd className="px-s-1.5 inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-[4px] border border-bd bg-bg2 font-mono text-[10px] font-bold text-t2">
            {k}
          </kbd>
        </span>
      ))}
      <span className="ml-s-1">{label}</span>
    </div>
  )
}
