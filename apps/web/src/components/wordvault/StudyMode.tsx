// apps/web/src/components/wordvault/StudyMode.tsx
// 학습 모드 — 큰 카드 + Active Recall + 1-5 평가

'use client'

import { cn } from '@/lib/utils/cn'
import Link from 'next/link'
import { Eye, FileText, Settings as SettingsIcon, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { applyReview, createNewCard } from '@/lib/srs'
import { studyRatingToFsrs } from '@/lib/srs/rating-mapper'
import { cacheCard, getCachedCard, pushPendingResult } from '@/lib/srs/session-storage'
import { cardToUpdatePayload } from '@/lib/srs/supabase-adapter'
import { flushPendingSession } from '@/lib/srs/flush-session'
import { useSrsFlushOnLeave } from '@/hooks/useSrsFlushOnLeave'
import { useSpeech } from './hooks/useSpeech'
import type { StudyState, WordItem } from './types'

export interface StudyModeProps {
  /** 학습할 단어 목록 */
  words: WordItem[]
  /**
   * 세션이 끝났다.
   *
   * `completed` = 마지막 단어까지 평가했다 · `aborted` = 중간에 나갔다.
   * 둘을 가르지 않으면 **다 끝낸 사람도 곧바로 허브로 튕긴다** — 무엇을 했는지
   * 확인할 자리도, 다음 한 걸음도 없이(실측 2026-09-05).
   */
  onExit: (reason: 'completed' | 'aborted') => void
}

interface RatingConfig {
  rate: 1 | 2 | 3 | 4 | 5
  label: string
  srs: string
  className: string
}

// 간격반복 자기평가 5단. Again/Hard/Easy 는 SRS 에서 통용되는 말이라 학습자가 다른 앱에서
// 이미 만났을 가능성이 높다 — 굳이 새 말을 만들지 않는다. 3단은 Again~Hard 사이라 Fair.
// srs 는 다음 복습까지의 간격 힌트다(버튼 아래 작은 글씨).
const RATINGS: RatingConfig[] = [
  { rate: 1, label: 'Again', srs: '10 min', className: 'rate-1' },
  { rate: 2, label: 'Hard', srs: '1 day', className: 'rate-2' },
  { rate: 3, label: 'Fair', srs: '3 days', className: 'rate-3' },
  { rate: 4, label: 'Easy', srs: '7 days', className: 'rate-4' },
  { rate: 5, label: 'Perfect', srs: '14 days', className: 'rate-5' },
]

export function StudyMode({ words, onExit }: StudyModeProps) {
  const [studyIndex, setStudyIndex] = useState(0)
  const [state, setState] = useState<StudyState>('hidden')
  const [isPlayingMain, setIsPlayingMain] = useState(false)

  const { speak } = useSpeech()
  const w = words[studyIndex]
  const progress = words.length > 0 ? Math.round((studyIndex / words.length) * 100) : 0

  // **화면 안의 "← 종료" 를 안 눌러도** 평가가 남는다 — 이 화면은 풀스크린이 아니라
  // 사이드바 링크·뒤로가기·새로고침으로 나가는 경로가 오히려 흔하고, 그 경로들은
  // `finish()` 를 지나지 않는다(실측 2026-09-05).
  useSrsFlushOnLeave()

  // 세션 종료(또는 마지막 단어 완료) 시 SRS 큐 → DB flush (멱등 가드, 1회)
  const flushedRef = useRef(false)
  const finish = useCallback(
    (reason: 'completed' | 'aborted') => {
      if (!flushedRef.current) {
        flushedRef.current = true
        void flushPendingSession()
      }
      onExit(reason)
    },
    [onExit],
  )

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
        finish('completed') // 마지막 단어 평가 → 큐 flush + 완료 화면
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

  /*
    ⚠️ 「따라말하기」 마이크 버튼이 여기 있었다 — **아무것도 녹음하지 않았다.**
       누르면 2초 동안 빨갛게 깜빡이다 스스로 꺼지는 표시등이었고(`setTimeout` 데모),
       'm' 키까지 배정돼 있었다. 학습자는 자기 발음이 기록·비교된다고 믿는다.

       발음을 실제로 듣고 비교하는 모듈은 이미 따로 있다 — EchoMatch(`/text/[id]/echo`,
       `pitchfinder` + DTW). 단어 단위 녹음 경로는 이 저장소에 없다.
       그래서 흉내 내는 버튼을 없앤다. 없는 기능을 있는 것처럼 두는 쪽이 더 나쁘다.
       (되살리려면 EchoMatch 의 마이크 권한·해제 경로를 그대로 써야 한다 —
        `components/echo/MicPermissionGate.tsx`.)
  */

  // 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return

      if (e.code === 'Space') {
        e.preventDefault()
        if (state === 'hidden') revealMeaning()
        else if (state === 'meaning-shown') revealExample()
        else playMain()
      } else if (['1', '2', '3', '4', '5'].includes(e.key) && state === 'example-shown') {
        rateWord(parseInt(e.key) as 1 | 2 | 3 | 4 | 5)
      } else if (e.key === 'Escape') {
        finish('aborted')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, revealMeaning, revealExample, playMain, rateWord, finish])

  if (!w) return null

  return (
    <div className="mx-auto max-w-[680px] px-s-4 py-s-2">
      {/* 상단 바 */}
      <div className="mb-s-6 flex items-center justify-between rounded-xl border border-bd bg-bg px-s-5 py-s-3">
        <button
          type="button"
          onClick={() => finish('aborted')}
          /* 66×36 이었다 — 44px 미만 탭 대상이었다(CLAUDE.md 절대 금지 · 실측 390px). 세로만 늘려 줄 배치는 그대로 둔다. */
          className="py-s-2 inline-flex min-h-[44px] items-center gap-s-2 rounded-md px-s-3 font-display text-[13px] font-semibold text-t2 transition-all duration-fast hover:bg-bg2 hover:text-t1"
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

        {/* 아무 동작도 없는 장식 버튼이었다 — 이제 실제 설정 화면으로 간다.
            (음성·모션·학습 흐름이 그 화면에서 기기에 저장된다: lib/settings/device-prefs.ts)
            36×36 이었던 탭 대상은 44px 로 이미 올려 뒀다(CLAUDE.md 절대 금지 · 실측 390px). */}
        <Link
          href="/settings#audio"
          className="flex h-11 w-11 items-center justify-center rounded-md text-t2 transition-all duration-fast hover:bg-bg2 hover:text-t1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-bg2"
          aria-label="학습 설정 열기"
        >
          <SettingsIcon size={14} />
        </Link>
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
              <div className="mt-px hidden font-mono text-[9px] font-medium text-t3 sm:block">
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
      /* 178×32 였다 — 44px 미만 탭 대상이었다(CLAUDE.md 절대 금지 · 실측 390px). 학습 중 가장 자주 누르는 버튼이다. */
      className="py-s-3.5 min-h-[44px] border-bd-strong hover:bg-learn-fresh-light hover:border-learn-fresh hover:text-learn-fresh group inline-flex items-center gap-s-3 rounded-xl border-[1.5px] border-dashed bg-bg2 px-s-6 font-display text-sm font-semibold tracking-[-0.01em] text-t2 transition-all duration-fast hover:-translate-y-px hover:shadow-sm"
    >
      <span className="flex items-center gap-s-2">
        {icon}
        <span>{label}</span>
      </span>
      <kbd className="px-s-2 group-hover:bg-learn-fresh group-hover:border-learn-fresh rounded-[4px] border border-bd bg-bg py-[4px] font-mono text-[11px] font-bold text-t3 transition-colors duration-fast group-hover:text-white">
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
          {i > 0 && <span className="text-t3">{sep}</span>}
          <kbd className="px-s-2 inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-[4px] border border-bd bg-bg2 font-mono text-[10px] font-bold text-t2">
            {k}
          </kbd>
        </span>
      ))}
      <span className="ml-s-1">{label}</span>
    </div>
  )
}
