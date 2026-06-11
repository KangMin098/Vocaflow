// apps/web/src/lib/workspace/use-shadow-session.ts
//
// 따라읽기(shadow) 세션 오케스트레이터 — "듣고 → 따라 말하고 → 다음" 연속 루프.
//
// 흐름 (문장 단위, 자동 반복):
//   listening : 원어민 TTS 로 현재 문장 재생 (본문 하이라이트)
//      ↓ (발화 종료 + 짧은 gap)
//   speaking  : 마이크 인식 시작 — 학습자가 따라 말함. 맞춘 단어 라이브 하이라이트.
//      ↓ (최종 결과 / 침묵 타임아웃)
//   feedback  : 격려 톤 잠깐 표시 (비난 없음)
//      ↓ (자동 진행 ON 이면)
//   다음 문장 listening … 끝까지 반복 → done
//
// 정책:
//   - 브라우저 native speechSynthesis + SpeechRecognition (외부 의존 0).
//   - 인식 미지원·마이크 거부 시 "듣기 중심" fallback (말하기 시간만큼 멈췄다 자동 진행).
//   - 편리함 우선: 인식이 약해도 학습자를 가두지 않고 부드럽게 다음으로.
//   - speechSynthesis 는 tts-controller 싱글톤과 공유 자원 → 시작 시 호출측이 controller stop.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  createRecognizer,
  isSpeechRecognitionSupported,
  type Recognizer,
} from './speech-recognition'
import { computeShadowMatch, toneForRatio, type ShadowTone } from './shadow-match'
import type { SentenceItem } from './tts-controller'

export type ShadowPhase = 'idle' | 'listening' | 'speaking' | 'feedback' | 'done'

export interface ShadowState {
  running: boolean
  paused: boolean
  phase: ShadowPhase
  /** queue 기준 현재 문장 index */
  index: number
  total: number
  /** 본문(ReadingUniverse) 하이라이트용 — 전체 chapter 기준 sentence id */
  sentenceIdx: number | null
  /** 현재까지 인식된 발화 (라이브) */
  transcript: string
  /** 맞춘 목표 단어 정규화 키 (라이브 하이라이트) */
  matchedKeys: Set<string>
  /** feedback 단계 격려 톤 */
  tone: ShadowTone | null
  rate: number
  autoAdvance: boolean
  recognitionSupported: boolean
  micDenied: boolean
}

export interface ShadowControls {
  start: (startIndex?: number) => void
  pause: () => void
  resume: () => void
  stop: () => void
  /** 현재 문장 다시 (듣기부터) */
  repeat: () => void
  next: () => void
  prev: () => void
  jumpTo: (sentenceId: number) => void
  setRate: (rate: number) => void
  setAutoAdvance: (on: boolean) => void
}

const EMPTY_KEYS: Set<string> = new Set()

// 말하기(인식) 최대 대기 — 문장 길이에 비례. 학습자를 가두지 않도록 상한.
function speakWindowMs(wordCount: number): number {
  return Math.min(14_000, Math.max(3_500, wordCount * 650 + 2_800))
}
// 듣기 중심 fallback 의 "따라 말하기" 멈춤 시간.
function listenOnlyPauseMs(wordCount: number): number {
  return Math.min(11_000, Math.max(1_800, wordCount * 480 + 1_200))
}

const GAP_AFTER_TTS_MS = 280
const FEEDBACK_MS = 950

function resolveVoice(voiceURI: string | null): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !window.speechSynthesis || !voiceURI) return undefined
  return window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceURI)
}

function wordCountOf(text: string): number {
  const t = text.trim()
  return t.length === 0 ? 0 : t.split(/\s+/).length
}

export function useShadowSession(
  sentences: SentenceItem[],
  voiceURI: string | null,
): { state: ShadowState; controls: ShadowControls } {
  const recognitionSupported = isSpeechRecognitionSupported()

  const [state, setState] = useState<ShadowState>({
    running: false,
    paused: false,
    phase: 'idle',
    index: 0,
    total: sentences.length,
    sentenceIdx: null,
    transcript: '',
    matchedKeys: EMPTY_KEYS,
    tone: null,
    rate: 1,
    autoAdvance: true,
    recognitionSupported,
    micDenied: false,
  })

  // 큐 — 빈 문장 제외
  const queue = useRef<SentenceItem[]>([])
  queue.current = sentences.filter((s) => s.text.trim().length > 0)

  // 콜백 stale 방지용 refs
  const runningRef = useRef(false)
  const pausedRef = useRef(false)
  const indexRef = useRef(0)
  const rateRef = useRef(1)
  const autoRef = useRef(true)
  const voiceURIRef = useRef(voiceURI)
  voiceURIRef.current = voiceURI

  const recognizerRef = useRef<Recognizer | null>(null)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)
  const windowTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 인식 중 이번 문장에서 최종 결과를 받았는지 (중복 평가 방지)
  const evaluatedRef = useRef(false)
  const transcriptRef = useRef('')
  const allowFallbackRef = useRef(!recognitionSupported)

  const clearTimers = useCallback(() => {
    for (const t of [windowTimer, gapTimer, feedbackTimer]) {
      if (t.current) {
        clearTimeout(t.current)
        t.current = null
      }
    }
  }, [])

  const hardStopAudio = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    if (recognizerRef.current) recognizerRef.current.abort()
    utterRef.current = null
  }, [])

  // 전방 선언 (상호 참조) — ref 로 묶어 stable callback 유지
  const speakCurrentRef = useRef<() => void>(() => {})
  const advanceRef = useRef<() => void>(() => {})

  const finish = useCallback(() => {
    runningRef.current = false
    pausedRef.current = false
    clearTimers()
    hardStopAudio()
    setState((s) => ({
      ...s,
      running: false,
      paused: false,
      phase: 'done',
      sentenceIdx: null,
      transcript: '',
      matchedKeys: EMPTY_KEYS,
      tone: null,
    }))
  }, [clearTimers, hardStopAudio])

  const evaluate = useCallback(
    (transcript: string) => {
      if (evaluatedRef.current) return
      evaluatedRef.current = true
      clearTimers()
      const item = queue.current[indexRef.current]
      const match = item
        ? computeShadowMatch(item.text, transcript)
        : { ratio: 0, matchedKeys: EMPTY_KEYS }
      const tone: ShadowTone = transcript.trim().length === 0 ? 'gentle' : toneForRatio(match.ratio)
      setState((s) => ({
        ...s,
        phase: 'feedback',
        transcript,
        matchedKeys: match.matchedKeys,
        tone,
      }))
      if (autoRef.current) {
        feedbackTimer.current = setTimeout(() => advanceRef.current(), FEEDBACK_MS)
      }
    },
    [clearTimers],
  )

  const beginListening = useCallback(() => {
    if (!runningRef.current || pausedRef.current) return
    const item = queue.current[indexRef.current]
    if (!item) {
      finish()
      return
    }
    evaluatedRef.current = false
    transcriptRef.current = ''
    const words = wordCountOf(item.text)

    setState((s) => ({
      ...s,
      phase: 'speaking',
      transcript: '',
      matchedKeys: EMPTY_KEYS,
      tone: null,
    }))

    const canRecognize = recognitionSupported && !allowFallbackRef.current
    if (!canRecognize) {
      // 듣기 중심 fallback — 따라 말할 시간만큼 멈췄다 자동 진행 (또는 수동)
      windowTimer.current = setTimeout(() => {
        if (autoRef.current) advanceRef.current()
      }, listenOnlyPauseMs(words))
      return
    }

    if (!recognizerRef.current) recognizerRef.current = createRecognizer('en-US')
    const started = recognizerRef.current.start({
      onInterim: (t) => {
        transcriptRef.current = t
        const m = item ? computeShadowMatch(item.text, t) : null
        setState((s) =>
          s.phase === 'speaking'
            ? { ...s, transcript: t, matchedKeys: m ? m.matchedKeys : s.matchedKeys }
            : s,
        )
      },
      onFinal: (t) => {
        transcriptRef.current = t
        evaluate(t)
      },
      onError: (err) => {
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          // 마이크 거부 — 이후 전체를 듣기 중심으로 전환
          allowFallbackRef.current = true
          setState((s) => ({ ...s, micDenied: true }))
          clearTimers()
          windowTimer.current = setTimeout(() => {
            if (autoRef.current) advanceRef.current()
          }, listenOnlyPauseMs(words))
        }
        // no-speech/aborted 등은 onend 가 처리
      },
      onEnd: () => {
        // 최종 결과 없이 끝났으면(침묵) 현재까지 transcript 로 평가
        if (!evaluatedRef.current && runningRef.current && !pausedRef.current) {
          evaluate(transcriptRef.current)
        }
      },
    })

    if (!started) {
      // start 실패 → fallback 1회
      windowTimer.current = setTimeout(() => {
        if (autoRef.current) advanceRef.current()
      }, listenOnlyPauseMs(words))
      return
    }

    // 안전망 — 일정 시간 후 stop (onend 유도 → 평가)
    windowTimer.current = setTimeout(() => {
      if (recognizerRef.current) recognizerRef.current.stop()
      // stop 후 onend 가 안 와도 평가 보장
      if (!evaluatedRef.current) evaluate(transcriptRef.current)
    }, speakWindowMs(words))
  }, [recognitionSupported, finish, evaluate, clearTimers])

  const speakCurrent = useCallback(() => {
    if (!runningRef.current || pausedRef.current) return
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      // 합성 불가 — 인식/대기만으로 진행
      beginListening()
      return
    }
    const item = queue.current[indexRef.current]
    if (!item) {
      finish()
      return
    }
    clearTimers()
    window.speechSynthesis.cancel()
    if (recognizerRef.current) recognizerRef.current.abort()
    evaluatedRef.current = false

    setState((s) => ({
      ...s,
      phase: 'listening',
      index: indexRef.current,
      sentenceIdx: item.sentenceIdx,
      transcript: '',
      matchedKeys: EMPTY_KEYS,
      tone: null,
    }))

    const utter = new SpeechSynthesisUtterance(item.text)
    utter.lang = 'en-US'
    utter.rate = rateRef.current
    const voice = resolveVoice(voiceURIRef.current)
    if (voice) utter.voice = voice
    utter.onend = () => {
      if (utterRef.current !== utter) return
      utterRef.current = null
      if (!runningRef.current || pausedRef.current) return
      gapTimer.current = setTimeout(() => beginListening(), GAP_AFTER_TTS_MS)
    }
    utter.onerror = () => {
      if (utterRef.current !== utter) return
      utterRef.current = null
      if (!runningRef.current || pausedRef.current) return
      gapTimer.current = setTimeout(() => beginListening(), GAP_AFTER_TTS_MS)
    }
    utterRef.current = utter
    window.speechSynthesis.speak(utter)
  }, [beginListening, finish, clearTimers])

  const advance = useCallback(() => {
    if (!runningRef.current) return
    clearTimers()
    if (indexRef.current + 1 >= queue.current.length) {
      finish()
      return
    }
    indexRef.current += 1
    speakCurrent()
  }, [clearTimers, finish, speakCurrent])

  // ref 동기화 (상호 재귀 stable)
  speakCurrentRef.current = speakCurrent
  advanceRef.current = advance

  // ── Controls ──────────────────────────────────────────
  const start = useCallback(
    (startIndex = 0) => {
      if (queue.current.length === 0) return
      runningRef.current = true
      pausedRef.current = false
      indexRef.current = Math.max(0, Math.min(startIndex, queue.current.length - 1))
      setState((s) => ({ ...s, running: true, paused: false, micDenied: false }))
      speakCurrent()
    },
    [speakCurrent],
  )

  const pause = useCallback(() => {
    if (!runningRef.current || pausedRef.current) return
    pausedRef.current = true
    clearTimers()
    hardStopAudio()
    setState((s) => ({ ...s, paused: true }))
  }, [clearTimers, hardStopAudio])

  const resume = useCallback(() => {
    if (!runningRef.current || !pausedRef.current) return
    pausedRef.current = false
    setState((s) => ({ ...s, paused: false }))
    // 현재 문장 듣기부터 다시 (pause/resume 신뢰성 회피)
    speakCurrent()
  }, [speakCurrent])

  const stop = useCallback(() => {
    runningRef.current = false
    pausedRef.current = false
    clearTimers()
    hardStopAudio()
    setState((s) => ({
      ...s,
      running: false,
      paused: false,
      phase: 'idle',
      sentenceIdx: null,
      transcript: '',
      matchedKeys: EMPTY_KEYS,
      tone: null,
    }))
  }, [clearTimers, hardStopAudio])

  const repeat = useCallback(() => {
    if (!runningRef.current) return
    pausedRef.current = false
    speakCurrent()
  }, [speakCurrent])

  const next = useCallback(() => {
    if (!runningRef.current) return
    pausedRef.current = false
    advance()
  }, [advance])

  const prev = useCallback(() => {
    if (!runningRef.current) return
    pausedRef.current = false
    indexRef.current = Math.max(0, indexRef.current - 1)
    speakCurrent()
  }, [speakCurrent])

  const jumpTo = useCallback(
    (sentenceId: number) => {
      const idx = queue.current.findIndex((s) => s.sentenceIdx === sentenceId)
      if (idx < 0) return
      runningRef.current = true
      pausedRef.current = false
      indexRef.current = idx
      setState((s) => ({ ...s, running: true, paused: false }))
      speakCurrent()
    },
    [speakCurrent],
  )

  const setRate = useCallback((rate: number) => {
    rateRef.current = rate
    setState((s) => ({ ...s, rate }))
  }, [])

  const setAutoAdvance = useCallback((on: boolean) => {
    autoRef.current = on
    setState((s) => ({ ...s, autoAdvance: on }))
  }, [])

  // total 동기화
  useEffect(() => {
    setState((s) => (s.total === queue.current.length ? s : { ...s, total: queue.current.length }))
  }, [sentences])

  // 언마운트 / 문장 소스 변경 시 정리
  useEffect(() => {
    return () => {
      runningRef.current = false
      pausedRef.current = false
      clearTimers()
      hardStopAudio()
    }
  }, [clearTimers, hardStopAudio])

  return {
    state,
    controls: {
      start,
      pause,
      resume,
      stop,
      repeat,
      next,
      prev,
      jumpTo,
      setRate,
      setAutoAdvance,
    },
  }
}
