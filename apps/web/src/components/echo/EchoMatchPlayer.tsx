// apps/web/src/components/echo/EchoMatchPlayer.tsx
//
// EchoMatch 메인 4-Phase 컨트롤러.
// idle → listening → recording → comparing → scored → (next/retry → idle)

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  Square,
} from 'lucide-react'

import { compareContours, scoreFeedback, type ComparisonScore } from '@/lib/echo/dtw-comparator'
import { extractPitchContour, type PitchContour } from '@/lib/echo/pitch-extractor'
import {
  playAudioBuffer,
  recordUntilStop,
  releaseMic,
  requestMicAccess,
} from '@/lib/echo/audio-recorder'
import {
  compareError,
  micError,
  modelError,
  playbackError,
  unsupportedError,
  type EchoError,
} from '@/lib/echo/echo-error'
import { saveEchoAttempt, finalizeEchoSession } from '@/lib/echo/save-attempt'
import {
  ensurePiperSession,
  piperSynthesize,
  isPiperSupported,
  DEFAULT_PIPER_VOICE,
} from '@/lib/echo/piper-tts'
// #2 단어 정확도 — 병렬 음성인식(재사용) + 느슨한 단어 일치. 완전 additive: 실패/미지원 시 프로소디만.
import {
  createRecognizer,
  isSpeechRecognitionSupported,
  type Recognizer,
} from '@/lib/workspace/speech-recognition'
import { computeShadowMatch } from '@/lib/workspace/shadow-match'
// 청각 면(F3) 신호 — 따라 말하기를 어휘 단위 인출 기록으로 잇는다(설계안 §8 빈칸).
// 적재 실패는 따라 말하기를 막지 않는다: 학습이 본체이고 기록은 부수 효과다.
import { loadSoundLemmas, recordEchoSound } from '@/lib/echo/record-sound'
import { soundRecords, type SoundLemma } from '@/lib/echo/word-signal'

import { PhaseProgress } from './PhaseProgress'
import { SentenceCarousel } from './SentenceCarousel'
import { PitchVisualizer } from './PitchVisualizer'
import { ScoreCard } from './ScoreCard'
import { MicPermissionGate } from './MicPermissionGate'
import { ReplayPanel } from './ReplayPanel'
import {
  EchoReplay,
  IDLE_REPLAY,
  replayBufferAt,
  sentenceMaterialKey,
  type ReplayState,
  type ReplayTake,
  type ReplayTarget,
} from '@/lib/echo/replay-controller'
import { useStoryAuthGuard } from '@/components/library/story/use-story-auth-guard'
import { useTextContentSafe } from '@/app/(main)/text/[id]/text-content-context'

type Phase = 'idle' | 'listening' | 'recording' | 'comparing' | 'scored'

export interface EchoSentence {
  id: string
  text: string
  chapterIdx?: number
}

interface Props {
  textId: string
  libraryBookId?: string | null
  bookTitle?: string
  chapterTitle?: string
  sentences: EchoSentence[]
}

export function EchoMatchPlayer({
  textId,
  libraryBookId,
  bookTitle,
  chapterTitle,
  sentences,
}: Props) {
  const [micGranted, setMicGranted] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [score, setScore] = useState<ComparisonScore | null>(null)
  const [refContour, setRefContour] = useState<PitchContour | null>(null)
  const [userContour, setUserContour] = useState<PitchContour | null>(null)
  // 사유마다 제목·설명·복구 동작이 다르다 — 문자열 하나를 넷이 공유하던 시절엔
  // 재생 실패도 비교 실패도 「음성 모델 로드 실패」로 뭉개졌다(M7).
  const [error, setError] = useState<EchoError | null>(null)
  // #2 — 이번 발화의 단어 정확도(0..1). null = 미측정(미지원/인식 실패/무음) → 게이트 안 함.
  const [wordRatio, setWordRatio] = useState<number | null>(null)
  const recognizerRef = useRef<Recognizer | null>(null)
  const transcriptRef = useRef('')
  const stopRecRef = useRef<(() => Promise<{ audioBuffer: AudioBuffer; durationMs: number }>) | null>(
    null,
  )
  // 이번 녹음 — 결과 화면의 「내 발화 다시 듣기」 용. 이 문장 · 이 화면에서만 잠시 붙잡고(새 녹음 · 문장 이동 · 재시도 · 이탈에서 버린다)
  //   파일 · 저장소 · 서버로 보내지 않는다. 문장 id 를 함께 둬 다른 문장의 발화로 대신 재생하지 않는다.
  const userTakeRef = useRef<ReplayTake | null>(null)
  // 시도 세대 — 재시도 · 문장 이동 · 이탈마다 올린다. 그 전에 출발한 합성 · 재생 · 녹음 · 비교 결과는 늦게 와도 버린다
  //   (계정이 바뀌어 화면이 내려간 뒤 끝난 비교가 새 계정 이름으로 기록되지 않게).
  const runGenRef = useRef(0)
  const listenAbortRef = useRef<AbortController | null>(null)
  const replayRef = useRef<EchoReplay | null>(null)
  const [replay, setReplay] = useState<ReplayState>(IDLE_REPLAY)
  // 계정 경계 — 부모 ReaderViewerGate 가 화면을 내리기 전(정리 effect 전)에 불린 다시 듣기도 호출 시점에 막도록
  //   같은 주인(서버가 읽은 ownerId)으로 기존 StoryAuthGuard 를 읽는다. 화면 게이트는 부모 몫이다.
  const ownerId = useTextContentSafe()?.ownerId ?? null
  const { guard: authGuard, status: authStatus } = useStoryAuthGuard(ownerId)
  // 이미 잡힌 콜백이 늦게 불려도 **지금** 값을 읽게 한다
  const phaseRef = useRef<Phase>('idle')
  const materialKeyRef = useRef<string | null>(null)
  const pageHiddenRef = useRef(false)
  // 각 sentence 의 시도 횟수 (점수 적재 시 attempt_number)
  const attemptCountRef = useRef<Map<string, number>>(new Map())
  // 이 텍스트에서 담아 둔 내 단어 — 청각 면(F3) 신호의 대상. 없으면 빈 배열로 무해하게 논다.
  const soundLemmasRef = useRef<SoundLemma[]>([])
  // Piper 모델 다운로드 진행 (첫 사용 시만)
  const [modelProgress, setModelProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [piperReady, setPiperReady] = useState(false)
  // 현재 sentence 의 reference audio + contour 캐시 (재시도 시 재합성 X)
  // 키 = 문장 자료(sentenceMaterialKey) — 같은 id 라도 내용이 바뀌면 예시를 다시 만든다
  const refCacheRef = useRef<Map<string, { buffer: AudioBuffer; contour: PitchContour }>>(
    new Map(),
  )

  const current = sentences[currentIdx]
  const last = sentences.length - 1
  const materialKey = current ? sentenceMaterialKey(current) : null
  phaseRef.current = phase
  materialKeyRef.current = materialKey
  // 단어 정확도가 확연히 낮으면(측정됨 && <0.4) 프로소디 점수는 오해 소지 → 재읽기로 부드럽게 유도(게이트).
  //   비난 아님(Calm) + 인식 불완전을 감안한 겸손한 문구("잘 안 들렸어요"). 미측정(null)은 게이트 안 함.
  const WORD_GATE = 0.4
  const lowWords = wordRatio != null && wordRatio < WORD_GATE
  const fb = !score
    ? null
    : lowWords
      ? { label: '단어가 잘 안 들렸어요 — 문장을 보며 또박또박 다시 읽어볼까요?', tone: 'try' as const }
      : scoreFeedback(score.overall)

  // 마이크 권한 — 실패는 사유별 한국어 안내로 바꾼다(M6).
  //   브라우저 원문(`Permission denied`)을 그대로 띄우면 학습자는 되돌리는 법을 알 수 없고,
  //   차단 뒤에는 프롬프트가 다시 뜨지 않아 같은 영어만 반복됐다.
  async function handleGrantMic() {
    setError(null)
    try {
      await requestMicAccess()
      setMicGranted(true)
    } catch (e) {
      setError(micError(e))
    }
  }

  // 내 단어 로드 — 텍스트당 한 번. 실패해도 조용히 빈 배열(따라 말하기는 그대로 된다).
  useEffect(() => {
    let cancelled = false
    void loadSoundLemmas(textId)
      .then((ls) => {
        if (!cancelled) soundLemmasRef.current = ls
      })
      .catch(() => {
        /* 단어를 못 불러와도 학습은 진행된다 — 신호만 비는 것이다 */
      })
    return () => {
      cancelled = true
    }
  }, [textId])

  // Piper 모델 lazy preload — 마이크 권한 후 백그라운드 다운로드
  const [piperLoading, setPiperLoading] = useState(false)
  useEffect(() => {
    if (!micGranted || piperReady) return
    if (!isPiperSupported()) {
      setError(unsupportedError)
      return
    }
    let cancelled = false
    setPiperLoading(true)
    setError(null)
    // placeholder progress (실제 콜백 호출 전 indicator)
    setModelProgress({ loaded: 0, total: 1 })

    void ensurePiperSession(DEFAULT_PIPER_VOICE, (loaded, total) => {
      if (!cancelled) setModelProgress({ loaded, total })
    })
      .then(() => {
        if (!cancelled) {
          setPiperReady(true)
          setModelProgress(null)
          setPiperLoading(false)
        }
      })
      .catch((e) => {
        const mapped = modelError(e)
        if (!cancelled) {
          setError(mapped)
          setPiperLoading(false)
          setModelProgress(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [micGranted, piperReady])

  // Phase 1 — Listen (Piper TTS + AudioBuffer 직접 분석)
  const startListen = useCallback(async () => {
    if (!current) return
    const gen = runGenRef.current
    const stale = () => gen !== runGenRef.current
    listenAbortRef.current?.abort()
    const listenAbort = new AbortController()
    listenAbortRef.current = listenAbort
    setPhase('listening')
    setError(null)
    setScore(null)
    setWordRatio(null)
    setRefContour(null)
    setUserContour(null)
    try {
      // Reference audio + contour cache 우선
      const key = sentenceMaterialKey(current)
      let cached = refCacheRef.current.get(key)
      if (!cached) {
        const { audioBuffer } = await piperSynthesize(current.text)
        const contour = extractPitchContour(audioBuffer)
        cached = { buffer: audioBuffer, contour }
        refCacheRef.current.set(key, cached)
      }
      if (stale()) return
      setRefContour(cached.contour)
      // 재생 (분석은 이미 됨) — 재시도 · 이동 · 이탈이면 여기서 끊긴다
      await playAudioBuffer(cached.buffer, { signal: listenAbort.signal })
      if (stale()) return
      // Phase 2 자동 진입
      setPhase('recording')
      const { stop } = await recordUntilStop()
      if (stale()) {
        void stop().catch(() => {})
        return
      }
      stopRecRef.current = stop
      // 병렬 단어 인식 시작 (완전 additive — 실패/미지원이어도 녹음·채점 무영향)
      try {
        if (isSpeechRecognitionSupported()) {
          if (!recognizerRef.current) recognizerRef.current = createRecognizer('en-US')
          transcriptRef.current = ''
          recognizerRef.current.start({
            onInterim: (t) => {
              transcriptRef.current = t
            },
          })
        }
      } catch {
        /* 인식 시작 실패 — 프로소디만 채점 */
      }
    } catch (e) {
      if (stale()) return
      setError(playbackError(e))
      setPhase('idle')
    }
  }, [current])

  // Phase 2 → Phase 3 — Stop recording
  async function stopRecording() {
    if (!stopRecRef.current || !current) return
    const gen = runGenRef.current
    const sentence = current
    setPhase('comparing')
    // 병렬 인식 종료 + transcript 회수 (guard — 실패해도 프로소디 채점 진행)
    let wr: number | null = null
    // 어떤 단어가 실제로 들렸는지 — 청각 면 판정의 **단어 단위 근거**(비율보다 강하다)
    let heardKeys: Set<string> | null = null
    try {
      recognizerRef.current?.stop()
      const transcript = transcriptRef.current.trim()
      if (transcript && current) {
        const m = computeShadowMatch(current.text, transcript)
        wr = m.ratio
        heardKeys = m.matchedKeys
      }
    } catch {
      /* 인식 실패 — 단어 정확도 미측정(null) → 프로소디 보조 근거로 판정 */
    }
    setWordRatio(wr)
    try {
      const stop = stopRecRef.current
      stopRecRef.current = null
      const { audioBuffer } = await stop()
      // 비교 중에 문장을 옮겼거나 화면이 내려갔다 — 이 발화는 버린다(점수 · 기록 · 다시 듣기 모두)
      if (gen !== runGenRef.current) return
      // 계정 경계가 같은 사람으로 확인된 동안에만 붙잡는다(그 세대를 함께 둔다)
      const authToken = authGuard.token()
      userTakeRef.current = authGuard.isCurrent(authToken)
        ? { materialKey: sentenceMaterialKey(sentence), buffer: audioBuffer, authToken }
        : null

      // 사용자 음성 분석
      const userC = extractPitchContour(audioBuffer)
      setUserContour(userC)

      // Piper reference contour — Phase 1 에서 캐시됨 (synthetic 제거)
      const cached = refCacheRef.current.get(sentenceMaterialKey(sentence))
      const refC = cached?.contour ?? userC // fallback (이론적으로 unreachable)
      setRefContour(refC)

      const result = compareContours(refC, userC)
      setScore(result)
      setPhase('scored')

      // 점수 DB 적재 (비로그인 silent skip)
      const sentenceId = sentence.id
      const prevAttempts = attemptCountRef.current.get(sentenceId) ?? 0
      const attemptNumber = prevAttempts + 1
      attemptCountRef.current.set(sentenceId, attemptNumber)
      void saveEchoAttempt({
        textId,
        libraryBookId: libraryBookId ?? null,
        sentenceId,
        attemptNumber,
        score: result,
        durationMs: userC.durationMs,
      })

      // 청각 면(F3) 신호 — 이 발화가 실어 나른 내 단어를 인출 기록으로 남긴다.
      // 판정 규칙(측정 실패 무기록 · 인식 신뢰 하한 · 근거 등급)은 word-signal.ts 가 갖는다.
      const soundRecs = soundRecords({
        sentence: sentence.text,
        score: result,
        lemmas: soundLemmasRef.current,
        transcriptRatio: wr,
        matchedKeys: heardKeys,
      })
      void recordEchoSound(soundRecs, { sentenceId, overall: result.overall })
    } catch (e) {
      if (gen !== runGenRef.current) return
      setError(compareError(e))
      setPhase('idle')
    }
  }

  /** 이 시도에 묶인 것을 모두 끊는다 — 예시 재생 · 다시 듣기 · 이번 녹음 · 인식 문자열. */
  function dropAttempt() {
    runGenRef.current += 1
    listenAbortRef.current?.abort()
    listenAbortRef.current = null
    replayRef.current?.stop()
    userTakeRef.current = null
    transcriptRef.current = ''
  }

  function handleRetry() {
    dropAttempt()
    try {
      recognizerRef.current?.abort()
    } catch {
      /* noop */
    }
    setError(null)
    setPhase('idle')
    setScore(null)
    setWordRatio(null)
    setRefContour(null)
    setUserContour(null)
  }

  function handleNext() {
    if (currentIdx < last) {
      setCurrentIdx((i) => i + 1)
      handleRetry()
    }
  }

  function handlePrev() {
    if (currentIdx > 0) {
      setCurrentIdx((i) => i - 1)
      handleRetry()
    }
  }

  // 다시 듣기 — 이 화면이 소유한 재생 하나. 효과 안에서 만들어야 개발 모드 이중 마운트에도 살아 있다.
  useEffect(() => {
    const r = new EchoReplay((buffer, opts) => playAudioBuffer(buffer, opts), setReplay)
    replayRef.current = r
    // 탭을 숨기거나 떠나면 다시 듣기를 멈춘다(다른 화면의 소리는 건드리지 않는다)
    const onHidden = () => {
      if (document.visibilityState === 'hidden') r.stop()
    }
    const onPageHide = () => {
      pageHiddenRef.current = true
      r.stop()
    }
    const onPageShow = () => {
      pageHiddenRef.current = false
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
      r.dispose()
      if (replayRef.current === r) replayRef.current = null
    }
  }, [])

  // 계정이 같은 사람이 아니게 되면(checking · changed) 다시 듣기를 끊고 이번 녹음 · 예시 캐시를 놓는다
  useEffect(() => {
    if (authStatus === 'same') return
    replayRef.current?.stop()
    userTakeRef.current = null
    refCacheRef.current.clear()
  }, [authStatus])

  // 같은 자리 문장의 내용이 바뀌면(같은 id 재사용 포함) 이전 시도 · 점수 · 녹음을 넘기지 않는다
  const prevMaterialRef = useRef(materialKey)
  useEffect(() => {
    if (prevMaterialRef.current === materialKey) return
    prevMaterialRef.current = materialKey
    handleRetry()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 자료가 바뀔 때만
  }, [materialKey])

  /** 다시 듣기 — 판정은 호출 시점의 ref · 경계 값으로(잡힌 옛 콜백도 같은 판정을 거친다). */
  function handleReplay(target: ReplayTarget) {
    const key = materialKeyRef.current
    const buffer = replayBufferAt({
      target,
      scored: phaseRef.current === 'scored',
      hidden: pageHiddenRef.current || document.visibilityState === 'hidden',
      materialKey: key,
      reference: (() => {
        const c = key ? refCacheRef.current.get(key) : undefined
        return c && key ? { materialKey: key, buffer: c.buffer } : undefined
      })(),
      take: userTakeRef.current,
      guard: authGuard,
    })
    if (!buffer) return
    replayRef.current?.start(target, buffer)
  }

  // unmount 시 stop + 마이크 해제 + 세션 finalize
  //   M8 — releaseMic() 은 만들어져 있었지만 저장소 어디에서도 불리지 않았다. 그래서 화면을
  //   떠나도 탭의 녹음 표시등과 기기 마이크 LED 가 켜진 채 남았고, 이 화면이 학습자에게 한
  //   약속("녹음해 분석한 뒤 즉시 삭제돼요")과 정면으로 어긋났다. 다음 진입은
  //   requestMicAccess 가 스트림을 새로 만들므로 지장이 없다(audio-recorder.ts:26 active 검사).
  useEffect(() => {
    return () => {
      // 계정 경계(ReaderViewerGate)가 checking · changed 로 내려도 이 정리가 돈다 — 진행 중 결과 · 버퍼를 버린다
      runGenRef.current += 1
      listenAbortRef.current?.abort()
      userTakeRef.current = null
      transcriptRef.current = ''
      if (stopRecRef.current) {
        void stopRecRef.current().catch(() => {})
      }
      try {
        recognizerRef.current?.abort()
      } catch {
        /* noop */
      }
      releaseMic()
      void finalizeEchoSession(textId)
    }
  }, [textId])

  if (!micGranted) {
    return (
      <MicPermissionGate
        onGrant={handleGrantMic}
        error={error && error.kind === 'mic' ? error : null}
      />
    )
  }

  if (sentences.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 text-center">
        <p className="font-body text-[14px] text-[var(--t2)]">
          연습할 문장이 없어요. 본문을 확인해주세요.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-6">
      {/* Header — 책 컨텍스트 */}
      {(bookTitle || chapterTitle) && (
        <header className="font-body text-[12px] text-[var(--t2)]">
          {bookTitle}
          {chapterTitle && ` · ${chapterTitle}`}
          {' · 따라읽기'}
        </header>
      )}

      {/* Piper 로드 상태 — 시작 / 진행 / 에러 통합 */}
      {(piperLoading || modelProgress || error) && (
        <div
          className={`rounded-[var(--r-md)] border p-3 ${
            error
              ? 'border-[var(--bde)] bg-[var(--error-light)]'
              : 'border-[var(--p)]/30 bg-[var(--p-light)]'
          }`}
        >
          {error ? (
            <div role="alert">
              <p className="font-display text-[11px] font-[700] uppercase tracking-wider text-[var(--error-ink)]">
                {error.title}
              </p>
              <p className="mt-1 break-keep font-body text-[12px] leading-relaxed text-[var(--error-ink)]">
                {error.message}
              </p>
              {/* 복구는 **고장 난 것**을 되돌려야 한다 —
                  모델 실패만 모델 재적재고, 재생·비교 실패는 이 문장을 다시 하는 것이며,
                  미지원 브라우저는 다시 시도해도 같은 결과라 버튼을 두지 않는다. */}
              {error.kind === 'model' && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setPiperReady(false)
                  }}
                  className="mt-2 inline-flex min-h-[44px] items-center rounded-[var(--r-sm)] border border-[var(--error)]/30 bg-[var(--bg)] px-4 font-display text-[11px] font-[700] text-[var(--error-ink)] transition-colors hover:bg-[var(--error-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:scale-[0.99]"
                >
                  음성 모델 다시 받기
                </button>
              )}
              {(error.kind === 'playback' || error.kind === 'compare') && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="mt-2 inline-flex min-h-[44px] items-center rounded-[var(--r-sm)] border border-[var(--error)]/30 bg-[var(--bg)] px-4 font-display text-[11px] font-[700] text-[var(--error-ink)] transition-colors hover:bg-[var(--error-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:scale-[0.99]"
                >
                  이 문장 다시 하기
                </button>
              )}
              {error.kind === 'unsupported' && (
                <Link
                  href="/dictate"
                  className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] border border-[var(--error)]/30 bg-[var(--bg)] px-4 font-display text-[11px] font-[700] text-[var(--error-ink)] transition-colors hover:bg-[var(--error-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
                >
                  받아쓰기로 연습하기
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="mb-1.5 flex items-baseline justify-between">
                <p className="font-display text-[11px] font-[700] uppercase tracking-wider text-[var(--p)]">
                  음성 모델 다운로드 중
                </p>
                <span className="font-mono text-[10px] text-[var(--p)] tabular-nums">
                  {modelProgress && modelProgress.total > 1
                    ? `${Math.round((modelProgress.loaded / modelProgress.total) * 100)}% · ${(modelProgress.loaded / 1024 / 1024).toFixed(1)}/${(modelProgress.total / 1024 / 1024).toFixed(1)} MB`
                    : '준비 중…'}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/50">
                <div
                  className={`h-full bg-[var(--p)] transition-[width] duration-[var(--dur-slow)] ${
                    modelProgress && modelProgress.total > 1
                      ? ''
                      : 'animate-[pulse-soft_1.5s_ease-in-out_infinite]'
                  }`}
                  style={{
                    width:
                      modelProgress && modelProgress.total > 1
                        ? `${(modelProgress.loaded / modelProgress.total) * 100}%`
                        : '15%',
                  }}
                  aria-hidden
                />
              </div>
              <p className="mt-1.5 font-body text-[10px] text-[var(--t2)]">
                첫 사용 시 1회 (~17MB · HuggingFace 에서 로드). 다음 진입은 즉시 시작.
              </p>
            </>
          )}
        </div>
      )}

      {/* 진행 표시 */}
      <PhaseProgress
        phase={phase}
        currentSentence={currentIdx + 1}
        totalSentences={sentences.length}
      />

      {/* 현재 문장 */}
      <SentenceCarousel sentence={current!} index={currentIdx} total={sentences.length} />

      {/* Phase 컨트롤러 */}
      <PhaseController
        phase={phase}
        piperReady={piperReady}
        onStart={() => void startListen()}
        onStopRecording={() => void stopRecording()}
        onRetry={handleRetry}
      />

      {/* 시각화 + 점수 */}
      {refContour && userContour && (
        <PitchVisualizer reference={refContour} user={userContour} />
      )}
      {score && fb && <ScoreCard score={score} feedback={fb.label} tone={fb.tone} />}

      {phase === 'scored' && current && (
        <ReplayPanel
          referenceReady={materialKey !== null && refCacheRef.current.has(materialKey)}
          selfReady={!!materialKey && userTakeRef.current?.materialKey === materialKey}
          state={replay}
          onPlay={handleReplay}
          onStop={() => replayRef.current?.stop()}
        />
      )}

      {/* #2 단어 정확도 — 측정된 경우만(미지원/실패는 숨김). 낮으면 억양 점수 참고 안내. */}
      {phase === 'scored' && wordRatio != null && (
        <p
          className={`px-1 font-body text-[12px] ${lowWords ? 'text-[var(--learn-review)]' : 'text-[var(--t2)]'}`}
        >
          이번 발화에서 문장 단어의 <span className="font-mono font-[700] tabular-nums">{Math.round(wordRatio * 100)}%</span>가 인식됐어요
          {lowWords ? ' — 억양 점수는 참고만 하고, 단어부터 또박또박 읽어봐요.' : '.'}
        </p>
      )}

      {/* 에러는 상단 Piper 영역에서 통합 표시 */}

      {/* Footer 컨트롤 */}
      <footer className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--bd)] pt-4">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIdx === 0 || phase === 'recording'}
          className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft size={13} aria-hidden /> 이전
        </button>

        {phase === 'scored' && (
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)]"
          >
            <RotateCcw size={13} aria-hidden /> 다시
          </button>
        )}

        <button
          type="button"
          onClick={handleNext}
          disabled={currentIdx === last || phase === 'recording'}
          className="inline-flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-3 py-2 font-display text-[12px] font-[700] text-[var(--on-p)] transition-colors hover:bg-[var(--p-hover)] disabled:cursor-not-allowed disabled:opacity-30"
        >
          다음 <ChevronRight size={13} aria-hidden />
        </button>
      </footer>
    </div>
  )
}

// ─── PhaseController inline ───────────────────────────
function PhaseController({
  phase,
  piperReady,
  onStart,
  onStopRecording,
  onRetry,
}: {
  phase: Phase
  piperReady: boolean
  onStart: () => void
  onStopRecording: () => void
  onRetry: () => void
}) {
  if (phase === 'idle') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
        <p className="font-body text-[12px] text-[var(--t2)]">
          ① Listen → ② Repeat → ③ Compare → ④ Score
        </p>
        <button
          type="button"
          onClick={onStart}
          disabled={!piperReady}
          className="inline-flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--ju)] px-6 py-3 font-display text-[14px] font-[700] text-[var(--on-ju)] shadow-[var(--sh-sm)] transition-all hover:scale-[1.02] hover:bg-[var(--ju-ink)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          <Play size={15} aria-hidden /> {piperReady ? '시작' : '음성 모델 준비 중…'}
        </button>
      </div>
    )
  }
  if (phase === 'listening') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] border border-[var(--p)]/30 bg-[var(--p-light)] p-5">
        <p className="font-display text-[11px] font-[700] uppercase tracking-wider text-[var(--p)]">
          ① Listen — 잘 들어보세요
        </p>
        <div className="flex items-center gap-2 text-[var(--p)]">
          <Loader2 size={18} className="animate-spin" aria-hidden />
          <span className="font-body text-[13px]">원어민 음성 재생 중...</span>
        </div>
      </div>
    )
  }
  if (phase === 'recording') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[var(--r-lg)] border border-[var(--error)]/30 bg-[var(--error-light)] p-5">
        <p className="font-display text-[11px] font-[700] uppercase tracking-wider text-[var(--error-ink)]">
          ② Repeat — 따라 말하세요
        </p>
        <div className="flex items-center gap-2 text-[var(--error-ink)]">
          <Mic size={18} className="animate-[pulse-soft_1.5s_ease-in-out_infinite]" aria-hidden />
          <span className="font-body text-[13px] font-[600]">녹음 중</span>
        </div>
        <button
          type="button"
          onClick={onStopRecording}
          className="inline-flex items-center gap-2 rounded-[var(--r-full)] bg-[var(--error)] px-5 py-3 font-display text-[13px] font-[700] text-white transition-all hover:scale-[1.02] active:scale-[0.97]"
        >
          <Square size={12} fill="currentColor" aria-hidden /> 완료
        </button>
      </div>
    )
  }
  if (phase === 'comparing') {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] border border-[var(--warning)]/30 bg-[var(--warning-light)] p-5">
        <p className="font-display text-[11px] font-[700] uppercase tracking-wider text-[var(--warning)]">
          ③ Compare — 비교 중
        </p>
        <Loader2 size={18} className="animate-spin text-[var(--warning)]" aria-hidden />
      </div>
    )
  }
  // scored
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] border border-[var(--success)]/30 bg-[var(--success-light)] p-5">
      <p className="font-display text-[11px] font-[700] uppercase tracking-wider text-[var(--success)]">
        ④ Score — 결과
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-[var(--r-full)] border border-[var(--success)] bg-[var(--bg)] px-4 py-2 font-display text-[12px] font-[700] text-[var(--success)] transition-colors hover:bg-[var(--success-light)]"
      >
        <RotateCcw size={12} aria-hidden /> 한 번 더
      </button>
    </div>
  )
}

