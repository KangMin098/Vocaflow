// apps/web/src/components/dictation/DictationSessionClient.tsx
// Dictation Session — 메인 받아쓰기 화면
//
// 학습 과학:
//   · Spaced Dictation — 자동 반복 + 구간 사이 무음
//   · Active Recall — 단어별 즉각 채점
//   · Scaffolding — 4단계 힌트
//   · Flow State — Focus Mode (사이드바 dim)
//   · Context-Dependent Retrieval — 문장 안의 내 단어(타깃) 인출
//
// v07 — 타깃 단어 노출 규칙 (중요):
//   제출 **전에는 어떤 단어가 타깃인지 절대 보여주지 않는다**. 단어를 알려주면
//   받아쓰기가 아니라 빈칸 채우기가 된다. 대신 "내 단어 2개가 들어 있어요"라는 개수만
//   알려 주의를 모으고(Cognitive Load 를 늘리지 않는 범위), 정답 공개 후에 어떤 단어를
//   잡았는지 보여준다 — 그때가 그 단어가 기억에 붙는 순간이다.
//
// 키보드 단축키 (입력창 밖에 포커스가 있을 때):
//   Space  재생/정지 · 1-5 속도 · F Focus
// 입력창 안에서도: Enter 제출(피드백 중이면 다음) · Esc 정지
//
// ⚠️ **Tab 을 가로채지 않는다.** 예전엔 Tab = 건너뛰기였는데, 그러면 키보드 사용자가
//    포커스를 옮길 수가 없고(2.1.1 Keyboard · 2.1.2 No Keyboard Trap) 옮기려는 시도가
//    **문항을 건너뛰는 되돌릴 수 없는 조작**이 됐다. 건너뛰기는 버튼으로만 한다.
//    같은 이유로 버튼·링크에 포커스가 있을 때는 Space 도 가로채지 않는다 —
//    가로채면 포커스한 버튼을 키보드로 누를 수 없다.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  Download,
  Eye,
  EyeOff,
  Focus,
  Lightbulb,
  Play,
  Pause,
  RotateCw,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react'

import { useSessionProgress, type SessionResourceType } from '@/components/layout/SessionFrame'
import { useAudioControl } from '@/hooks/dictation/useAudioControl'
import { useDictationSession, type SubmitOutcome } from '@/hooks/dictation/useDictationSession'
import { HINT_STAGES, type HintLevel } from '@/lib/dictation/hint'
import type { WordResult } from '@/lib/dictation/types'

const DICTATION_ACCENT = '#0EA5E9'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2'

/** DB source_kind → SessionFrame 리소스 타입 */
const RESOURCE_TYPE: Record<string, SessionResourceType> = {
  book: 'library',
  text: 'script',
  set: 'library',
  daily: 'script',
  custom: 'script',
}

/** 오늘의 받아쓰기에서 이 문장이 뽑힌 이유 — 학습자에게 그대로 보여준다. */
const REASON_LABEL: Record<string, string> = {
  due: '복습 임박 단어',
  retry: '지난번 놓친 문장',
  fresh: '읽던 자료에서',
}

export function DictationSessionClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')

  const {
    session,
    status,
    currentItem,
    progress,
    isComplete,
    submitAnswer,
    consumeHint,
    noteReplay,
    next,
    skip,
  } = useDictationSession(sessionId)

  const audio = useAudioControl()

  const [userInput, setUserInput] = useState('')
  const [activeHint, setActiveHint] = useState<HintLevel | null>(null)
  const [usedHints, setUsedHints] = useState<HintLevel[]>([])
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const [speed, setSpeed] = useState(0.85)
  const [autoRepeat, setAutoRepeat] = useState(3)
  const [showTranslation, setShowTranslation] = useState(false)
  const itemStartedAtRef = useRef<number>(Date.now())
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (session) {
      setSpeed(session.config.speed)
      setAutoRepeat(session.config.autoRepeat)
    }
  }, [session])

  // 새 문항 도착 시 초기화
  useEffect(() => {
    setUserInput('')
    setActiveHint(null)
    setUsedHints([])
    setOutcome(null)
    setShowTranslation(false)
    itemStartedAtRef.current = Date.now()
    inputRef.current?.focus()
  }, [currentItem?.index])

  // 다음 문항을 미리 합성 — 신경망 음성일 때 "재생을 눌렀는데 몇 초 조용한" 구간을 없앤다.
  // (시스템 음성이면 no-op)
  const warm = audio.warm
  useEffect(() => {
    if (!session) return
    const next = session.items[session.currentIndex + 1]
    if (next) warm(next.expectedText)
  }, [session, warm])

  // ─── SessionFrame 셸에 리소스 컨텍스트 + 진행도 주입 ───
  const { setProgress } = useSessionProgress()
  useEffect(() => {
    if (!session) return
    setProgress({
      current: session.currentIndex + 1,
      total: session.items.length,
      resource: {
        type: RESOURCE_TYPE[session.sourceKind] ?? 'script',
        label: session.resourceTitle,
        position: `문항 ${session.currentIndex + 1} / ${session.items.length}`,
      },
    })
    return () => setProgress(null)
  }, [session, setProgress])

  // 완료 시 결과 페이지로
  useEffect(() => {
    if (isComplete && session) {
      router.replace(`/dictate/results?sessionId=${session.id}`)
    }
  }, [isComplete, session, router])

  // ─── 오디오 (재생 횟수는 난이도 판정 입력이라 세션에 기록한다) ───
  const playAudio = useCallback(() => {
    if (!currentItem) return
    noteReplay()
    audio.repeat(currentItem.expectedText, autoRepeat, speed, 1500)
  }, [audio, currentItem, autoRepeat, speed, noteReplay])

  const playOnce = useCallback(() => {
    if (!currentItem) return
    noteReplay()
    audio.play(currentItem.expectedText, speed)
  }, [audio, currentItem, speed, noteReplay])

  const stopAudio = useCallback(() => {
    audio.stop()
  }, [audio])

  // ─── 제출 ───
  //
  // ⚠️ `outcome` 만으로는 이중 제출을 못 막는다. `setOutcome` 은 비동기라 같은 tick 에
  //    두 번 호출되면 **둘 다 통과**한다 — Enter 키를 누르고 있으면 반복 이벤트가 그렇게 들어온다.
  //    그러면 같은 문항이 두 번 채점되고 `dictation_attempts` 에도 두 행이 남는다.
  //    렌더 타이밍과 무관한 ref 로 잠근다(문항이 바뀔 때 푼다).
  const submittedRef = useRef(false)
  useEffect(() => {
    submittedRef.current = false
  }, [currentItem?.index])

  const handleSubmit = useCallback(() => {
    if (!currentItem || outcome || submittedRef.current) return
    if (userInput.trim().length === 0) return
    submittedRef.current = true
    const elapsed = Date.now() - itemStartedAtRef.current
    const res = submitAnswer(userInput, elapsed)
    if (res) {
      setOutcome(res)
      audio.stop()
    } else {
      // 채점이 안 됐으면 잠금을 되돌린다 — 아니면 이 문항을 영영 제출할 수 없다
      submittedRef.current = false
    }
  }, [currentItem, outcome, userInput, submitAnswer, audio])

  const handleNext = useCallback(() => {
    audio.stop()
    next()
  }, [audio, next])

  const handleSkip = useCallback(() => {
    // 건너뛰기도 문항 하나를 소모하고 적재한다 — 같은 이유로 한 번만 통과시킨다
    if (submittedRef.current) return
    submittedRef.current = true
    audio.stop()
    skip()
  }, [audio, skip])

  // ─── 힌트 ───
  const handleHint = useCallback(
    (level: HintLevel) => {
      if (!session?.config.hintsAllowed) return
      const stage = HINT_STAGES.find((s) => s.level === level)
      if (!stage) return
      if (!usedHints.includes(level)) {
        setUsedHints((prev) => [...prev, level])
        consumeHint(stage.level)
      }
      setActiveHint(level)
    },
    [session, usedHints, consumeHint],
  )

  // ─── 키보드 단축키 ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isInInput =
        e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement

      // IME 조합 중이면 손대지 않는다. 한글 IME 에서 Enter 는 **조합을 확정하는 키**이고,
      // 그걸 제출로 가로채면 학습자는 타이핑 도중에 답이 채점돼 버린다 — 되돌릴 수 없다
      // (문항이 소모된다). 같은 방어가 `MorphemeRulesGame` 에 이미 있었는데
      // **타이핑이 본체인 이 화면에만 없었다.** 영어만 치는 리뷰어에겐 안 보인다.
      if (e.isComposing || e.keyCode === 229) return

      if (e.key === 'Enter' && isInInput && !e.shiftKey) {
        e.preventDefault()
        if (outcome) handleNext()
        else handleSubmit()
        return
      }

      if (isInInput && e.code !== 'Escape' && !e.ctrlKey && !e.metaKey) return

      // 버튼·링크에 포커스가 있으면 그 요소의 기본 동작이 우선이다.
      // (Space 를 가로채면 포커스한 버튼을 **키보드로 누를 수가 없다**.)
      const onControl =
        e.target instanceof HTMLElement &&
        !!e.target.closest('button, a, [role="button"], select, [contenteditable]')

      if (e.code === 'Space') {
        if (onControl) return
        e.preventDefault()
        if (audio.isPlaying) stopAudio()
        else playOnce()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        stopAudio()
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setFocusMode((v) => !v)
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const speeds = [0.5, 0.75, 0.85, 1.0, 1.25]
        setSpeed(speeds[Number(e.key) - 1])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [audio.isPlaying, outcome, handleNext, handleSubmit, playOnce, stopAudio])

  // 이미 완주한 세션 URL — 다시 풀게 하지 않고 결과로 보낸다.
  // (DB 복원이 생기기 전에는 이 경우가 '못 찾음' 과 뒤섞여 있었다.)
  if (status === 'completed' && sessionId) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <div>
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            이미 마친 받아쓰기예요
          </h2>
          <p className="mt-1.5 font-body text-[13px] leading-relaxed text-[var(--t2)]">
            결과는 그대로 남아 있어요. 다시 풀고 싶으면 같은 자료로 새로 시작하면 돼요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.replace(`/dictate/results?sessionId=${sessionId}`)}
          className={`inline-flex h-11 items-center gap-1.5 rounded-[var(--r-md)] px-4 font-display text-[13px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-transform hover:-translate-y-0.5 ${FOCUS_RING}`}
          style={{ background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)` }}
        >
          결과 보기
          <ArrowRight size={14} />
        </button>
      </div>
    )
  }

  // 세션 미발견 — DB 에도 문항이 없는 경우다(이 컬럼 이전 세션 · 비로그인 로컬 세션)
  if (status === 'not-found') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg2)] text-[var(--t2)]">
          <X size={22} />
        </span>
        <div>
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            진행 중이던 받아쓰기를 못 찾았어요
          </h2>
          <p className="mt-1.5 font-body text-[13px] leading-relaxed text-[var(--t2)]">
            지금 시작하는 받아쓰기는 어느 기기에서든 이어서 풀 수 있어요. 다만 2026년 8월
            이전에 시작한 세션은 이어받을 문항이 남아 있지 않습니다. 이미 푼 문항의 결과는
            기록에 남아 있으니 새로 시작하셔도 괜찮아요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dictate')}
          className={`inline-flex h-11 items-center gap-1.5 rounded-[var(--r-md)] px-4 font-display text-[13px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-transform hover:-translate-y-0.5 ${FOCUS_RING}`}
          style={{ background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)` }}
        >
          받아쓰기로 돌아가기
          <ArrowRight size={14} />
        </button>
      </div>
    )
  }

  if (!session || !currentItem) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center font-body text-[14px] text-[var(--t2)]">
        불러오는 중...
      </div>
    )
  }

  const hintAllowed = session.config.hintsAllowed
  const hintShown = activeHint
    ? HINT_STAGES.find((s) => s.level === activeHint)?.show(
        currentItem.expectedText,
        currentItem.translation,
      )
    : null
  const targetCount = currentItem.targetWords.length

  return (
    <div
      className={`relative min-h-screen transition-colors duration-300 ${
        focusMode ? 'bg-[var(--bg2)]' : ''
      }`}
    >
      {focusMode && (
        <style jsx global>{`
          aside {
            opacity: 0.25 !important;
            transition: opacity 300ms;
          }
          aside:hover {
            opacity: 1 !important;
          }
        `}</style>
      )}

      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 md:px-6 md:py-10">
        {/* ─── Header ─── */}
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              typeof window !== 'undefined' && window.history.length > 1
                ? router.back()
                : router.push('/dictate')
            }
            className={`inline-flex h-11 items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] ${FOCUS_RING}`}
          >
            <X size={14} />
            나가기
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-body text-[12px] text-[var(--t2)]">
              {currentItem.contextLabel ?? session.resourceTitle}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--bg3)]">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${progress * 100}%`,
                    background: `linear-gradient(90deg, ${DICTATION_ACCENT}, #1D4ED8)`,
                  }}
                />
              </div>
              <span className="font-mono text-[11px] font-[700] tabular-nums text-[var(--t2)]">
                {session.currentIndex + 1} / {session.items.length}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFocusMode((v) => !v)}
            aria-pressed={focusMode}
            className={`inline-flex h-11 items-center gap-1 rounded-[var(--r-md)] border px-3 font-display text-[12px] font-[600] transition-colors ${FOCUS_RING} ${
              focusMode
                ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--on-p-tint)]'
                : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)]'
            }`}
            title="Focus Mode (F)"
          >
            <Focus size={14} />
            Focus
          </button>
        </header>

        {/* ─── Audio Player ─── */}
        <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-gradient-to-br from-[var(--bg)] to-[var(--bg2)] p-5 shadow-[var(--sh-sm)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="font-display text-[11px] font-[700] uppercase tracking-[0.10em]"
                style={{ color: DICTATION_ACCENT }}
              >
                듣고 받아쓰기
              </span>
              {currentItem.reason && (
                <span className="rounded-full bg-[var(--bg3)] px-2 py-0.5 font-body text-[10px] font-[600] text-[var(--t2)]">
                  {REASON_LABEL[currentItem.reason] ?? currentItem.reason}
                </span>
              )}
            </div>
            <span className="font-mono text-[11px] text-[var(--t2)]">
              {audio.preparing
                ? '음성 준비 중'
                : audio.isPlaying
                  ? `재생 중 ${audio.iteration}/${autoRepeat}`
                  : '대기'}
            </span>
          </div>

          {/* 영어 음성이 없는 기기 — 예전엔 여기서 안내만 하고 끝났다(무음).
              이제 해결책을 한 번 물어본다. 데이터 소모를 숨기지 않고 크기를 밝힌다. */}
          {audio.englishVoiceAvailable === false && audio.engine === 'system' && (
            <div
              className="mb-3 rounded-[var(--r-md)] border border-[var(--warning)]/30 bg-[var(--warning-light)] px-3 py-2.5"
              role="status"
            >
              <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
                이 기기에 영어 음성이 없어 소리가 나지 않아요. 기기의 음성(TTS) 설정에서 영어
                음성을 추가하거나, 아래에서 읽어 줄 음성을 한 번 내려받을 수 있어요.
              </p>
              {audio.neuralSupported && (
                <button
                  type="button"
                  onClick={() => audio.chooseEngine('neural')}
                  className={`mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--t1)] transition-colors hover:border-[var(--p)] hover:bg-[var(--p-light)] ${FOCUS_RING}`}
                >
                  <Download size={12} />
                  음성 내려받아 사용하기 (약 17MB · 한 번만)
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={audio.isPlaying ? stopAudio : playAudio}
              className={`inline-flex h-14 w-14 items-center justify-center rounded-full text-[var(--ti)] shadow-[var(--sh-md)] transition-transform active:scale-95 ${FOCUS_RING}`}
              style={{ background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)` }}
              aria-label={audio.isPlaying ? '정지' : '재생'}
            >
              {audio.isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-1" />}
            </button>

            <button
              type="button"
              onClick={playOnce}
              className={`inline-flex h-11 items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] ${FOCUS_RING}`}
              title="한 번만 재생 (Space)"
            >
              <RotateCw size={14} />
              1회
            </button>

            <div className="ml-auto flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] p-1">
              {[0.5, 0.75, 0.85, 1.0, 1.25].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  aria-pressed={Math.abs(speed - s) < 0.01}
                  aria-label={`재생 속도 ${s}배`}
                  className={`min-h-[44px] min-w-[44px] rounded-[var(--r-sm)] px-2 py-1 font-mono text-[11px] font-[700] transition-colors ${FOCUS_RING} ${
                    Math.abs(speed - s) < 0.01
                      ? 'bg-[var(--p)] text-[var(--on-p)]'
                      : 'text-[var(--t2)] hover:bg-[var(--bg2)]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* 목소리 선택 — 기본은 시스템 음성(속도를 낮춰도 음높이가 보존된다).
              신경망 음성은 기기에 영어 음성이 없거나, 늘 같은 목소리로 듣고 싶을 때. */}
          {audio.neuralSupported && (
            <div className="mt-3 flex items-center gap-1.5">
              <span className="font-body text-[11px] text-[var(--t2)]">목소리</span>
              {(
                [
                  { id: 'system' as const, label: '기기 음성' },
                  { id: 'neural' as const, label: '내려받은 음성' },
                ]
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    audio.stop()
                    audio.chooseEngine(v.id)
                  }}
                  aria-pressed={audio.engine === v.id}
                  className={`min-h-[44px] rounded-[var(--r-sm)] border px-2.5 py-1 font-display text-[11px] font-[600] transition-colors duration-[var(--dur-normal)] ${FOCUS_RING} ${
                    audio.engine === v.id
                      ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--on-p-tint)]'
                      : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)]'
                  }`}
                >
                  {v.label}
                </button>
              ))}
              {audio.neuralFailed && (
                <span className="font-body text-[11px] italic text-[var(--t2)]">
                  내려받기에 실패해 기기 음성으로 읽고 있어요
                </span>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--t2)]">
            <kbd className="rounded bg-[var(--bg3)] px-1.5 py-0.5 font-mono">Space</kbd>
            <span>재생</span>
            <span className="opacity-50">·</span>
            <kbd className="rounded bg-[var(--bg3)] px-1.5 py-0.5 font-mono">1-5</kbd>
            <span>속도</span>
            <span className="opacity-50">·</span>
            <kbd className="rounded bg-[var(--bg3)] px-1.5 py-0.5 font-mono">F</kbd>
            <span>Focus</span>
            <span className="opacity-50">·</span>
            <kbd className="rounded bg-[var(--bg3)] px-1.5 py-0.5 font-mono">Enter</kbd>
            <span>제출</span>
          </div>
        </section>

        {/* ─── 입력 / 피드백 ─── */}
        {!outcome ? (
          <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">
                들은 내용을 받아써 보세요
              </h3>
              {/* 어떤 단어인지는 알려주지 않는다 — 개수만으로 주의를 모은다 */}
              {targetCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--p-light)] px-2.5 py-1 font-body text-[11px] font-[600] text-[var(--on-p-tint)]">
                  <Sparkles size={11} />내 단어 {targetCount}개 포함
                </span>
              )}
            </div>

            {hintShown && (
              <div className="mb-3 rounded-[var(--r-md)] bg-[var(--active-light)] px-4 py-3">
                <p className="mb-1 flex items-center gap-1 font-display text-[11px] font-[700] uppercase tracking-wider text-[var(--active)]">
                  <Lightbulb size={11} />
                  Hint Level {activeHint}
                </p>
                <p
                  className={`font-body ${
                    activeHint === 3
                      ? 'text-[14px] text-[var(--t1)]'
                      : 'font-mono text-[16px] tracking-wider text-[var(--t1)]'
                  }`}
                >
                  {hintShown}
                </p>
                {/* 정답을 연 순간 인출은 없었다 — 그 사실을 숨기지 않는다(targets.ts 등급 규칙) */}
                {activeHint === 4 && targetCount > 0 && (
                  <p className="mt-1.5 font-body text-[11px] italic text-[var(--t2)]">
                    정답을 봤으니 이 문장의 단어는 복습 큐에 그대로 남겨둘게요.
                  </p>
                )}
              </div>
            )}

            <textarea
              ref={inputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="듣고 영어로 받아써보세요..."
              aria-label="받아쓴 내용"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              rows={3}
              className="w-full resize-none rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3 font-english text-[18px] leading-relaxed text-[var(--t1)] focus:border-[var(--bdf)] focus:outline-none focus:ring-2 focus:ring-[var(--p)]/20"
              style={{ fontFamily: 'Lora, serif' }}
            />

            {hintAllowed && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="font-body text-[11px] text-[var(--t2)]">힌트:</span>
                {HINT_STAGES.map((stage) => {
                  const used = usedHints.includes(stage.level)
                  return (
                    <button
                      key={stage.level}
                      type="button"
                      onClick={() => handleHint(stage.level)}
                      aria-pressed={activeHint === stage.level}
                      className={`min-h-[44px] rounded-[var(--r-sm)] border px-2.5 py-1 font-display text-[11px] font-[600] transition-colors ${FOCUS_RING} ${
                        activeHint === stage.level
                          ? 'border-[var(--active)] bg-[var(--active-light)] text-[var(--active)]'
                          : used
                            ? 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t2)]'
                            : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)]'
                      }`}
                    >
                      {stage.name}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={userInput.trim().length === 0}
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[var(--r-md)] py-2.5 font-display text-[13px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                style={{ background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)` }}
              >
                제출
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className={`inline-flex min-h-[44px] items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] px-4 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] ${FOCUS_RING}`}
              >
                <SkipForward size={14} />
                건너뛰기
              </button>
            </div>
          </section>
        ) : (
          <FeedbackSection
            outcome={outcome}
            expected={currentItem.expectedText}
            previousAccuracy={currentItem.previousAccuracy}
            translation={currentItem.translation}
            showTranslation={showTranslation}
            onToggleTranslation={() => setShowTranslation((v) => !v)}
            onNext={handleNext}
            onPlayAgain={playOnce}
            isLast={session.currentIndex >= session.items.length - 1}
          />
        )}
      </div>
    </div>
  )
}

// ── 피드백 ────────────────────────────────────────────────────────

function FeedbackSection({
  outcome,
  expected,
  previousAccuracy,
  translation,
  showTranslation,
  onToggleTranslation,
  onNext,
  onPlayAgain,
  isLast,
}: {
  outcome: SubmitOutcome
  expected: string
  previousAccuracy?: number
  translation?: string
  showTranslation: boolean
  onToggleTranslation: () => void
  onNext: () => void
  onPlayAgain: () => void
  isLast: boolean
}) {
  const { result, targetHits, targetMisses } = outcome
  const accColor =
    result.accuracy >= 90
      ? 'var(--success)'
      : result.accuracy >= 70
        ? 'var(--p)'
        : 'var(--warning)'

  return (
    // 제출하면 이 섹션이 입력창을 **대체**한다. 라이브 리전이 없으면 화면 판독기 사용자에게는
    // 아무 일도 일어나지 않은 것과 같다 — 정확도도, 어떤 단어를 놓쳤는지도 전달되지 않는다.
    // `polite` 인 이유: 채점은 학습자가 방금 한 행동의 결과라 끼어들 필요가 없다.
    <section
      role="status"
      aria-live="polite"
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
    >
      {/* 숫자·색만으로 결과를 말하지 않는다 — 판독기에는 한 문장으로 요약해 준다 */}
      <p className="sr-only">
        정확도 {Math.round(result.accuracy)}퍼센트.
        {targetHits.length > 0 && ` 내 단어 ${targetHits.length}개를 잡았어요.`}
        {targetMisses.length > 0 && ` ${targetMisses.length}개는 놓쳤어요.`}
      </p>
      <header className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">결과</h3>
        <span
          className="font-mono text-[24px] font-[800] tabular-nums"
          style={{ color: accColor }}
        >
          {Math.round(result.accuracy)}%
        </span>
      </header>

      <p className="mb-3 font-body text-[13px] italic text-[var(--t2)]">{result.feedback}</p>

      {/* 재도전 문장 — 숫자 두 개가 나란히 놓일 때만 성장이 눈에 보인다 */}
      {previousAccuracy != null && (
        <div className="mb-3 flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--bg2)] px-3 py-2">
          <span className="font-mono text-[13px] font-[700] tabular-nums text-[var(--t3)]">
            {Math.round(previousAccuracy)}%
          </span>
          <ArrowRight size={13} className="text-[var(--t3)]" />
          <span
            className="font-mono text-[15px] font-[800] tabular-nums"
            style={{ color: result.accuracy >= previousAccuracy ? 'var(--success)' : 'var(--t2)' }}
          >
            {Math.round(result.accuracy)}%
          </span>
          <span className="font-body text-[11px] text-[var(--t2)]">
            {result.accuracy >= previousAccuracy + 10
              ? '지난번보다 또렷하게 들었어요'
              : result.accuracy >= previousAccuracy
                ? '지난번만큼 들었어요'
                : '이 문장은 조금 더 만나야겠어요'}
          </span>
        </div>
      )}

      {/* 타깃 단어 결과 — 이 문장이 무엇을 훈련했는지 지금 밝힌다 */}
      {(targetHits.length > 0 || targetMisses.length > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-[var(--r-md)] bg-[var(--bg2)] px-3 py-2.5">
          <span className="mr-1 font-body text-[11px] font-[600] text-[var(--t2)]">
            이 문장의 내 단어
          </span>
          {targetHits.map((w) => (
            <span
              key={`hit-${w}`}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--success-light)] px-2.5 py-1 font-english text-[12px] font-[600] text-[var(--success)]"
            >
              ✓ {w}
            </span>
          ))}
          {targetMisses.map((w) => (
            <span
              key={`miss-${w}`}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--warning-light)] px-2.5 py-1 font-english text-[12px] font-[600] text-[var(--warning)]"
            >
              ↻ {w}
            </span>
          ))}
        </div>
      )}

      {/* 단어별 시각 피드백 */}
      <div className="mb-3 rounded-[var(--r-md)] bg-[var(--bg2)] p-3 font-english text-[16px] leading-relaxed">
        {result.wordResults.map((w, idx) => (
          <WordChip key={idx} word={w} />
        ))}
      </div>

      <WordStatusLegend statuses={new Set(result.wordResults.map((w) => w.status))} />

      <div className="mb-3 rounded-[var(--r-md)] border border-[var(--success-light)] bg-[var(--success-light)]/30 px-3 py-2">
        <p className="mb-1 font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--success)]">
          정답
        </p>
        <p className="font-english text-[15px] text-[var(--t1)]">{expected}</p>
      </div>

      {translation && (
        <div className="mb-3">
          <button
            type="button"
            onClick={onToggleTranslation}
            className={`inline-flex min-h-[44px] items-center gap-1 rounded-[var(--r-sm)] font-body text-[11px] text-[var(--p)] hover:underline ${FOCUS_RING}`}
          >
            {showTranslation ? <EyeOff size={12} /> : <Eye size={12} />}
            {showTranslation ? '번역 숨기기' : '한국어 번역 보기'}
          </button>
          {showTranslation && (
            <p className="mt-1 font-body text-[13px] italic text-[var(--t2)]">{translation}</p>
          )}
        </div>
      )}

      {result.errorPatterns.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 font-display text-[11px] font-[700] uppercase tracking-wider text-[var(--t2)]">
            발견된 패턴
          </h4>
          <ul className="space-y-1.5">
            {result.errorPatterns.slice(0, 3).map((p, i) => (
              <li
                key={i}
                className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2"
              >
                <p className="font-body text-[12px] font-[600] text-[var(--t1)]">
                  {p.description} ({p.frequency}회)
                </p>
                <p className="font-body text-[11px] text-[var(--t2)]">{p.suggestion}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPlayAgain}
          className={`inline-flex min-h-[44px] items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] ${FOCUS_RING}`}
        >
          <RotateCw size={12} />
          다시 듣기
        </button>
        <button
          type="button"
          onClick={onNext}
          className={`flex flex-1 items-center justify-center gap-2 rounded-[var(--r-md)] py-2 font-display text-[13px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-transform hover:-translate-y-0.5 ${FOCUS_RING}`}
          style={{ background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)` }}
        >
          {isLast ? '마치기' : '다음'}
          <ArrowRight size={14} />
        </button>
      </div>
    </section>
  )
}

// 단어 채점 상태별 스타일 — 색 + 밑줄/취소선/테두리로 색맹 대응 (색상 단독 전달 금지)
const WORD_STATUS_STYLES: Record<WordResult['status'], string> = {
  correct: 'text-[var(--success)] bg-[var(--success-light)]/40',
  misspelled: 'text-[var(--warning)] bg-[var(--warning-light)]/40 underline decoration-wavy',
  wrong: 'text-[var(--error-ink)] bg-[var(--error-light)]/40 line-through',
  missing: 'text-[var(--error-ink)] border border-dashed border-[var(--error)]',
  extra: 'text-[var(--warning)] line-through opacity-60',
}

const WORD_STATUS_LABELS: Record<WordResult['status'], string> = {
  correct: '정답',
  misspelled: '철자',
  wrong: '오답',
  missing: '누락',
  extra: '불필요',
}

const WORD_STATUS_ORDER: WordResult['status'][] = [
  'correct',
  'misspelled',
  'wrong',
  'missing',
  'extra',
]

function WordStatusLegend({ statuses }: { statuses: Set<WordResult['status']> }) {
  const items = WORD_STATUS_ORDER.filter((s) => statuses.has(s))
  if (items.length === 0) return null
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {items.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`inline-block rounded px-1.5 py-0.5 font-english text-[11px] ${WORD_STATUS_STYLES[s]}`}
          >
            Aa
          </span>
          <span className="font-body text-[11px] text-[var(--t2)]">{WORD_STATUS_LABELS[s]}</span>
        </span>
      ))}
    </div>
  )
}

function WordChip({ word }: { word: WordResult }) {
  const display = word.status === 'missing' ? word.expected : word.actual

  return (
    <span
      className={`mr-1 inline-block rounded px-1.5 py-0.5 font-english ${WORD_STATUS_STYLES[word.status]}`}
      title={
        word.status === 'misspelled' || word.status === 'wrong'
          ? `정답: ${word.expected}`
          : undefined
      }
    >
      {display || '—'}
    </span>
  )
}
