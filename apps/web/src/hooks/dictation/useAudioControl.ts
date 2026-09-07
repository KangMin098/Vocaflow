// apps/web/src/hooks/dictation/useAudioControl.ts
//
// TTS 오디오 컨트롤 훅 — 엔진 2종(시스템 음성 / 신경망 음성)을 한 표면 뒤에 둔다.
//
// 엔진 선택 규칙:
//   ① 사용자가 고른 값이 있으면 그것 (localStorage 유지)
//   ② 그 외 → 시스템 음성 (속도를 낮춰도 음높이가 보존돼 느리게 듣기에 유리)
//
// **자동 전환하지 않는다.** 영어 음성이 없는 기기라도 17MB 를 말없이 내려받지 않는다 —
// 데이터는 학습자의 것이고, 갑자기 시작되는 다운로드는 Calm UI 가 아니다. 대신 세션 화면이
// "영어 음성이 없어요 → [내려받은 음성 사용하기 (약 17MB · 한 번만)]" 로 **한 번 물어본다**.
// 한 번 고르면 localStorage 에 남아 다음부터는 묻지 않는다.
//
// 신경망 합성이 실패하면(다운로드 실패·WASM 미지원) 그 자리에서 시스템 음성으로 되돌린다 —
// 받아쓰기 도중 소리가 안 나는 것보다 목소리가 바뀌는 편이 낫다.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { AudioController, hasEnglishVoice } from '@/lib/dictation/audio-control'
import { NeuralVoiceController, isPiperSupported, prewarm } from '@/lib/dictation/neural-voice'

export type VoiceEngine = 'system' | 'neural'

const PREF_KEY = 'vocaflow:dictation:voice-engine'

function readPref(): VoiceEngine | null {
  if (typeof window === 'undefined') return null
  const v = window.localStorage.getItem(PREF_KEY)
  return v === 'system' || v === 'neural' ? v : null
}

/**
 * 신경망 합성 한 회차의 상한.
 *
 * 첫 사용은 모델(~17MB)과 ONNX 런타임을 받아야 해 몇 초가 걸린다. 그래서 넉넉히 잡되
 * **무한정 기다리지는 않는다** — 못 받으면 시스템 음성으로 내려가는 편이 무음보다 낫다.
 */
const NEURAL_TIMEOUT_MS = 20_000

/** 제한 시간 안에 안 끝나면 거부한다 — 호출부가 폴백을 탈 수 있게. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('neural-timeout')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

export function useAudioControl() {
  const systemRef = useRef<AudioController | null>(null)
  const neuralRef = useRef<NeuralVoiceController | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [iteration, setIteration] = useState(0)
  /** 영어 TTS 음성 가용 여부 — null=확인중, false=없음, true=정상 */
  const [englishVoiceAvailable, setEnglishVoiceAvailable] = useState<boolean | null>(null)
  const [engine, setEngine] = useState<VoiceEngine>('system')
  /** 신경망 음성 준비 중(첫 사용 모델 다운로드) — UI 가 침묵의 이유를 설명한다 */
  const [preparing, setPreparing] = useState(false)
  const [neuralFailed, setNeuralFailed] = useState(false)

  if (systemRef.current === null && typeof window !== 'undefined') {
    systemRef.current = new AudioController()
  }
  if (neuralRef.current === null && typeof window !== 'undefined') {
    neuralRef.current = new NeuralVoiceController()
  }

  useEffect(() => {
    let cancelled = false
    void hasEnglishVoice().then((ok) => {
      if (cancelled) return
      setEnglishVoiceAvailable(ok)
      const pref = readPref()
      if (pref) setEngine(pref)
    })
    return () => {
      cancelled = true
      systemRef.current?.cancel()
      neuralRef.current?.cancel()
    }
  }, [])

  const chooseEngine = useCallback((next: VoiceEngine) => {
    setEngine(next)
    setNeuralFailed(false)
    if (typeof window !== 'undefined') window.localStorage.setItem(PREF_KEY, next)
  }, [])

  const stop = useCallback(() => {
    systemRef.current?.cancel()
    neuralRef.current?.cancel()
    setIsPlaying(false)
    setIteration(0)
    setPreparing(false)
  }, [])

  const play = useCallback(
    async (text: string, rate: number, voiceURI?: string) => {
      setIsPlaying(true)
      try {
        if (engine === 'neural' && neuralRef.current && !neuralFailed) {
          setPreparing(true)
          try {
            // ⏱ 시간 제한이 없으면 **버튼이 죽는다.** 모델(ONNX 런타임·음성)을 못 받으면
            //   합성 Promise 가 영영 안 끝나고, isPlaying 이 참에 갇혀 재생 버튼이
            //   '정지' 로 바뀐 채 아무 소리도 안 난다 — 학습자에겐 "듣기가 안 된다".
            //   (사용자 신고 2026-08-16. 엔진 선택은 localStorage 에 남아 매번 재현된다.)
            await withTimeout(neuralRef.current.speak(text, rate), NEURAL_TIMEOUT_MS)
            setPreparing(false)
            return
          } catch {
            // 합성 실패·시간 초과 — 이번 재생부터 시스템 음성으로 되돌린다.
            setPreparing(false)
            setNeuralFailed(true)
          }
        }
        await systemRef.current?.speak({ text, rate, voiceURI })
      } finally {
        // 어떤 경로로 끝나든 **반드시** 푼다. 여기서 안 풀면 버튼이 영영 안 눌린다.
        setIsPlaying(false)
        setPreparing(false)
      }
    },
    [engine, neuralFailed],
  )

  const repeat = useCallback(
    async (
      text: string,
      times: number,
      rate: number,
      pauseMs: number = 1500,
      voiceURI?: string,
    ) => {
      setIsPlaying(true)
      setIteration(0)
      try {
        if (engine === 'neural' && neuralRef.current && !neuralFailed) {
          setPreparing(true)
          try {
            // 반복 재생은 회차마다 시간이 드니 한 회차 기준으로 넉넉히 잡는다.
            await withTimeout(
              neuralRef.current.repeat(text, times, rate, pauseMs, (c) => {
                setPreparing(false)
                setIteration(c)
              }),
              NEURAL_TIMEOUT_MS * Math.max(1, times),
            )
            setPreparing(false)
            return
          } catch {
            setPreparing(false)
            setNeuralFailed(true)
          }
        }
        await systemRef.current?.repeat(text, times, rate, pauseMs, voiceURI, (current) =>
          setIteration(current),
        )
      } finally {
        setIsPlaying(false)
        setPreparing(false)
        setIteration(0)
      }
    },
    [engine, neuralFailed],
  )

  /** 다음 문항 문장 선합성 — 재생 버튼을 눌렀을 때의 침묵 제거. */
  const warm = useCallback(
    (text: string) => {
      if (engine === 'neural' && !neuralFailed) prewarm(text)
    },
    [engine, neuralFailed],
  )

  return {
    play,
    repeat,
    stop,
    warm,
    isPlaying,
    iteration,
    englishVoiceAvailable,
    engine,
    chooseEngine,
    neuralSupported: isPiperSupported(),
    preparing,
    neuralFailed,
  }
}
